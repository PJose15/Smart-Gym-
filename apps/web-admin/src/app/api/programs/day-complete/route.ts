import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { checkRateLimit } from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const member_id = params.get('member_id');
    const gym_id = params.get('gym_id');
    const program_id = params.get('program_id');
    const rawWeek = params.get('week_number');
    const rawDay = params.get('day_number');
    const week_number = rawWeek ? Number(rawWeek) : NaN;
    const day_number = rawDay ? Number(rawDay) : NaN;

    if (
      !member_id || !gym_id || !program_id ||
      !Number.isInteger(week_number) || week_number < 1 ||
      !Number.isInteger(day_number) || day_number < 1
    ) {
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
    }

    // Rate limit: 30 requests per minute per member
    const rl = checkRateLimit(`day-complete:${member_id}`, 30, 60_000);
    if (rl) return rl;

    const auth = await verifyMember(member_id);
    if (auth instanceof NextResponse) return auth;

    const { admin } = auth;

    // Verify member belongs to this gym
    const { data: membership } = await admin
      .from('members')
      .select('id')
      .eq('id', member_id)
      .eq('gym_id', gym_id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Fetch program row — scoped to this member
    const { data: program, error: progErr } = await admin
      .from('ai_programs')
      .select('program_data, sessions_per_week, duration_weeks')
      .eq('id', program_id)
      .eq('member_id', member_id)
      .maybeSingle();

    if (progErr) {
      console.error('day-complete: program fetch error', progErr?.message ?? 'Unknown error');
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
    if (!program) {
      return NextResponse.json({ complete: false });
    }

    const { program_data, sessions_per_week, duration_weeks } = program;
    if (!Array.isArray(program_data?.days) || !sessions_per_week || sessions_per_week < 1) {
      return NextResponse.json({ complete: false });
    }

    // 2. Compute day index
    const dayIndex = (day_number - 1) % sessions_per_week;
    const todayDay = program_data.days[dayIndex];
    if (!todayDay || !Array.isArray(todayDay.exercises)) {
      return NextResponse.json({ complete: false });
    }

    // 3. Extract machine IDs for today
    const todayMachines: string[] = todayDay.exercises
      .map((ex: { machine_id?: string | null }) => ex.machine_id)
      .filter((id: string | null | undefined): id is string => !!id);

    if (todayMachines.length === 0) {
      return NextResponse.json({ complete: false });
    }

    // 4. Query today's workout sessions for these machines
    // Use < tomorrow instead of <= 23:59:59.999 for microsecond safety
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: sessions, error: sessErr } = await admin
      .from('workout_sessions')
      .select('machine_id, total_volume_lbs, is_personal_best')
      .eq('member_id', member_id)
      .eq('gym_id', gym_id)
      .in('machine_id', todayMachines)
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', tomorrow.toISOString());

    if (sessErr) {
      console.error('day-complete: sessions fetch error', sessErr?.message ?? 'Unknown error');
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
    if (!sessions) {
      return NextResponse.json({ complete: false });
    }

    // 5. Check all machines have at least one session
    const completedMachines = new Set(sessions.map((s) => s.machine_id));
    const allDone = todayMachines.every((mid) => completedMachines.has(mid));

    if (!allDone) {
      return NextResponse.json({ complete: false });
    }

    // 6. Aggregate stats
    const machines_count = completedMachines.size;
    const total_volume_lbs = sessions.reduce(
      (sum, s) => sum + (s.total_volume_lbs ?? 0),
      0
    );
    const prs_hit = sessions.filter((s) => s.is_personal_best).length;

    // Compute next session day from program schedule
    const isLastDayOfWeek = dayIndex + 1 >= sessions_per_week;
    const totalWeeks = duration_weeks ?? null;
    const programFinished = isLastDayOfWeek && totalWeeks && week_number >= totalWeeks;

    let next_session_day: string | null = null;
    let is_rest_day = false;

    if (programFinished) {
      // Program complete — no next session
      next_session_day = null;
      is_rest_day = false;
    } else if (isLastDayOfWeek) {
      // Last session of the week → rest days until next week
      next_session_day = `Week ${week_number + 1}, Day 1`;
      is_rest_day = true;
    } else {
      // More sessions this week
      const nextDayNum = day_number + 1;
      next_session_day = `Day ${nextDayNum}`;
      // Rest day between sessions when schedule isn't daily
      is_rest_day = sessions_per_week < 7;
    }

    return NextResponse.json({
      complete: true,
      stats: { machines_count, total_volume_lbs, prs_hit },
      next_session_day,
      is_rest_day,
    });
  } catch (err) {
    console.error('day-complete: unexpected error', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
