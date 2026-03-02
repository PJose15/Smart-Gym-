-- 022_hardening_round2.sql
-- Deployment Hardening Round 2 — DB fixes

-- C7: Add 'badge_unlocked' to the points_reason enum so badge point inserts don't fail
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'badge_unlocked'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'points_reason')
  ) THEN
    ALTER TYPE points_reason ADD VALUE 'badge_unlocked';
  END IF;
END$$;

-- C8: Ensure notification_log.data is NOT NULL (edge function always passes {})
ALTER TABLE notification_log ALTER COLUMN data SET DEFAULT '{}'::jsonb;
ALTER TABLE notification_log ALTER COLUMN data SET NOT NULL;
