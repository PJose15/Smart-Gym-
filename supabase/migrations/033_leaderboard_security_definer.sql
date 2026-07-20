-- 033 (renumbered from 031 — collided with 031_notification_receipts_cron): get_leaderboard runs as SECURITY DEFINER.
--
-- The function was SECURITY INVOKER, so callers using a member JWT (the
-- mobile app queries it directly) only saw their own rows under RLS and
-- got a single-entry leaderboard, while the web API (service role)
-- ranked the whole gym. Leaderboards are gym-visible by design and the
-- function exposes only member ids and point totals for one gym, so the
-- standard DEFINER pattern applies. search_path pinned per security
-- best practice. Applied to the linked project directly on 2026-07-20.

alter function public.get_leaderboard(uuid, timestamp with time zone, integer)
  security definer
  set search_path = public;
