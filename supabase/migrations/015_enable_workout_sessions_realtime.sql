-- Migration 015: Enable realtime on workout_sessions for owner dashboard heartbeat (UI_010)
ALTER PUBLICATION supabase_realtime ADD TABLE workout_sessions;
