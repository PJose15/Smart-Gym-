import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rateLimit';

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
      .select('id, user_id, display_name, primary_goal, experience_level')
      .eq('id', member_id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Get recent performance (14 days)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const { data: recentSessions } = await admin
      .from('workout_sessions')
      .select('session_date, total_volume_lbs, is_personal_best, machine_id')
      .eq('member_id', member_id)
      .gte('created_at', twoWeeksAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    const context = `Member: ${member.display_name || 'User'}, Goal: ${member.primary_goal || 'general'}, Level: ${member.experience_level || 'beginner'}. Recent sessions (14d): ${recentSessions?.length ?? 0} workouts.`;

    // Store chat and return placeholder (AI integration requires OpenAI key)
    const { data: chatRecord } = await admin
      .from('ai_coaching_sessions')
      .insert({
        member_id,
        message,
        context_summary: context,
        response: 'AI coaching response will be generated when OpenAI integration is configured.',
        model: 'gpt-4o',
      })
      .select('id, response')
      .single();

    return NextResponse.json({
      session_id: chatRecord?.id,
      response: chatRecord?.response ?? 'AI service unavailable.',
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
