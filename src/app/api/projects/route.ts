import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/mocks/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { freelancerEmail, title, amount } = body;

    if (!freelancerEmail || !title || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const uuid = uuidv4();
    
    db.createProject({
      uuid,
      freelancerEmail,
      title,
      amount: parseFloat(amount),
      status: 'pending',
      proofFileUrl: `/mock-proof-${uuid}.jpg`, // Simulating uploaded file URL
      finalFileUrl: `/mock-final-${uuid}.zip`
    });

    return NextResponse.json({ uuid, success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
