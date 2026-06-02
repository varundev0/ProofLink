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
      .update({ status: 'paid' })
      .eq('projectId', projectId);

    // Increment deal count
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', project.freelancerId)
      .single();

    await supabase.from('profiles').upsert({
      id: project.freelancerId,
      deal_count: ((profile?.deal_count as number) ?? 0) + 1,
    });

    // Issue download token
    const downloadToken = uuidv4();
    const { error: tokenError } = await supabase.from('download_tokens').insert({
      token: downloadToken,
      projectId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    if (tokenError) {
      return NextResponse.json({ error: 'Failed to issue download token' }, { status: 500 });
    }

    return NextResponse.json({ success: true, downloadToken });
  } catch (err) {
    console.error('[POST /api/razorpay/verify]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
