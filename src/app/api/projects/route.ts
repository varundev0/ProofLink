import { NextResponse } from 'next/server';
import { db } from '@/lib/mocks/db';

const generateShortId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'PRJ-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { freelancerEmail, title, amount } = body;

    if (!freelancerEmail || !title || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const projectId = generateShortId();
    
    db.createProject({
      projectId,
      freelancerEmail,
      title,
      amount: parseFloat(amount),
      status: 'pending',
      proofFileUrl: `/mock-proof-${projectId}.jpg`,
      finalFileUrl: `/mock-final-${projectId}.zip`
    });

    return NextResponse.json({ projectId, success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
