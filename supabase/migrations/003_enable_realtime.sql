-- Phase 5F: Enable Supabase Realtime for social tables
ALTER PUBLICATION supabase_realtime ADD TABLE gym_feed_events;
ALTER PUBLICATION supabase_realtime ADD TABLE feed_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE member_leaderboard_positions;
