-- 006: Add unique constraint on points_ledger(reference_id, reason)
-- This ensures awardPoints is idempotent — the same workout cannot
-- award the same points reason more than once.

ALTER TABLE points_ledger
  ADD CONSTRAINT points_ledger_reference_reason_unique
  UNIQUE (reference_id, reason);
