/**
 * Next.js Proxy — Session Refresh + Rate Limiting
 *
 * Two responsibilities:
 * 1. Refresh Supabase JWT on every request so sessions don't expire silently
 * 2. Rate limit sensitive API routes to prevent abuse
 *
 * Rate limiting uses Upstash Redis REST API directly (no SDK needed).
 * Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your env vars.
 *
 * If Upstash env vars are not set, rate limiting is skipped (graceful degradation
 * for local dev without a Redis instance).
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Rate limit rules per route prefix
// key: path prefix, value: [requests, window]
const RATE_LIMITS: Record<string, { requests: number; window: string }> = {
  '/api/auth/signin':      { requests: 10,  window: '15 m' },
  '/api/auth/signup':      { requests: 5,   window: '15 m' },
  '/api/upload':           { requests: 20,  window: '1 h'  },
  '/api/razorpay/order':   { requests: 30,  window: '1 h'  },
};

async function applyRateLimit(
  request: NextRequest,
  path: string
): Promise<NextResponse | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Graceful degradation — skip if Upstash not configured
  if (!url || !token) return null;

  const rule = Object.entries(RATE_LIMITS).find(([prefix]) => path.startsWith(prefix));
  if (!rule) return null;

  const [prefix, { requests, window: windowStr }] = rule;

  // Derive a stable key: route + IP
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'anonymous';
  const key = `rl:${prefix}:${ip}`;

  // Parse window to seconds
  const [amount, unit] = windowStr.split(' ');
  const multiplier = unit.startsWith('m') ? 60 : unit.startsWith('h') ? 3600 : 1;
  const windowSecs = parseInt(amount) * multiplier;

  // Use Upstash REST API directly — no SDK import needed at the edge
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSecs;

  // MULTI: ZREMRANGEBYSCORE + ZADD + ZCARD + EXPIRE
  const pipeline = [
    ['ZREMRANGEBYSCORE', key, '-inf', windowStart],
    ['ZADD', key, now, `${now}-${Math.random()}`],
    ['ZCARD', key],
    ['EXPIRE', key, windowSecs],
  ];

  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pipeline),
  });

  if (!res.ok) return null; // fail open

  const results = await res.json() as Array<{ result: number }>;
  const count = results[2]?.result ?? 0;

  if (count > requests) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(windowSecs),
          'X-RateLimit-Limit': String(requests),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // ── Rate limiting (API routes only) ───────────────────────────────────────
  if (path.startsWith('/api/')) {
    const limited = await applyRateLimit(request, path);
    if (limited) return limited;
  }

  // ── Session refresh ───────────────────────────────────────────────────────
  let response = NextResponse.next({ request });

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    await supabase.auth.getUser();
  } catch (err) {
    console.error('[proxy] Supabase client error:', err);

    // API routes get a 503 — callers need a signal that the service is misconfigured.
    // Non-API routes pass through; the app layer will surface auth errors as needed.
    if (path.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ error: 'Service temporarily unavailable — configuration error' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
