import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkoutShareContext, WorkoutShareResults } from '@nexera/types';

/**
 * Create a workout share post in the feed + share log.
 * Returns the feed event ID.
 */
export async function createWorkoutSharePost(
  memberId: string,
  gymId: string,
  shareText: string,
  programContext: WorkoutShareContext | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<string | null> {
  // Get member display name
  const { data: member } = await admin
    .from('members')
    .select('display_name')
    .eq('id', memberId)
    .single();

  const name = member?.display_name ?? 'Member';
  const today = new Date().toISOString().split('T')[0];

  // Check if already shared today
  const { data: existing } = await admin
    .from('workout_share_log')
    .select('id')
    .eq('member_id', memberId)
    .eq('shared_at', today)
    .maybeSingle();

  if (existing) return null; // already shared today

  // Create feed event
  const contextData: WorkoutShareContext = programContext ?? {
    share_status: 'training',
    program_week: null,
    program_day: null,
    program_focus: null,
    sessions_completed_today: 0,
    prs_hit: 0,
    volume_lbs: 0,
    machines_used: [],
  };

  const { data: event } = await admin
    .from('gym_feed_events')
    .insert({
      gym_id: gymId,
      member_id: memberId,
      event_type: 'workout_share',
      display_text: shareText || `${name} is training today`,
      context_data: contextData,
      priority: 'low',
    })
    .select('id')
    .single();

  if (!event) return null;

  // Create share log entry
  await admin.from('workout_share_log').insert({
    member_id: memberId,
    gym_id: gymId,
    event_id: event.id,
    shared_at: today,
    status: 'training',
  });

  return event.id;
}

/**
 * Update a workout share post with session results.
 */
export async function updateWorkoutSharePost(
  eventId: string,
  memberId: string,
  sessionResults: WorkoutShareResults,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, 'public', any>
): Promise<void> {
  // Get existing event
  const { data: event } = await admin
    .from('gym_feed_events')
    .select('id, context_data, display_text')
    .eq('id', eventId)
    .eq('member_id', memberId)
    .eq('event_type', 'workout_share')
    .single();

  if (!event) return;

  const existing = (event.context_data ?? {}) as Record<string, unknown>;

  // Update context with results
  const updatedContext: WorkoutShareContext = {
    ...(existing as unknown as WorkoutShareContext),
    share_status: 'completed',
    sessions_completed_today: sessionResults.sessionsToday,
    prs_hit: sessionResults.prsHit,
    volume_lbs: sessionResults.totalVolume,
    machines_used: sessionResults.machinesUsed,
    completed_at: new Date().toISOString(),
  };

  // Build updated display text from member name, not string replacement
  const { data: memberData } = await admin
    .from('members')
    .select('display_name')
    .eq('id', memberId)
    .single();
  const memberName = memberData?.display_name ?? 'Member';

  const parts: string[] = [];
  if (sessionResults.totalVolume > 0) {
    parts.push(`${sessionResults.totalVolume.toLocaleString()} lbs`);
  }
  if (sessionResults.prsHit > 0) {
    parts.push(`${sessionResults.prsHit} PR${sessionResults.prsHit > 1 ? 's' : ''}`);
  }
  const suffix = parts.length > 0 ? ` — ${parts.join(', ')}` : '';
  const displayText = `${memberName} finished training${suffix}`;

  await admin
    .from('gym_feed_events')
    .update({
      display_text: displayText,
      context_data: updatedContext,
    })
    .eq('id', eventId);

  // Update share log status
  const today = new Date().toISOString().split('T')[0];
  await admin
    .from('workout_share_log')
    .update({ status: 'completed' })
    .eq('member_id', memberId)
    .eq('shared_at', today);
}
