import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();

    // @supabase/ssr automatically clears the session cookie via the cookie handler
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/auth/signout]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
