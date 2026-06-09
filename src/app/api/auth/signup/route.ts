import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      // Return a generic message to prevent email enumeration
      return NextResponse.json({ error: 'Could not create account. Please try again.' }, { status: 400 });
    }

    const user = data.user;
    if (!user) {
      return NextResponse.json({ error: 'Sign up failed. Please try again.' }, { status: 500 });
    }

    // @supabase/ssr automatically writes the session cookie via the cookie handler
    return NextResponse.json({ user: { id: user.id, email: user.email }, success: true });
  } catch (err) {
    console.error('[POST /api/auth/signup]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
