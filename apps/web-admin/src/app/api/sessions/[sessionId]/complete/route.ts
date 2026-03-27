import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const completeSchema = z.object({
  member_id: z.string().uuid(),
});

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * POST /api/sessions/[sessionId]/complete
 * Finalizes a workout session: sets completed_at, awards points,
 * computes streak, updates member stats.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const parsed = completeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { member_id } = parsed.data;
    const admin = getAdminClient();

    // Get the session
    const { data: session, error: sessionError } = await admin
      .from('workout_sessions')
      .select('id, gym_id, member_id, sets_count, total_volume_lbs, best_weight_lbs, is_personal_best, session_date')
      .eq('id', sessionId)
      .eq('member_id', member_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Mark session as completed
    await admin
      .from('workout_sessions')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', sessionId);

    // Award points (50 for workout_completed)
    const points = 50;
    const { data: currentMember } = await admin
      .from('members')
      .select('smartgym_score')
      .eq('id', member_id)
      .single();

    await admin
      .from('members')
      .update({
        smartgym_score: (currentMember?.smartgym_score || 0) + points,
        last_session_date: session.session_date,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', member_id);

    // Compute streak
    const { data: recentSessions } = await admin
      .from('workout_sessions')
      .select('session_date')
      .eq('member_id', member_id)
      .not('completed_at', 'is', null)
      .order('session_date', { ascending: false })
      .limit(30);

    let streak = 1;
    if (recentSessions && recentSessions.length > 1) {
      const dates = [...new Set(recentSessions.map((s) => s.session_date))].sort().reverse();
      for (let i = 1; i < dates.length; i++) {
        const curr = new Date(dates[i - 1]);
        const prev = new Date(dates[i]);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 3) {
          streak++;
        } else {
          break;
        }
      }
    }

    // Update streak on member
    const { data: memberData } = await admin
      .from('members')
      .select('best_streak')
      .eq('id', member_id)
      .single();

    await admin
      .from('members')
      .update({
        current_streak: streak,
        best_streak: Math.max(streak, memberData?.best_streak || 0),
        streak_last_updated: session.session_date,
        last_session_date: session.session_date,
      })
      .eq('id', member_id);

    return NextResponse.json({
      success: true,
      summary: {
        session_id: sessionId,
        sets_count: session.sets_count,
        total_volume_lbs: session.total_volume_lbs,
        best_weight_lbs: session.best_weight_lbs,
        is_personal_best: session.is_personal_best,
        points_awarded: points,
        streak,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
