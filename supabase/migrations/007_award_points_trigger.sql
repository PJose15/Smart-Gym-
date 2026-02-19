-- 007: Auto-award 50 points when a workout is marked completed.
--
-- Design notes:
--   • ON CONFLICT DO NOTHING relies on the UNIQUE(reference_id, reason)
--     constraint added in migration 006, keeping this idempotent.
--   • The client-side awardPoints() call in workout/complete/[id].tsx
--     will silently no-op on the duplicate — no double-awarding.
--   • IS DISTINCT FROM handles the edge case where OLD.status is NULL
--     (e.g. first update on a freshly-inserted row).
--   • SECURITY DEFINER + fixed search_path ensures the trigger fires
--     regardless of the calling user's RLS context.

CREATE OR REPLACE FUNCTION award_workout_points()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    INSERT INTO public.points_ledger
      (gym_id, profile_id, points, reason, reference_id)
    VALUES
      (NEW.gym_id, NEW.profile_id, 50, 'workout_completed', NEW.id)
    ON CONFLICT (reference_id, reason) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_award_workout_points
  AFTER UPDATE ON workouts
  FOR EACH ROW
  EXECUTE FUNCTION award_workout_points();
