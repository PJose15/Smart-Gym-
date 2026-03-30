import { NextResponse } from 'next/server';
import { verifyStaff } from '@/lib/auth/verifyStaff';
import type { ActivityFeedItem } from '@nexera/types';

export async function GET() {
  try {
    const result = await verifyStaff('owner');
    if (result instanceof NextResponse) return result;

    const { admin, gym_id } = result;

    // Get recent events from multiple sources
    const [sessionsRes, membersRes, achievementsRes] = await Promise.all([
      // Recent completed sessions
      admin
        .from('workout_sessions')
        .select('id, member_id, session_date, completed_at, created_at, members!inner(display_name)')
        .eq('gym_id', gym_id)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(10),
      // New members (last 7 days)
      admin
        .from('members')
        .select('id, display_name, joined_gym_at')
        .eq('gym_id', gym_id)
        .gte('joined_gym_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .order('joined_gym_at', { ascending: false })
        .limit(5),
      // Recent achievements (uses member_achievements + achievement_definitions)
      admin
        .from('member_achievements')
        .select('id, member_id, earned_at, achievement_code, achievement_definitions!inner(title)')
        .eq('gym_id', gym_id)
        .order('earned_at', { ascending: false })
        .limit(5),
    ]);

    const items: ActivityFeedItem[] = [];

    // Sessions
    (sessionsRes.data ?? []).forEach((s) => {
      const member = s.members as unknown as { display_name: string };
      items.push({
        id: s.id,
        event_type: 'session_completed',
        description: 'Completed a workout session',
        actor_name: member.display_name,
        created_at: s.completed_at ?? s.created_at,
      });
    });

    // New members
    (membersRes.data ?? []).forEach((m) => {
      items.push({
        id: `new-${m.id}`,
        event_type: 'new_member',
        description: 'Joined the gym',
        actor_name: m.display_name,
        created_at: m.joined_gym_at,
      });
    });

    // Achievement unlocks
    (achievementsRes.data ?? []).forEach((a) => {
      const def = a.achievement_definitions as unknown as { title: string };
      items.push({
        id: a.id,
        event_type: 'achievement_earned',
        description: `Earned "${def.title}"`,
        actor_name: null,
        created_at: a.earned_at,
      });
    });

    // Sort by date desc
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json(items.slice(0, 20));
  } catch (err) {
    console.error('[owner/activity] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
