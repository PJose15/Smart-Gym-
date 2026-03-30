import { SupabaseClient } from '@supabase/supabase-js';

interface FeedGeneratorInput {
  member_id: string;
  gym_id: string;
  display_name: string;
  is_personal_best: boolean;
  best_weight_lbs: number | null;
  streak: number;
  total_sessions: number;
  leveled_up: boolean;
  new_level: number | null;
}

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
const SESSION_MILESTONES = [10, 25, 50, 100, 250, 500];

/**
 * Generates feed events after a session is completed.
 * Fire-and-forget — errors are logged but don't block the response.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateSessionFeedEvents(admin: SupabaseClient<any, 'public', any>, input: FeedGeneratorInput) {
  try {
    const events: Array<{
      gym_id: string;
      member_id: string;
      event_type: string;
      display_text: string;
      context_data: Record<string, unknown>;
      priority?: string;
    }> = [];

    const name = input.display_name || 'Member';

    // PR event (max 1 per member per day — dedup check)
    if (input.is_personal_best) {
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await admin
        .from('gym_feed_events')
        .select('id')
        .eq('member_id', input.member_id)
        .eq('event_type', 'pr_weight')
        .gte('created_at', `${today}T00:00:00Z`)
        .limit(1);

      if (!existing || existing.length === 0) {
        events.push({
          gym_id: input.gym_id,
          member_id: input.member_id,
          event_type: 'pr_weight',
          display_text: `${name} hit a new personal best${input.best_weight_lbs ? ` — ${input.best_weight_lbs} lbs` : ''}!`,
          context_data: { best_weight_lbs: input.best_weight_lbs },
          priority: 'medium',
        });
      }
    }

    // Streak milestone
    if (STREAK_MILESTONES.includes(input.streak)) {
      events.push({
        gym_id: input.gym_id,
        member_id: input.member_id,
        event_type: 'streak_milestone',
        display_text: `${name} is on a ${input.streak}-day streak!`,
        context_data: { streak: input.streak },
        priority: 'medium',
      });
    }

    // Session milestone
    if (SESSION_MILESTONES.includes(input.total_sessions)) {
      events.push({
        gym_id: input.gym_id,
        member_id: input.member_id,
        event_type: 'session_milestone',
        display_text: `${name} completed ${input.total_sessions} sessions!`,
        context_data: { total_sessions: input.total_sessions },
        priority: 'medium',
      });
    }

    // Level-up
    if (input.leveled_up && input.new_level != null) {
      events.push({
        gym_id: input.gym_id,
        member_id: input.member_id,
        event_type: 'level_up',
        display_text: `${name} reached Level ${input.new_level}!`,
        context_data: { new_level: input.new_level },
        priority: 'high',
      });
    }

    if (events.length > 0) {
      // Insert individually so one CHECK failure doesn't kill the whole batch
      for (const event of events) {
        const { error } = await admin.from('gym_feed_events').insert(event);
        if (error) console.error('[feedGenerator] Insert failed:', error.message);
      }
    }
  } catch (err) {
    console.error('[feedGenerator] Error generating feed events:', err);
  }
}
