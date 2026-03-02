/**
 * App event tracking — provider-agnostic.
 * Logs events to the app_events Supabase table.
 */
import { supabase } from './supabase';

export type EventName =
  | 'qr_scanned'
  | 'machine_viewed'
  | 'workout_started'
  | 'set_logged'
  | 'workout_finished'
  | 'ai_next_set_shown'
  | 'ai_next_set_applied'
  | 'ai_summary_viewed'
  | 'ai_cues_viewed'
  | 'push_token_registered'
  | 'push_notification_tapped'
  | 'push_permission_denied';

/**
 * Track an app event. Fire-and-forget (does not block UI).
 */
export function trackEvent(
  eventName: EventName,
  props?: Record<string, unknown>,
  context?: { gymId?: string; profileId?: string },
): void {
  // Fire-and-forget — never block UI
  (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // skip if not authenticated

      await supabase.from('app_events').insert({
        gym_id: context?.gymId ?? null,
        profile_id: context?.profileId ?? user.id,
        event_name: eventName,
        event_props: props ?? {},
      });
    } catch (err) {
      console.warn('[events]', err);
    }
  })();
}
