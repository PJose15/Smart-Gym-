-- ============================================================================
-- 019: AI Generate Edge Function Wiring
-- Fixes audit log constraint (013 targeted wrong table name)
-- ============================================================================

-- Migration 013 targeted 'ai_audit_log' (singular) but the table is 'ai_audit_logs' (plural).
-- Drop the potentially-missing constraint and recreate on the correct table.
ALTER TABLE ai_audit_logs DROP CONSTRAINT IF EXISTS ai_audit_log_context_check;
ALTER TABLE ai_audit_logs DROP CONSTRAINT IF EXISTS ai_audit_logs_context_check;
ALTER TABLE ai_audit_logs ADD CONSTRAINT ai_audit_logs_context_check
  CHECK (context IN (
    'next_set', 'summary', 'machine_mistakes', 'today_explanation',
    'alternatives', 'guardrails', 'coach_draft', 'safety_nudge',
    'checklist', 'coaching', 'program_gen', 'rewrite_insight'
  ));
