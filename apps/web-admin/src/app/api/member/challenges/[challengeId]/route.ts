import { NextRequest, NextResponse } from 'next/server';
import { verifyMember } from '@/lib/auth/verifyMember';
import { challengeDetailSchema } from '@/lib/validation/challenge';
import type { ChallengeDetail, ChallengeParticipant } from '@nexera/types';
import { validateUUIDs } from '@/lib/validation/uuid';

interface RouteParams {
  params: Promise<{ challengeId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { challengeId } = await params;
    const uuidError = validateUUIDs({ challengeId });
    if (uuidError) return uuidError;
    const sp = request.nextUrl.searchParams;
    const parsed = challengeDetailSchema.safeParse({
      member_id: sp.get('member_id'),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { member_id } = parsed.data;

    const auth = await verifyMember(member_id);
    if (auth instanceof NextResponse) return auth;

    const { admin } = auth;

    // Look up member's gym_id for scoping
    const { data: memberInfo } = await admin
      .from('members')
      .select('gym_id')
      .eq('id', member_id)
      .single();

    if (!memberInfo) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Get challenge — scoped to member's gym to prevent cross-gym data exposure
    const { data: challenge, error: challengeErr } = await admin
      .from('gym_challenges')
      .select(
        'id, title, description, challenge_type, start_date, end_date, is_active, top_score, entry_mode, prize_type, prize_description'
      )
      .eq('id', challengeId)
      .eq('gym_id', memberInfo.gym_id)
      .single();

    if (challengeErr || !challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Get participants with member info
    const { data: participantsRaw } = await admin
      .from('challenge_participants')
      .select('member_id, current_score, current_rank, joined_at')
      .eq('challenge_id', challengeId)
      .order('current_rank', { ascending: true });

    const participantMemberIds = (participantsRaw ?? []).map(p => p.member_id);
    const { data: members } = participantMemberIds.length > 0
      ? await admin
          .from('members')
          .select('id, display_name, avatar_url')
          .in('id', participantMemberIds)
      : { data: [] };

    const memberMap = new Map<string, { display_name: string; avatar_url: string | null }>();
    for (const m of members ?? []) {
      memberMap.set(m.id, { display_name: m.display_name, avatar_url: m.avatar_url });
    }

    const participants: ChallengeParticipant[] = (participantsRaw ?? []).map(p => ({
      member_id: p.member_id,
      display_name: memberMap.get(p.member_id)?.display_name || 'Member',
      avatar_url: memberMap.get(p.member_id)?.avatar_url || null,
      current_score: Number(p.current_score),
      current_rank: p.current_rank,
      joined_at: p.joined_at,
    }));

    const myParticipation = participants.find(p => p.member_id === member_id) || null;

    const now = new Date();
    const endDate = new Date(challenge.end_date);
    const startDate = new Date(challenge.start_date);
    const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const elapsed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const progressPct = Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)));

    const result: ChallengeDetail = {
      challenge_id: challenge.id,
      title: challenge.title,
      rank: myParticipation?.current_rank || 0,
      total_participants: participants.length,
      progress_pct: progressPct,
      days_left: daysLeft,
      description: challenge.description,
      challenge_type: challenge.challenge_type,
      start_date: challenge.start_date,
      end_date: challenge.end_date,
      is_active: challenge.is_active,
      is_joined: !!myParticipation,
      my_score: myParticipation?.current_score ?? null,
      top_score: Number(challenge.top_score),
      entry_mode: challenge.entry_mode,
      prize_type: challenge.prize_type,
      prize_description: challenge.prize_description,
      participants,
      my_participation: myParticipation,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
