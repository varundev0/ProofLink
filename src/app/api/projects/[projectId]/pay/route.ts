/**
 * POST /api/projects/:projectId/pay
 *
 * Legacy pay route — kept for the MockRazorpay dev flow.
 * In production, payment is verified via /api/razorpay/verify instead.
 */

import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
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

  // Mark project as paid
  const { error: updateError } = await supabase
    .from('projects')
    .update({ status: 'paid' })
    .eq('projectId', projectId);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update project status' }, { status: 500 });
  }

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

  // Issue a 24-hour download token
  const downloadToken = uuidv4();
  const { error: tokenError } = await supabase.from('download_tokens').insert({
    token: downloadToken,
    projectId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  if (tokenError) {
    return NextResponse.json({ error: 'Failed to issue download token' }, { status: 500 });
  }

  return NextResponse.json({ success: true, status: 'paid', downloadToken });
}
