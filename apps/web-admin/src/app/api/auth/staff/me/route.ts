import { NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';

export async function GET() {
  try {
    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;

    const { admin, user_id, gym_id, role } = result;

    // Fetch profile, gym, and gym settings in parallel.
    const [profileRes, gymRes, settingsRes] = await Promise.all([
      admin
        .from('users')
        .select('email, full_name, avatar_url')
        .eq('id', user_id)
        .single(),
      admin
        .from('gyms')
        .select('id, name, slug, logo_url')
        .eq('id', gym_id)
        .single(),
      admin
        .from('gym_settings')
        .select('weight_unit')
        .eq('gym_id', gym_id)
        .maybeSingle(),
    ]);

    const profile = profileRes.data;
    const gym = gymRes.data;
    const rawUnit = settingsRes.data?.weight_unit;
    const weight_unit: 'lbs' | 'kg' =
      rawUnit === 'kg' || rawUnit === 'lbs' ? rawUnit : 'lbs';

    return NextResponse.json({
      user_id,
      gym_id,
      role,
      full_name: profile?.full_name ?? '',
      email: profile?.email ?? '',
      avatar_url: profile?.avatar_url ?? null,
      gym: gym ?? null,
      weight_unit,
    });
  } catch (err) {
    console.error('[staff/me] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
