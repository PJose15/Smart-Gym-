import { NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';

export async function GET() {
  try {
    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;

    const { admin, user_id, gym_id, role } = result;

    // Fetch profile, gym, gym settings, and assigned-member count in parallel.
    const [profileRes, gymRes, settingsRes, assignedRes] = await Promise.all([
      admin
        .from('users')
        .select('email, display_name, avatar_url, created_at')
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
      admin
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_trainer_id', user_id),
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
      // `users` has no `full_name` column (that alias lives on the `profiles`
      // view); alias `display_name` so clients expecting `full_name` still work.
      full_name: profile?.display_name ?? '',
      email: profile?.email ?? '',
      avatar_url: profile?.avatar_url ?? null,
      created_at: profile?.created_at ?? null,
      gym: gym ?? null,
      gym_name: gym?.name ?? null,
      assigned_members_count: assignedRes.count ?? 0,
      weight_unit,
    });
  } catch (err) {
    console.error('[staff/me] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
