/**
 * POST /api/razorpay/order
 *
 * Creates a Razorpay order for a given project.
 * Returns a mock order when no credentials are configured.
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

export async function POST(request: Request) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Identify the buyer so we can attach their email to the order
    const serverClient = await createSupabaseServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    const buyerEmail = user?.email ?? null;

    const supabase = createSupabaseServiceClient();
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('projectId', projectId)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Persist buyerEmail on the project so verify/webhook can send the confirmation email
    if (buyerEmail && !project.buyerEmail) {
      await supabase
        .from('projects')
        .update({ buyerEmail })
        .eq('projectId', projectId);
    }

    if (!keyId || !keySecret) {
      return NextResponse.json({
        mock: true,
        orderId: `mock_order_${projectId}`,
        amount: (project.amount as number) * 100,
        currency: 'INR',
        keyId: 'mock_key',
      });
    }

    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round((project.amount as number) * 100),
        currency: 'INR',
        receipt: projectId,
        notes: { buyerEmail: buyerEmail ?? '' },
      }),
    });

    if (!rzpRes.ok) {
      const err = await rzpRes.json();
      console.error('[Razorpay order]', err);
      return NextResponse.json({ error: 'Failed to create Razorpay order' }, { status: 502 });
    }

    const order = await rzpRes.json();
    return NextResponse.json({
      mock: false,
      orderId: order.id as string,
      amount: order.amount as number,
      currency: order.currency as string,
      keyId,
    });
  } catch (err) {
    console.error('[POST /api/razorpay/order]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
