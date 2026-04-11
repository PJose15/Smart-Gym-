import { SupabaseClient } from '@supabase/supabase-js';

interface SessionScoreInput {
  total_volume_lbs: number;
  is_personal_best: boolean;
  machine_id: string | null;
  session_id: string;
}

/**
 * Updates challenge scores for a member after session completion.
 * Fire-and-forget — errors are logged but don't block the response.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateChallengeScores(admin: SupabaseClient<any, 'public', any>, memberId: string, gymId: string, sessionData: SessionScoreInput) {
  try {
    // Find active challenges where this member is a participant
    const { data: participations } = await admin
      .from('challenge_participants')
      .select('id, challenge_id, current_score')
      .eq('member_id', memberId)
      .eq('gym_id', gymId);

    if (!participations || participations.length === 0) return;

    // Get the challenge details (including start_date for date-scoped scoring)
    const challengeIds = participations.map(p => p.challenge_id);
    const { data: challenges } = await admin
      .from('gym_challenges')
      .select('id, challenge_type, gym_id, start_date')
      .in('id', challengeIds)
      .eq('is_active', true);

    if (!challenges || challenges.length === 0) return;

    const challengeMap = new Map(challenges.map(c => [c.id, c]));

    for (const participation of participations) {
      const challenge = challengeMap.get(participation.challenge_id);
      if (!challenge) continue;

      let scoreIncrement = 0;
      // For streak challenges, score is set directly (not incremented)
      let directScore: number | undefined;

      switch (challenge.challenge_type) {
        case 'volume':
          scoreIncrement = sessionData.total_volume_lbs;
          break;
        case 'sessions':
          scoreIncrement = 1;
          break;
        case 'pr':
          scoreIncrement = sessionData.is_personal_best ? 1 : 0;
          break;
        case 'streak': {
          // For streak challenges, set score to current streak value
          const { data: member } = await admin
            .from('members')
            .select('current_streak')
            .eq('id', memberId)
            .single();
          if (member) {
            directScore = member.current_streak;
            await admin
              .from('challenge_participants')
              .update({
                current_score: directScore,
                updated_at: new Date().toISOString(),
              })
              .eq('id', participation.id);
          }
          break;
        }
        case 'machine_explorer': {
          // Check if this machine was already used in prior sessions within the challenge date range
          if (!sessionData.machine_id) break;
          let priorQuery = admin
            .from('workout_sessions')
            .select('id')
            .eq('member_id', memberId)
            .eq('machine_id', sessionData.machine_id)
            .neq('id', sessionData.session_id)
            .not('completed_at', 'is', null);
          // Scope to challenge start_date if available
          if (challenge.start_date) {
            priorQuery = priorQuery.gte('session_date', challenge.start_date);
          }
          const { data: priorSessions } = await priorQuery.limit(1);
          if (!priorSessions || priorSessions.length === 0) {
            scoreIncrement = 1;
          }
          break;
        }
        default:
          // team, custom — skip
          continue;
      }

      // Determine the effective new score
      let newScore: number;
      if (directScore !== undefined) {
        // Streak: score was set directly, proceed to re-ranking
        newScore = directScore;
      } else {
        if (scoreIncrement <= 0) continue;
        newScore = Number(participation.current_score) + scoreIncrement;

        await admin
          .from('challenge_participants')
          .update({
            current_score: newScore,
            updated_at: new Date().toISOString(),
          })
          .eq('id', participation.id);
      }

      // Update top_score if new high
      const { data: challengeData } = await admin
        .from('gym_challenges')
        .select('top_score')
        .eq('id', participation.challenge_id)
        .single();

      if (challengeData && newScore > Number(challengeData.top_score)) {
        await admin
          .from('gym_challenges')
          .update({ top_score: newScore })
          .eq('id', participation.challenge_id);
      }

      // Re-rank all participants for this challenge (batch update)
      const { data: allParticipants } = await admin
        .from('challenge_participants')
        .select('id, member_id, current_score')
        .eq('challenge_id', participation.challenge_id)
        .order('current_score', { ascending: false });

      if (allParticipants && allParticipants.length > 0) {
        // Batch rank update: build case-based SQL via RPC, or update all at once
        // Group by new rank and update in a single call per rank-change
        const rankUpdates: { id: string; rank: number }[] = allParticipants.map(
          (p, i) => ({ id: p.id, rank: i + 1 })
        );

        // Use Promise.all for parallel updates instead of sequential
        await Promise.all(
          rankUpdates.map(({ id, rank }) =>
            admin
              .from('challenge_participants')
              .update({ current_rank: rank })
              .eq('id', id)
          )
        );

        // Find this member's new rank for milestone checks
        const myRank = rankUpdates.find(
          (r) => allParticipants[r.rank - 1]?.member_id === memberId
        )?.rank;

        if (myRank && newScore > 0) {
          if (myRank === 1) {
            const { data: existingMilestone } = await admin
              .from('challenge_milestone_log')
              .select('id')
              .eq('challenge_id', participation.challenge_id)
              .eq('member_id', memberId)
              .eq('milestone_type', 'rank_1')
              .maybeSingle();

            if (!existingMilestone) {
              await Promise.all([
                admin.from('challenge_milestone_log').insert({
                  challenge_id: participation.challenge_id,
                  member_id: memberId,
                  milestone_type: 'rank_1',
                  new_rank: 1,
                }),
                admin.from('gym_feed_events').insert({
                  gym_id: gymId,
                  member_id: memberId,
                  event_type: 'challenge_rank_1',
                  display_text: 'took the #1 spot!',
                  context_data: { challenge_id: participation.challenge_id },
                  priority: 'high',
                }),
              ]);
            }
          } else if (myRank <= 3) {
            const { data: existingPodium } = await admin
              .from('challenge_milestone_log')
              .select('id')
              .eq('challenge_id', participation.challenge_id)
              .eq('member_id', memberId)
              .eq('milestone_type', 'podium')
              .eq('new_rank', myRank)
              .maybeSingle();

            if (!existingPodium) {
              await admin.from('challenge_milestone_log').insert({
                challenge_id: participation.challenge_id,
                member_id: memberId,
                milestone_type: 'podium',
                new_rank: myRank,
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[challengeScoring] Error updating challenge scores:', err);
  }
}
