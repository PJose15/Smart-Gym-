import { NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';

/**
 * GET /api/admin/discomfort
 * Staff-scoped (trainer/owner) safety alerts for the caller's gym.
 *
 * `feedback_discomfort_summary` is own-rows-only under RLS, so staff cannot
 * read it from the client — this route uses the service-role admin client.
 * The summary view has no gym_id, so rows are scoped to the caller's gym by
 * joining `members` on profile_id = members.user_id. Member names come from
 * `users` (the view has no full_name).
 */
export async function GET() {
  const result = await verifyStaff();
  if (result instanceof NextResponse) return result;

  try {
    const { admin, gym_id } = result;

    // Resolve the set of user_ids that belong to this gym.
    const { data: gymMembers, error: membersError } = await admin
      .from('members')
      .select('user_id')
      .eq('gym_id', gym_id)
      .not('user_id', 'is', null);

    if (membersError) {
      console.error('[/api/admin/discomfort] Members error:', membersError);
      return NextResponse.json({ error: 'Failed to load members' }, { status: 500 });
    }

    const gymUserIds = Array.from(
      new Set((gymMembers ?? []).map((m) => m.user_id).filter((id): id is string => !!id)),
    );

    if (gymUserIds.length === 0) {
      return NextResponse.json({ rows: [] });
    }

    const { data: summary, error: summaryError } = await admin
      .from('feedback_discomfort_summary')
      .select('profile_id, discomfort_count_7d, top_body_areas_7d, updated_at')
      .in('profile_id', gymUserIds)
      .gte('discomfort_count_7d', 2)
      .order('discomfort_count_7d', { ascending: false });

    if (summaryError) {
      console.error('[/api/admin/discomfort] Summary error:', summaryError);
      return NextResponse.json({ error: 'Failed to load safety data' }, { status: 500 });
    }

    const summaryRows = summary ?? [];
    const profileIds = summaryRows.map((r) => r.profile_id);

    const namesById: Record<string, string> = {};
    if (profileIds.length > 0) {
      const { data: users } = await admin
        .from('users')
        .select('id, display_name, email')
        .in('id', profileIds);
      for (const u of users ?? []) {
        namesById[u.id] = u.display_name ?? u.email ?? 'Unknown';
      }
    }

    const rows = summaryRows.map((r) => ({
      profile_id: r.profile_id,
      full_name: namesById[r.profile_id] ?? 'Unknown',
      discomfort_count_7d: r.discomfort_count_7d ?? 0,
      top_body_areas_7d: r.top_body_areas_7d ?? [],
      updated_at: r.updated_at,
    }));

    return NextResponse.json({ rows });
  } catch (err) {
    console.error('[/api/admin/discomfort] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
