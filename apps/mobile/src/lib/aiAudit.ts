/**
 * AI audit logging — logs AI decisions for debugging and improvement.
 */
import { supabase } from './supabase';

export type AuditContext = 'next_set' | 'summary' | 'machine_mistakes';

/**
 * Log an AI decision. Fire-and-forget.
 */
export function logAiDecision(
  context: AuditContext,
  inputs: Record<string, unknown>,
  outputs: Record<string, unknown>,
  gymId?: string,
): void {
  (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: insertErr } = await supabase.from('ai_audit_logs').insert({
        gym_id: gymId ?? null,
        profile_id: user.id,
        context,
        inputs,
        outputs,
      });
      if (insertErr) console.warn('[aiAudit] insert failed:', insertErr.message);
    } catch (err) {
      console.warn('[aiAudit]', err);
    }
  })();
}
