-- Phase 6D: Enable realtime on trainer_member_messages
-- This allows the trainer portal to receive new messages in real-time.

DO $$
BEGIN
  -- Check if the table is already in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'trainer_member_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE trainer_member_messages;
  END IF;
END $$;
