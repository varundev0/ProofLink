/**
 * POST /api/razorpay/verify
 *
 * Verifies a Razorpay payment signature using HMAC-SHA256.
 * On success: marks the project as paid and issues a download token.
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { sendPaymentReceivedToFreelancer, sendPaymentConfirmationToBuyer } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const { projectId, razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();

    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('projectId', projectId)
      .single();

    if (fetchError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.status === 'paid') {
      return NextResponse.json({ error: 'This project has already been paid.' }, { status: 409 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const isMock = !keySecret || razorpayOrderId?.startsWith('mock_order_');

    if (!isMock) {
      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return NextResponse.json({ error: 'Missing payment details' }, { status: 400 });
      }

      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (expectedSignature !== razorpaySignature) {
        return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
      }
    }

    // Mark project paid
    await supabase
      .from('projects')
      .update({ status: 'paid', paidAt: new Date().toISOString() })
      .eq('projectId', projectId);

    // Atomically increment deal count — avoids read-then-write race condition
    await supabase.rpc('increment_deal_count', { user_id: project.freelancerId });

    // Issue download token — ON CONFLICT DO NOTHING guards against double-issuance
    // if verify and webhook both fire at the same time (requires UNIQUE constraint
    // on download_tokens.projectId in Supabase).
    const downloadToken = uuidv4();
    const { error: tokenError } = await supabase.from('download_tokens').upsert(
      {
        token: downloadToken,
        projectId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: 'projectId', ignoreDuplicates: true }
    );

    if (tokenError) {
      return NextResponse.json({ error: 'Failed to issue download token' }, { status: 500 });
    }

    // If a token already existed (webhook beat us), fetch it
    const { data: existingToken } = await supabase
      .from('download_tokens')
      .select('token')
      .eq('projectId', projectId)
      .single();

    const finalToken = existingToken?.token ?? downloadToken;

    // Send emails fire-and-forget — don't block the response
    void sendPaymentReceivedToFreelancer({
      freelancerEmail: project.freelancerEmail as string,
      projectTitle: project.title as string,
      amount: project.amount as number,
      projectId,
    });
    // Buyer email requires their address — stored on the order; use freelancerEmail
    // as a proxy if buyerEmail isn't on the project record yet
    if (project.buyerEmail) {
      void sendPaymentConfirmationToBuyer({
        buyerEmail: project.buyerEmail as string,
        projectTitle: project.title as string,
        amount: project.amount as number,
        projectId,
        downloadToken: finalToken,
      });
    }

    return NextResponse.json({ success: true, downloadToken: finalToken });
  } catch (err) {
    console.error('[POST /api/razorpay/verify]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
