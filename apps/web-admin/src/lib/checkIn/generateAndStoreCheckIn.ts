import type { SupabaseClient } from '@supabase/supabase-js';
import { gatherCheckInWeekData } from './gatherWeekData';
import { generateAICheckIn } from './generateCheckIn';
import { sendCheckInToMember } from './sendCheckIn';
import { toDateString, getWeekEnd } from './weekDateUtils';

/**
 * Full orchestrator: gather data → generate AI draft → store in DB.
 * Routes based on whether member has a trainer.
 */
export async function generateAndStoreCheckIn(
  memberId: string,
  gymId: string,
  weekStart: Date,
  trainerId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<void> {
  // 1. Gather all data for this week
  const weekData = await gatherCheckInWeekData(memberId, gymId, weekStart, admin);

  // 2. Generate AI draft
  const aiDraft = await generateAICheckIn(weekData);

  // 3. Determine routing
  const needsTrainerReview = trainerId !== null;
  const weekEnd = getWeekEnd(weekStart);

  // 4. Store in database
  const { data: checkIn, error: insertError } = await admin
    .from('weekly_checkins')
    .insert({
      member_id: memberId,
      gym_id: gymId,
      trainer_id: trainerId,
      week_start: toDateString(weekStart),
      week_end: toDateString(weekEnd),
      ai_draft: aiDraft,
      final_message: needsTrainerReview ? null : aiDraft,
      sent_by: needsTrainerReview ? null : 'ai',
      trainer_approved: !needsTrainerReview,
      sent_at: needsTrainerReview ? null : new Date().toISOString(),
      week_data_snapshot: weekData,
      sessions_this_week: weekData.sessions_this_week,
      sessions_last_week: weekData.sessions_last_week,
      total_volume_lbs: weekData.total_volume_lbs,
      prs_this_week: weekData.prs_this_week,
      current_streak: weekData.current_streak,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[generateAndStoreCheckIn] Insert error:', insertError.message);
    return;
  }
  if (!checkIn) return;

  if (needsTrainerReview) {
    // Notify trainer that a check-in is ready for review.
    // In production this would trigger a push notification to the trainer.
    // The trainer sees it in their pending check-ins queue.
    // Look up trainer's member record for notification
    const { data: trainerMember } = await admin
      .from('members')
      .select('id')
      .eq('user_id', trainerId)
      .eq('gym_id', gymId)
      .maybeSingle();

    if (trainerMember) {
      await admin.from('notifications').insert({
        member_id: trainerMember.id,
        gym_id: gymId,
        notification_type: 'coach_note',
        title: 'Check-in ready for review',
        body: `Weekly check-in for ${weekData.member_first_name} is ready to review.`,
        data: {
          check_in_id: checkIn.id,
          member_id: memberId,
        },
        channel: 'in-app',
        status: 'sent',
      });
    }
  } else {
    // Send directly to member (no trainer to review)
    await sendCheckInToMember(checkIn.id, memberId, gymId, admin);
  }
}
