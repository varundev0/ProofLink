import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Return a generic message to prevent email enumeration
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const user = data.user;

    // @supabase/ssr automatically writes the session cookie via the cookie handler
    return NextResponse.json({ user: { id: user.id, email: user.email }, success: true });
  } catch (err) {
    console.error('[POST /api/auth/signin]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
