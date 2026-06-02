/**
 * GET /api/projects/:projectId/download?token=<downloadToken>
 *
 * Validates a time-limited download token and returns a signed URL for the final file.
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

  // ── Token validation ──────────────────────────────────────────────────────
  const { data: tokenRecord, error: tokenError } = await supabase
    .from('download_tokens')
    .select('*')
    .eq('token', token)
    .single();

  if (tokenError || !tokenRecord) {
    return NextResponse.json({ error: 'Invalid download token.' }, { status: 403 });
  }

  if (tokenRecord.projectId !== projectId) {
    return NextResponse.json({ error: 'Token does not match project.' }, { status: 403 });
  }

  if (new Date(tokenRecord.expiresAt as string) < new Date()) {
    return NextResponse.json(
      { error: 'Download link has expired. Please contact the freelancer.' },
      { status: 403 }
    );
  }

  // ── Project lookup ────────────────────────────────────────────────────────
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('projectId', projectId)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (project.status !== 'paid') {
    return NextResponse.json({ error: 'Payment required to unlock file.' }, { status: 403 });
  }

  // ── Generate signed URL ───────────────────────────────────────────────────
  const finalFileUrl = (project.finalFileUrl as string) ?? '';

  if (finalFileUrl.startsWith('finals://')) {
    const filename = finalFileUrl.replace('finals://', '');
    const { data: signedData, error: signedError } = await supabase.storage
      .from('finals')
      .createSignedUrl(filename, 3600);

    if (signedError || !signedData) {
      return NextResponse.json({ error: 'Failed to generate download link.' }, { status: 500 });
    }

    return NextResponse.json({ signedUrl: signedData.signedUrl });
  }

  // Mock/legacy project
  const signedUrl = `/mock-download/${projectId}?expires=${Date.now() + 3_600_000}&signature=mock-sig`;
  return NextResponse.json({ signedUrl });
}
