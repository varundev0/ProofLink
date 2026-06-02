import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const supabase = createSupabaseServiceClient();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('projectId', projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { data: freelancer } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', project.freelancerId)
    .single();

  // Strip the private final file URL before sending to the client
  const { finalFileUrl: _omit, ...publicProject } = project;

  return NextResponse.json({
    project: publicProject,
    freelancer: freelancer ?? { id: project.freelancerId, deal_count: 0 },
  });
}
