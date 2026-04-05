import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import { validateUUIDs } from '@/lib/validation/uuid';

export async function GET(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const result = await verifyStaff();
    if (result instanceof NextResponse) return result;

    const { admin, gym_id } = result;
    const { memberId } = params;
    const uuidError = validateUUIDs({ memberId });
    if (uuidError) return uuidError;
    const url = new URL(req.url);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50);

    // Fetch all workout_session rows for this member.
    // Each row represents one machine used on a given session_date.
    const { data: rows } = await admin
      .from('workout_sessions')
      .select('id, session_date, sets_count, total_volume_lbs, total_reps, duration_seconds, completed_at, created_at')
      .eq('member_id', memberId)
      .eq('gym_id', gym_id)
      .order('session_date', { ascending: false });

    if (!rows || rows.length === 0) {
      return NextResponse.json([]);
    }

    // Group rows by session_date and aggregate
    const grouped = new Map<string, {
      id: string;
      date: string;
      exercises_count: number;
      total_sets: number;
      total_volume_lbs: number;
      total_duration_seconds: number;
      earliest_created_at: string;
      latest_completed_at: string | null;
      has_incomplete: boolean;
    }>();

    for (const row of rows) {
      const dateKey = row.session_date as string;
      const existing = grouped.get(dateKey);

      if (!existing) {
        grouped.set(dateKey, {
          id: row.id,
          date: dateKey,
          exercises_count: 1,
          total_sets: row.sets_count ?? 0,
          total_volume_lbs: row.total_volume_lbs ?? 0,
          total_duration_seconds: row.duration_seconds ?? 0,
          earliest_created_at: row.created_at,
          latest_completed_at: row.completed_at ?? null,
          has_incomplete: !row.completed_at,
        });
      } else {
        existing.exercises_count += 1;
        existing.total_sets += row.sets_count ?? 0;
        existing.total_volume_lbs += row.total_volume_lbs ?? 0;
        existing.total_duration_seconds += row.duration_seconds ?? 0;

        if (row.created_at < existing.earliest_created_at) {
          existing.earliest_created_at = row.created_at;
          existing.id = row.id;
        }

        if (!row.completed_at) {
          existing.has_incomplete = true;
        } else if (
          !existing.has_incomplete &&
          (!existing.latest_completed_at || row.completed_at > existing.latest_completed_at)
        ) {
          existing.latest_completed_at = row.completed_at;
        }
      }
    }

    // Sort by date descending and paginate
    const aggregated = Array.from(grouped.values()).sort(
      (a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0)
    );

    const paged = aggregated.slice(offset, offset + limit);

    const sessions = paged.map((s) => ({
      id: s.id,
      date: s.date,
      started_at: s.earliest_created_at,
      finished_at: s.has_incomplete ? null : s.latest_completed_at,
      exercises_count: s.exercises_count,
      total_sets: s.total_sets,
      total_volume_lbs: Math.round(s.total_volume_lbs),
      duration_minutes: Math.round(s.total_duration_seconds / 60),
    }));

    return NextResponse.json(sessions);
  } catch (err) {
    console.error('[trainer/members/[memberId]/sessions] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
