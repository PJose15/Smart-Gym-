-- ═══════════════════════════════════════════════════════════════════
-- Migration 038: schema alignment — gym_members.role + seed copilot flag
-- (AUDIT_2026-08-25 Stage 3: STAFF-C3 role reads, STAFF-C2 flag seed)
-- ═══════════════════════════════════════════════════════════════════
-- The gym_members view is over `members` (all rows are gym members), but
-- several admin pages read/filter a `role` column that the view never had,
-- silently erroring. Add a literal 'member' role so those reads resolve.
-- (Add Member writes move to a verifyStaff API — Stage 1 revoked view writes.)
--
-- Also seed the ai_trainer_copilot flag that the Co-Pilot/Assignments pages
-- gate on — it was never inserted, so those pages showed "not enabled".
--
-- Rollback: restore the 032 view definition; delete the flag row.

CREATE OR REPLACE VIEW gym_members AS
SELECT
  id,
  gym_id,
  user_id AS profile_id,
  smartgym_score,
  onboarding_status,
  joined_gym_at AS joined_at,
  created_at,
  'member'::text AS role
FROM members
WHERE
  auth.jwt()->>'role' = 'service_role'
  OR gym_id = ANY(caller_gym_ids());

-- View inherits base grants; keep it read-only for clients (Stage 1 revoked
-- writes on the prior definition — re-assert after the replace).
REVOKE INSERT, UPDATE, DELETE ON gym_members FROM authenticated, anon;
REVOKE SELECT ON gym_members FROM anon;

INSERT INTO feature_flags (flag_key, is_enabled, description)
VALUES ('ai_trainer_copilot', true, 'AI trainer co-pilot draft inbox')
ON CONFLICT (flag_key) DO NOTHING;
