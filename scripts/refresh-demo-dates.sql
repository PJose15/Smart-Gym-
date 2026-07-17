-- ═══════════════════════════════════════════════════════════════════════════════
-- NEXERA DEMO — WEEKLY FRESHNESS REFRESH (DOC_04 Section 20)
-- Run weekly (or right before any demo) to keep demo timestamps realistic:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -f scripts/refresh-demo-dates.sql
--
-- Adaptations from the DOC_04 draft to the real schema:
--   * members has last_session_date (date), not last_session_at; there is no
--     'at_risk' status value — at-risk is derived from date age, so only the
--     dates are refreshed.
--   * UPDATE ... ORDER BY ... LIMIT 1 (spec draft) is not valid Postgres —
--     replaced with an id-subquery.
--   * Fresh feed events use display_text WITHOUT the member-name prefix
--     (the UI renders the bold name separately) and md5-per-day ids so
--     running twice on the same day does not duplicate them.
--   * RAISE NOTICE only works inside DO blocks.
-- Idempotent per day. Never run against production.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1) Pin the at-risk cohort to exactly 16-24 days of inactivity
--    (Ana = 16 days; bulk at-risk members 38-44 fan out behind her)
UPDATE public.members
SET last_session_date = CURRENT_DATE - 16,
    last_seen_at      = NOW() - INTERVAL '16 days'
WHERE gym_id = '00000000-0000-0000-0000-000000000001'
  AND id = '00000000-0000-0000-0001-000000000004';   -- Ana Pérez

DO $$
DECLARE
  i integer;
BEGIN
  FOR i IN 38..44 LOOP
    UPDATE public.members
    SET last_session_date = CURRENT_DATE - (16 + (i - 37)),
        last_seen_at      = NOW() - ((16 + (i - 37)) || ' days')::interval
    WHERE gym_id = '00000000-0000-0000-0000-000000000001'
      AND id = ('00000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid;
  END LOOP;
END $$;

-- Keep their most recent session in the matching window so
-- get_at_risk_members() agrees with the member row
UPDATE public.workout_sessions ws
SET session_date = m.last_session_date,
    completed_at = m.last_session_date::timestamptz + INTERVAL '18 hours',
    created_at   = m.last_session_date::timestamptz + INTERVAL '17 hours'
FROM public.members m
WHERE m.gym_id = '00000000-0000-0000-0000-000000000001'
  AND ws.member_id = m.id
  AND (m.id = '00000000-0000-0000-0001-000000000004'
       OR m.id IN (
         SELECT ('00000000-0000-0000-0001-' || lpad(g::text, 12, '0'))::uuid
         FROM generate_series(38, 44) g))
  AND ws.id = (
    SELECT id FROM public.workout_sessions
    WHERE member_id = m.id
    ORDER BY session_date DESC, created_at DESC
    LIMIT 1
  )
  AND ws.session_date > m.last_session_date;

-- 2) Ensure Carlos trained YESTERDAY (active demo state, no session today).
--    Spec draft used UPDATE ... ORDER BY ... LIMIT 1 — invalid; id-subquery used.
UPDATE public.workout_sessions
SET session_date = CURRENT_DATE - 1,
    completed_at = NOW() - INTERVAL '18 hours',
    created_at   = NOW() - INTERVAL '19 hours'
WHERE id = (
  SELECT id FROM public.workout_sessions
  WHERE member_id = '00000000-0000-0000-0001-000000000003'
    AND completed_at IS NOT NULL
  ORDER BY session_date DESC, created_at DESC
  LIMIT 1
);

-- Remove any Carlos session dated today (Scenario B needs a clean TodayZone)
DELETE FROM public.workout_sessions
WHERE member_id = '00000000-0000-0000-0001-000000000003'
  AND session_date = CURRENT_DATE;

UPDATE public.members
SET last_session_date = CURRENT_DATE - 1,
    last_seen_at      = NOW() - INTERVAL '18 hours'
WHERE id = '00000000-0000-0000-0001-000000000003';

-- 3) Fresh feed events in the last 24h so the feed feels live
--    (md5 ids keyed by date → idempotent per day)
INSERT INTO public.gym_feed_events (id, gym_id, member_id, event_type, display_text, context_data, priority, created_at)
VALUES
  (md5('nx-refresh-pr-' || CURRENT_DATE)::uuid,
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0001-000000000001',
   'pr_weight',
   'hit a new personal best on Lat Pulldown — 215 lbs!',
   '{"machine_name": "Lat Pulldown", "best_weight_lbs": 215, "previous_best_lbs": 210, "unit": "lbs"}',
   'high',
   NOW() - INTERVAL '3 hours'),
  (md5('nx-refresh-share-' || CURRENT_DATE)::uuid,
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0001-000000000002',
   'workout_share',
   'is training right now 💪',
   '{"share_status": "training", "machine_name": "Chest Press Machine"}',
   'low',
   NOW() - INTERVAL '5 hours')
ON CONFLICT (id) DO NOTHING;

-- 4) Refresh today's readiness cache date anchor for recently-active members
INSERT INTO public.member_readiness_cache (
  member_id, gym_id, cache_date, score, zone, result_json, inputs_json, dominant_signal
)
SELECT member_id, gym_id, CURRENT_DATE, score, zone, result_json, inputs_json, dominant_signal
FROM public.member_readiness_cache mrc
WHERE mrc.gym_id = '00000000-0000-0000-0000-000000000001'
  AND mrc.cache_date = (
    SELECT MAX(cache_date) FROM public.member_readiness_cache x
    WHERE x.member_id = mrc.member_id
  )
  AND mrc.cache_date < CURRENT_DATE
ON CONFLICT (member_id, cache_date) DO NOTHING;

-- 5) Keep the "happening now" strip alive
UPDATE public.workout_sessions
SET session_date = CURRENT_DATE,
    completed_at = NOW() - INTERVAL '35 minutes',
    created_at   = NOW() - INTERVAL '45 minutes'
WHERE id = md5('nx-sess-live-1')::uuid;

UPDATE public.workout_sessions
SET session_date = CURRENT_DATE,
    completed_at = NOW() - INTERVAL '70 minutes',
    created_at   = NOW() - INTERVAL '80 minutes'
WHERE id = md5('nx-sess-live-2')::uuid;

DO $$ BEGIN
  RAISE NOTICE 'Demo data refreshed successfully';
END $$;
