/**
 * User-authenticated Supabase client for Route Handlers.
 *
 * Uses @supabase/ssr to automatically read and write the session cookie,
 * so supabase.auth.getUser() always returns the signed-in freelancer.
 *
 * Use this in any route that needs to know WHO is making the request.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a read-only context (e.g. Server Component) — safe to ignore.
          }
        },
      },
    }
  );
}
