import { NextResponse } from 'next/server';
import { db } from '@/lib/mocks/db';

export async function POST(request: Request, { params }: { params: { uuid: string } }) {
  const { uuid } = await params;
  
  const project = db.getProject(uuid);
  
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Simulate Razorpay Webhook: Update status to paid
  db.updateProjectStatus(uuid, 'paid');
  
  // Increment freelancer deal count
  db.incrementDealCount('freelancer_1');

  return NextResponse.json({ success: true, status: 'paid' });
}
