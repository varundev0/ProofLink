/**
 * GET /api/projects/:projectId/download?token=<downloadToken>
 *
 * Returns a Supabase Storage signed URL for the final file.
 *
 * Token validation strategy:
 * - status 'paid'     → token must be valid and unexpired (24hr window still open)
 * - status 'released' → token may be expired; we skip expiry check and issue a
 *                       fresh signed URL directly, since funds have already cleared
 *                       and the buyer has permanent download rights
 * - status 'disputed' → blocked until resolved
 * - status 'pending'  → blocked, no payment yet
 */

import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const supabase = createSupabaseServiceClient();

  if (!token) {
    return NextResponse.json({ error: 'Download token is required.' }, { status: 401 });
  }

  // ── Project lookup first — status drives validation logic ─────────────────
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('projectId', projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  const status = project.status as string;

  if (status === 'pending') {
    return NextResponse.json({ error: 'Payment required to unlock file.' }, { status: 403 });
  }

  if (status === 'disputed') {
    return NextResponse.json(
      { error: 'A dispute is open on this project. Downloads are unavailable until resolved.' },
      { status: 403 }
    );
  }

  if (status !== 'paid' && status !== 'released') {
    return NextResponse.json({ error: 'Project is not in a downloadable state.' }, { status: 403 });
  }

  // ── Token validation ──────────────────────────────────────────────────────
  const { data: tokenRecord, error: tokenError } = await supabase
    .from('download_tokens')
    .select('*')
    .eq('token', token)
    .eq('projectId', projectId)
    .single();

  if (tokenError || !tokenRecord) {
    return NextResponse.json({ error: 'Invalid download token.' }, { status: 403 });
  }

  // For 'paid' projects: enforce token expiry (24hr window is still open)
  // For 'released' projects: skip expiry check — buyer has permanent rights
  if (status === 'paid' && new Date(tokenRecord.expiresAt as string) < new Date()) {
    return NextResponse.json(
      { error: 'Download link has expired. Please contact the freelancer.' },
      { status: 403 }
    );
  }

  // ── Generate signed URL ───────────────────────────────────────────────────
  const finalFileUrl = (project.finalFileUrl as string) ?? '';

  if (finalFileUrl.startsWith('finals://')) {
    const filename = finalFileUrl.replace('finals://', '');
    const { data: signedData, error: signedError } = await supabase.storage
      .from('finals')
      .createSignedUrl(filename, 3600, { download: true });

    if (signedError || !signedData) {
      return NextResponse.json({ error: 'Failed to generate download link.' }, { status: 500 });
    }

    return NextResponse.json({ signedUrl: signedData.signedUrl });
  }

  // Mock/legacy project
  const signedUrl = `/mock-download/${projectId}?expires=${Date.now() + 3_600_000}&signature=mock-sig`;
  return NextResponse.json({ signedUrl });
}
