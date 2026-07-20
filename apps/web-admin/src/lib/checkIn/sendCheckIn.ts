import type { SupabaseClient } from '@supabase/supabase-js';
import { sendNotification } from '@/lib/notifications/dispatcher';

/**
 * Send a check-in to a member: update sent_at and dispatch checkin_generated push.
 * The dispatcher owns the inbox row — no direct notifications.insert here.
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

  // Dispatch via central notification dispatcher (dispatcher writes inbox row)
  await sendNotification({
    gym_id: gymId,
    member_id: memberId,
    type: 'checkin_generated',
    title: 'Your weekly check-in is ready',
    body: 'Your Nexera Coach reviewed your week. Tap to read.',
    data: { check_in_id: checkInId },
  }).catch((err) => {
    console.error('[sendCheckIn] Notification dispatch failed:', err);
  });
}
