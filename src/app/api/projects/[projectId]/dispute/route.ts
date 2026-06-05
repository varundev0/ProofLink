/**
 * POST /api/projects/:projectId/dispute
 *
 * Marks a paid project as disputed, freezing the 24-hour auto-release.
 * Requires a valid download token (proves the caller is the buyer).
 *
 * Body: { token: string, reason: string }
 */

import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { sendDisputeOpenedToFreelancer } from '@/lib/email';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  let body: { token?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { token, reason } = body;

  if (!token) {
    return NextResponse.json({ error: 'Download token is required.' }, { status: 401 });
  }
  if (!reason || reason.trim().length < 10) {
    return NextResponse.json(
      { error: 'Please provide a reason (at least 10 characters).' },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();

  // Validate token belongs to this project and hasn't expired
  const { data: tokenRecord, error: tokenError } = await supabase
    .from('download_tokens')
    .select('*')
    .eq('token', token)
    .eq('projectId', projectId)
    .single();

  if (tokenError || !tokenRecord) {
    return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 403 });
  }

  // Fetch project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('status, freelancerEmail, title')
    .eq('projectId', projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  if (project.status === 'released') {
    return NextResponse.json(
      { error: 'Funds have already been released — dispute window has closed.' },
      { status: 409 }
    );
  }

  if (project.status === 'disputed') {
    return NextResponse.json({ error: 'A dispute is already open for this project.' }, { status: 409 });
  }

  if (project.status !== 'paid') {
    return NextResponse.json({ error: 'Only paid projects can be disputed.' }, { status: 409 });
  }

  // Freeze the project
  const { error: updateError } = await supabase
    .from('projects')
    .update({ status: 'disputed' })
    .eq('projectId', projectId);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to open dispute.' }, { status: 500 });
  }

  void sendDisputeOpenedToFreelancer({
    freelancerEmail: project.freelancerEmail as string,
    projectTitle: project.title as string,
    projectId,
    reason: reason.trim(),
  });

  console.log(`[dispute] project ${projectId} marked disputed. Reason: ${reason.trim()}`);
  return NextResponse.json({ success: true });
}
