import { SupabaseClient } from '@supabase/supabase-js';

interface FeedGeneratorInput {
  member_id: string;
  gym_id: string;
  display_name: string;
  /**
   * PR fields are retained for call-site compatibility but are no longer
   * used — PR feed events are owned by /api/sessions/pr-check.
   */
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

    // display_text is rendered after a bold member-name span by the UI,
    // so producers must NOT prefix the member name here.

    // NOTE: PR events (pr_weight / pr_volume) are intentionally NOT created
    // here. /api/sessions/pr-check is the single owner — it detects PRs at
    // set-log time with full context (machine, previous best, improvement)
    // and enforces the one-PR-event-per-member-per-day dedupe. The PR block
    // that used to live here was always shadowed by pr-check's earlier,
    // info-poorer insert.

    // Streak milestone
    if (STREAK_MILESTONES.includes(input.streak)) {
      events.push({
        gym_id: input.gym_id,
        member_id: input.member_id,
        event_type: 'streak_milestone',
        display_text: `is on a ${input.streak}-day streak!`,
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
        display_text: `completed ${input.total_sessions} sessions!`,
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
        display_text: `reached Level ${input.new_level}!`,
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
