import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rateLimit';
import { getCoachingInsight, GeminiProvider } from '@nexera/ai-assist';

const gemini = new GeminiProvider();

export async function POST(req: NextRequest) {
  try {
    const { member_id, message } = await req.json();
    if (!member_id || !message) {
      return NextResponse.json({ error: 'member_id and message required' }, { status: 400 });
    }

    const rl = checkRateLimit(`ai-chat:${member_id}`, 10, 60_000);
    if (rl) return rl;

    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify member
    const { data: member } = await admin
      .from('members')
      .select('id, user_id, gym_id, display_name, primary_goal, experience_level')
      .eq('id', member_id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Store user message
    await admin.from('ai_coaching_sessions').insert({
      member_id,
      gym_id: member.gym_id,
      message_role: 'user',
      message_text: message,
    });

    // Fetch recent workout data for coaching context (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentSessions } = await admin
      .from('workout_sessions')
      .select('id, session_date, completed_at, total_volume_lbs, is_personal_best')
      .eq('member_id', member_id)
      .gte('session_date', thirtyDaysAgo.toISOString().slice(0, 10))
      .order('session_date', { ascending: false })
      .limit(30);

    const sessions = recentSessions ?? [];

    // Build CoachingInput
    const workouts = sessions.map((s) => ({
      id: s.id,
      started_at: s.session_date,
      finished_at: s.completed_at,
      exercises: [] as Array<{ exercise_name: string; sets: Array<{ weight_kg: number; reps: number }> }>,
    }));

    const prs = sessions
      .filter((s) => s.is_personal_best)
      .map((s) => ({ exercise_name: 'workout session' }));

    const completedWorkoutDates = sessions.map((s) => s.session_date);

    // Generate AI coaching insight
    const insight = await getCoachingInsight(
      {
        memberName: member.display_name || 'Member',
        workouts,
        prs,
        feedbackTrends: { discomfort_count: 0, unstable_count: 0, ok_count: sessions.length },
        completedWorkoutDates,
      },
      gemini,
    );

    // Store AI response
    await admin.from('ai_coaching_sessions').insert({
      member_id,
      gym_id: member.gym_id,
      message_role: 'assistant',
      message_text: insight.message,
    });

    return NextResponse.json({
      response: insight.message,
      action_items: insight.action_items,
      source: insight.source,
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
