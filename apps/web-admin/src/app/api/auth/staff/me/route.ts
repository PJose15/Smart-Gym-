import { NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';

export async function GET() {
  try {
    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;

    const { admin, user_id, gym_id, role } = result;

    // Fetch profile info
    const { data: profile } = await admin
      .from('users')
      .select('email, full_name, avatar_url')
      .eq('id', user_id)
      .single();

    // Fetch gym info
    const { data: gym } = await admin
      .from('gyms')
      .select('id, name, slug, logo_url')
      .eq('id', gym_id)
      .single();

    return NextResponse.json({
      user_id,
      gym_id,
      role,
      full_name: profile?.full_name ?? '',
      email: profile?.email ?? '',
      avatar_url: profile?.avatar_url ?? null,
      gym: gym ?? null,
    });
  } catch (err) {
    console.error('[staff/me] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
