/**
 * POST /api/razorpay/webhook
 *
 * Server-to-server payment confirmation from Razorpay.
 * Source of truth for payment status — fires even if the client's browser
 * closes before /api/razorpay/verify is called.
 *
 * Setup in Razorpay dashboard:
 *   Settings → Webhooks → Add new webhook
 *   URL: https://your-domain.com/api/razorpay/webhook
 *   Events: payment.captured
 *   Secret: set RAZORPAY_WEBHOOK_SECRET in .env.local
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { sendPaymentReceivedToFreelancer } from '@/lib/email';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (webhookSecret) {
    const signature = request.headers.get('x-razorpay-signature');
    if (!signature) return new Response('Missing signature', { status: 400 });

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) return new Response('Invalid signature', { status: 400 });
  }

  let event: { event: string; payload: { payment: { entity: Record<string, unknown> } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (event.event !== 'payment.captured') {
    return NextResponse.json({ received: true });
  }

  const payment = event.payload.payment.entity;
  const projectId = payment.receipt as string | undefined;
  if (!projectId) return NextResponse.json({ received: true });

  const supabase = createSupabaseServiceClient();

  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('*')
    .eq('projectId', projectId)
    .single();

  if (fetchError || !project) {
    console.error('[webhook] Project not found:', projectId);
    return NextResponse.json({ received: true });
  }

  if (project.status === 'paid') return NextResponse.json({ received: true });

  await supabase.from('projects').update({ status: 'paid', paidAt: new Date().toISOString() }).eq('projectId', projectId);

  // Atomically increment deal count
  await supabase.rpc('increment_deal_count', { user_id: project.freelancerId });

  // Upsert download token — idempotent if verify already ran
  await supabase.from('download_tokens').upsert(
    {
      token: uuidv4(),
      projectId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: 'projectId', ignoreDuplicates: true }
  );

  void sendPaymentReceivedToFreelancer({
    freelancerEmail: project.freelancerEmail as string,
    projectTitle: project.title as string,
    amount: project.amount as number,
    projectId,
  });

  console.log('[webhook] payment.captured — project marked paid:', projectId);
  return NextResponse.json({ received: true });
}
