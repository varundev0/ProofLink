import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MAX_RETRIES = 5;

const generateUniqueId = async (): Promise<string | null> => {
  const supabase = createSupabaseServiceClient();
  for (let i = 0; i < MAX_RETRIES; i++) {
    let id = 'PRJ-';
    for (let j = 0; j < 4; j++) id += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    const { data } = await supabase.from('projects').select('projectId').eq('projectId', id).single();
    if (!data) return id;
  }
  return null;
};

/**
 * GET /api/projects
 * Returns all projects created by the authenticated freelancer, sorted newest-first.
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized — please sign in.' }, { status: 401 });
    }

    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('freelancerId', user.id);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch projects.' }, { status: 500 });
    }

    const rows = (projects ?? []) as Record<string, unknown>[];

    const sanitized = rows
      .map(({ finalFileUrl: _omit, ...pub }) => pub)
      .sort((a, b) => (b.projectId as string).localeCompare(a.projectId as string));

    const totalEarned = sanitized
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + (p.amount as number), 0);
    const paidCount = sanitized.filter((p) => p.status === 'paid').length;

    return NextResponse.json({ projects: sanitized, totalEarned, paidCount });
  } catch (err) {
    console.error('[GET /api/projects]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/projects
 * Creates a new project for the authenticated freelancer.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized — please sign in.' }, { status: 401 });
    }

    const body = await request.json();
    const { title, amount: rawAmount, proofFileUrl, finalFileUrl } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    }

    const amount = parseFloat(rawAmount);
    if (isNaN(amount) || amount < 1) {
      return NextResponse.json({ error: 'Amount must be a number of at least ₹1.' }, { status: 400 });
    }

    const projectId = await generateUniqueId();
    if (!projectId) {
      return NextResponse.json({ error: 'Could not generate a unique project ID. Please try again.' }, { status: 500 });
    }

    const serviceClient = createSupabaseServiceClient();
    const { error } = await serviceClient.from('projects').insert({
      projectId,
      freelancerEmail: user.email,
      freelancerId: user.id,
      title: title.trim(),
      amount,
      status: 'pending',
      proofFileUrl: proofFileUrl ?? `/mock-proof-${projectId}.jpg`,
      finalFileUrl: finalFileUrl ?? `/mock-final-${projectId}.zip`,
    });

    if (error) {
      console.error('[POST /api/projects]', error);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    return NextResponse.json({ projectId, success: true });
  } catch (error) {
    console.error('[POST /api/projects]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
