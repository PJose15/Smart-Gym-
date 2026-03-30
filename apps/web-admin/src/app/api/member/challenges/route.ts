import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { challengeListSchema } from '@/lib/validation/challenge';
import type { ChallengeListItem } from '@nexera/types';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const parsed = challengeListSchema.safeParse({
      member_id: sp.get('member_id'),
      gym_id: sp.get('gym_id'),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { member_id, gym_id } = parsed.data;

    const auth = await verifyMember(member_id);
    if (auth instanceof NextResponse) return auth;

    const { admin } = auth;

    // Get active + recently completed challenges
    const { data: challenges, error: challengesErr } = await admin
      .from('gym_challenges')
      .select('id, gym_id, title, description, challenge_type, start_date, end_date, is_active, top_score, created_at')
      .eq('gym_id', gym_id)
      .or('is_active.eq.true,completed_at.gte.' + new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false });

    if (challengesErr) {
      return NextResponse.json({ error: 'Failed to load challenges' }, { status: 500 });
    }

    if (!challenges || challenges.length === 0) {
      return NextResponse.json({ challenges: [] });
    }

    // Get member's participations
    const challengeIds = challenges.map(c => c.id);
    const { data: participations } = await admin
      .from('challenge_participants')
      .select('challenge_id, current_score, current_rank')
      .eq('member_id', member_id)
      .in('challenge_id', challengeIds);

    const participationMap = new Map<string, { current_score: number; current_rank: number }>();
    for (const p of participations ?? []) {
      participationMap.set(p.challenge_id, {
        current_score: Number(p.current_score),
        current_rank: p.current_rank,
      });
    }

    // Get participant counts
    const { data: counts } = await admin
      .from('challenge_participants')
      .select('challenge_id')
      .in('challenge_id', challengeIds);

    const countMap = new Map<string, number>();
    for (const c of counts ?? []) {
      countMap.set(c.challenge_id, (countMap.get(c.challenge_id) || 0) + 1);
    }

    const result: ChallengeListItem[] = challenges.map(c => {
      const participation = participationMap.get(c.id);
      const totalParticipants = countMap.get(c.id) || 0;
      const now = new Date();
      const endDate = new Date(c.end_date);
      const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      // Calculate progress percentage
      const startDate = new Date(c.start_date);
      const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const elapsed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const progressPct = Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)));

      return {
        challenge_id: c.id,
        title: c.title,
        rank: participation?.current_rank || 0,
        total_participants: totalParticipants,
        progress_pct: progressPct,
        days_left: daysLeft,
        description: c.description,
        challenge_type: c.challenge_type,
        start_date: c.start_date,
        end_date: c.end_date,
        is_active: c.is_active,
        is_joined: !!participation,
        my_score: participation?.current_score ?? null,
        top_score: Number(c.top_score),
      };
    });

    return NextResponse.json({ challenges: result });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
