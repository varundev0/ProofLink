import { NextResponse } from 'next/server';
import { db } from '@/lib/mocks/db';

export async function GET(request: Request, { params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  
  const project = db.getProject(uuid);
  
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Fetch freelancer profile for trust score
  const profile = db.getProfile('freelancer_1'); // Hardcoding freelancer ID for MVP

  // Exclude private file URL from response
  const { finalFileUrl, ...publicProjectData } = project;

  return NextResponse.json({
    project: publicProjectData,
    freelancer: profile
  });
}
