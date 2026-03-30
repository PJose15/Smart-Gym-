import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Send a check-in to a member: update sent_at and create notification.
 */
export async function sendCheckInToMember(
  checkInId: string,
  memberId: string,
  gymId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<void> {
  // Mark as sent
  await admin
    .from('weekly_checkins')
    .update({
      sent_at: new Date().toISOString(),
      trainer_approved: true,
    })
    .eq('id', checkInId);

  // Create in-app notification
  await admin.from('notifications').insert({
    member_id: memberId,
    gym_id: gymId,
    notification_type: 'coach_note',
    title: 'Your weekly check-in is ready',
    body: 'Your Nexera Coach reviewed your week. Tap to read.',
    data: {
      check_in_id: checkInId,
      url: '/program/check-in',
    },
    channel: 'in-app',
    status: 'sent',
  });
}
