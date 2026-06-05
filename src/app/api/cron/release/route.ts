/**
 * GET /api/cron/release
 *
 * Vercel Cron job — runs every hour.
 * Finds all projects with status 'paid' where paidAt is older than 24 hours
 * and transitions them to 'released'.
 *
 * Disputed projects are skipped — they stay frozen until manually resolved.
 *
 * Secured with CRON_SECRET to prevent public invocation.
 * Set CRON_SECRET in Vercel env vars and configure vercel.json to match.
 */

import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { sendFundsReleasedToFreelancer } from '@/lib/email';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Find all paid projects where paidAt is older than 24 hours
  const { data: projects, error } = await supabase
    .from('projects')
    .select('projectId, paidAt, freelancerEmail, title, amount')
    .eq('status', 'paid')
    .lt('paidAt', cutoff);

  if (error) {
    console.error('[cron/release] fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }

  if (!projects || projects.length === 0) {
    return NextResponse.json({ released: 0 });
  }

  const ids = projects.map((p) => p.projectId as string);

  const { error: updateError } = await supabase
    .from('projects')
    .update({ status: 'released' })
    .in('projectId', ids);

  if (updateError) {
    console.error('[cron/release] update error:', updateError);
    return NextResponse.json({ error: 'Failed to release projects' }, { status: 500 });
  }

  // Send release emails fire-and-forget
  for (const project of projects) {
    void sendFundsReleasedToFreelancer({
      freelancerEmail: project.freelancerEmail as string,
      projectTitle: project.title as string,
      amount: project.amount as number,
      projectId: project.projectId as string,
    });
  }

  console.log(`[cron/release] released ${ids.length} project(s):`, ids);
  return NextResponse.json({ released: ids.length, projectIds: ids });
}
