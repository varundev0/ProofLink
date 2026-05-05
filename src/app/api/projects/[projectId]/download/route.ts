import { NextResponse } from 'next/server';
import { db } from '@/lib/mocks/db';

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  
  const project = db.getProject(projectId);
  
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (project.status !== 'paid') {
    return NextResponse.json({ error: 'Payment required to unlock file' }, { status: 403 });
  }

  // Simulate Supabase Signed URL logic
  const signedUrl = `/mock-download/${projectId}?expires=${Date.now() + 3600000}&signature=mock-sig`;

  return NextResponse.json({ signedUrl });
}
