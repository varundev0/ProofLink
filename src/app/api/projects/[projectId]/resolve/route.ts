/**
 * POST /api/projects/:projectId/resolve
 *
 * Resolves an open dispute. Only callable by the authenticated freelancer
 * who owns the project (disputes are initiated by buyers; resolutions are
 * handled by the freelancer agreeing to release or refund).
 *
 * Body: { outcome: 'released' | 'refunded' }
 *
 * - 'released': freelancer wins — status → released, buyer can still download
 * - 'refunded': buyer wins — status → refunded, downloads blocked
 *   (actual Razorpay refund must be initiated manually in the Razorpay dashboard
 *    until the refund API is integrated)
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { sendDisputeResolvedToParties } from '@/lib/email';
import { verifySameOrigin } from '@/lib/csrf';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  // Auth — only the owning freelancer can resolve
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: { outcome?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { outcome } = body;
  if (outcome !== 'released' && outcome !== 'refunded') {
    return NextResponse.json(
      { error: 'outcome must be "released" or "refunded".' },
      { status: 400 }
    );
  }

  const service = createSupabaseServiceClient();

  const { data: project, error: projectError } = await service
    .from('projects')
    .select('*')
    .eq('projectId', projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  if (project.freelancerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  if (project.status !== 'disputed') {
    return NextResponse.json(
      { error: 'Only disputed projects can be resolved.' },
      { status: 409 }
    );
  }

  const { error: updateError } = await service
    .from('projects')
    .update({ status: outcome })
    .eq('projectId', projectId);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to resolve dispute.' }, { status: 500 });
  }

  void sendDisputeResolvedToParties({
    freelancerEmail: project.freelancerEmail as string,
    buyerEmail: (project.buyerEmail as string) ?? project.freelancerEmail as string,
    projectTitle: project.title as string,
    projectId,
    outcome: outcome as 'released' | 'refunded',
  });

  console.log(`[resolve] project ${projectId} resolved as: ${outcome}`);
  return NextResponse.json({ success: true, status: outcome });
}
