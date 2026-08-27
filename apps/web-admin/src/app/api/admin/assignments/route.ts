import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { uuidString } from '@/lib/validation/uuid';

/**
 * Staff-scoped trainer_assignments management for the caller's gym.
 *
 * trainer_assignments.trainer_profile_id / member_profile_id both reference
 * users(id). Trainers/owners come from gym_memberships; members come from the
 * `members` table (user_id). Names live on `users` (display_name) — the
 * `gym_members` view cannot embed profiles, so all joins are done server-side
 * with the service-role admin client. RLS on trainer_assignments restricts a
 * trainer to their own rows, so mutations also go through the admin client.
 */

interface Person {
  id: string; // users.id
  name: string;
  role: 'trainer' | 'owner' | 'member';
}

async function loadGymPeople(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  gymId: string,
): Promise<{ trainers: Person[]; members: Person[]; namesById: Record<string, string> }> {
  const [staffRes, memberRes] = await Promise.all([
    admin
      .from('gym_memberships')
      .select('user_id, role')
      .eq('gym_id', gymId)
      .eq('status', 'active')
      .in('role', ['trainer', 'owner']),
    admin
      .from('members')
      .select('user_id')
      .eq('gym_id', gymId)
      .not('user_id', 'is', null),
  ]);

  const staffRows: { user_id: string; role: 'trainer' | 'owner' }[] = staffRes.data ?? [];
  const memberRows: { user_id: string }[] = memberRes.data ?? [];

  const allIds = Array.from(
    new Set([
      ...staffRows.map((r) => r.user_id),
      ...memberRows.map((r) => r.user_id),
    ].filter((id): id is string => !!id)),
  );

  const namesById: Record<string, string> = {};
  if (allIds.length > 0) {
    const { data: users } = await admin
      .from('users')
      .select('id, display_name, email')
      .in('id', allIds);
    for (const u of users ?? []) {
      namesById[u.id] = u.display_name ?? u.email ?? 'Unknown';
    }
  }

  const trainers: Person[] = staffRows.map((r) => ({
    id: r.user_id,
    name: namesById[r.user_id] ?? 'Unknown',
    role: r.role,
  }));

  const members: Person[] = memberRows
    .filter((r) => !!r.user_id)
    .map((r) => ({
      id: r.user_id,
      name: namesById[r.user_id] ?? 'Unknown',
      role: 'member' as const,
    }));

  return { trainers, members, namesById };
}

export async function GET() {
  const result = await verifyStaff();
  if (result instanceof NextResponse) return result;

  try {
    const { admin, gym_id } = result;

    const [assignRes, people, gymRes] = await Promise.all([
      admin
        .from('trainer_assignments')
        .select('id, gym_id, trainer_profile_id, member_profile_id, status, created_at')
        .eq('gym_id', gym_id)
        .order('created_at', { ascending: false })
        .limit(500),
      loadGymPeople(admin, gym_id),
      admin.from('gyms').select('id, name').eq('id', gym_id).maybeSingle(),
    ]);

    if (assignRes.error) {
      console.error('[/api/admin/assignments] List error:', assignRes.error);
      return NextResponse.json({ error: 'Failed to load assignments' }, { status: 500 });
    }

    const gymName = gymRes.data?.name ?? '--';
    const { namesById } = people;

    const assignments = (assignRes.data ?? []).map((a: {
      id: string; gym_id: string; trainer_profile_id: string;
      member_profile_id: string; status: string; created_at: string;
    }) => ({
      ...a,
      gym_name: gymName,
      trainer_name: namesById[a.trainer_profile_id] ?? 'Unknown',
      member_name: namesById[a.member_profile_id] ?? 'Unknown',
    }));

    return NextResponse.json({
      assignments,
      trainers: people.trainers,
      members: people.members,
      gym: { id: gym_id, name: gymName },
    });
  } catch (err) {
    console.error('[/api/admin/assignments] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const createSchema = z.object({
  trainer_profile_id: uuidString,
  member_profile_id: uuidString,
});

export async function POST(request: NextRequest) {
  const result = await verifyStaff();
  if (result instanceof NextResponse) return result;

  try {
    const { admin, gym_id } = result;

    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 },
      );
    }

    const { trainer_profile_id, member_profile_id } = parsed.data;

    // Validate both parties belong to the caller's gym.
    const { trainers, members } = await loadGymPeople(admin, gym_id);
    if (!trainers.some((t) => t.id === trainer_profile_id)) {
      return NextResponse.json({ error: 'Trainer is not part of your gym.' }, { status: 400 });
    }
    if (!members.some((m) => m.id === member_profile_id)) {
      return NextResponse.json({ error: 'Member is not part of your gym.' }, { status: 400 });
    }

    const { data: inserted, error: insertError } = await admin
      .from('trainer_assignments')
      .insert({ gym_id, trainer_profile_id, member_profile_id })
      .select('id, gym_id, trainer_profile_id, member_profile_id, status, created_at')
      .single();

    if (insertError || !inserted) {
      console.error('[/api/admin/assignments] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
    }

    return NextResponse.json({ assignment: inserted });
  } catch (err) {
    console.error('[/api/admin/assignments] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
