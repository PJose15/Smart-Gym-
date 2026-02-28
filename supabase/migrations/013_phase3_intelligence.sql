-- ============================================================================
-- Phase 3: Intelligence — AI Coaching + Smart Program Generation
-- ============================================================================

-- Feature flag for AI coaching
INSERT INTO feature_flags (key, enabled, description)
VALUES ('ai_coaching', true, 'Enable AI-powered coaching insights on home screen and post-workout')
ON CONFLICT (key) WHERE profile_id IS NULL DO NOTHING;

-- Feature flag for AI program generation
INSERT INTO feature_flags (key, enabled, description)
VALUES ('ai_program_gen', true, 'Enable AI-assisted program generation in web admin')
ON CONFLICT (key) WHERE profile_id IS NULL DO NOTHING;

-- Extend ai_audit_log context check to include 'coaching' and 'program_gen'
ALTER TABLE ai_audit_log DROP CONSTRAINT IF EXISTS ai_audit_log_context_check;
ALTER TABLE ai_audit_log ADD CONSTRAINT ai_audit_log_context_check
  CHECK (context IN (
    'next_set', 'summary', 'machine_mistakes', 'today_explanation',
    'alternatives', 'guardrails', 'coach_draft', 'safety_nudge',
    'checklist', 'coaching', 'program_gen'
  ));
