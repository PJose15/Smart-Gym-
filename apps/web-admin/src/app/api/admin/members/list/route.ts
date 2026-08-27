import { NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';

/**
 * GET /api/admin/members/list
 * Staff-scoped (trainer/owner) list of gym members for the caller's gym.
 * Returns members joined to their user account (email/display_name) and gym name.
 * The `gym_members` view cannot embed profiles/gyms via PostgREST, so the join
 * is done server-side with the service-role admin client.
 */
export async function GET() {
  const result = await verifyStaff();
  if (result instanceof NextResponse) return result;

  try {
    const { admin, gym_id } = result;

    const [membersRes, gymRes, programsRes, assignRes] = await Promise.all([
      admin
        .from('members')
        .select('id, gym_id, user_id, display_name, email, smartgym_score, onboarding_status, joined_gym_at')
        .eq('gym_id', gym_id)
        .order('joined_gym_at', { ascending: false })
        .limit(500),
      admin.from('gyms').select('id, name').eq('id', gym_id).maybeSingle(),
      admin.from('programs').select('id, name, gym_id').eq('gym_id', gym_id).order('name'),
      admin
        .from('member_program_assignments')
        .select('id, member_id, program_id')
        .order('assigned_at', { ascending: false }),
    ]);

    if (membersRes.error) {
      console.error('[/api/admin/members/list] Members error:', membersRes.error);
      return NextResponse.json({ error: 'Failed to load members' }, { status: 500 });
    }

    const rows = membersRes.data ?? [];

    // Enrich with the linked user account (email / display_name) for members
    // that have a user_id. The `members` row also carries its own email/name,
    // but the `users` account is the source of truth for the display name.
    const userIds = Array.from(
      new Set(rows.map((r) => r.user_id).filter((id): id is string => !!id)),
    );

    const usersById: Record<string, { email: string | null; display_name: string | null }> = {};
    if (userIds.length > 0) {
      const { data: users } = await admin
        .from('users')
        .select('id, email, display_name')
        .in('id', userIds);
      for (const u of users ?? []) {
        usersById[u.id] = { email: u.email, display_name: u.display_name };
      }
    }

    const gymName = gymRes.data?.name ?? '--';

    const members = rows.map((m) => {
      const account = m.user_id ? usersById[m.user_id] : undefined;
      return {
        id: m.id,
        gym_id: m.gym_id,
        user_id: m.user_id,
        display_name: account?.display_name ?? m.display_name ?? 'Unknown',
        email: account?.email ?? m.email ?? null,
        smartgym_score: m.smartgym_score ?? 0,
        onboarding_status: m.onboarding_status,
        joined_at: m.joined_gym_at,
        gym_name: gymName,
      };
    });

    // Program list for this gym (for the per-row assign dropdown).
    const programs = (programsRes.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      gym_id: p.gym_id,
    }));
    const programNames: Record<string, string> = {};
    for (const p of programs) programNames[p.id] = p.name;

    // Scope assignments to this gym's members and attach the program name.
    const memberIds = new Set(rows.map((m) => m.id));
    const assignments = (assignRes.data ?? [])
      .filter((a) => memberIds.has(a.member_id))
      .map((a) => ({
        id: a.id,
        member_id: a.member_id,
        program_id: a.program_id,
        program_name: programNames[a.program_id] ?? 'Program',
      }));

    return NextResponse.json({
      members,
      programs,
      assignments,
      gym: { id: gym_id, name: gymName },
    });
  } catch (err) {
    console.error('[/api/admin/members/list] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
