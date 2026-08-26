-- ═══════════════════════════════════════════════════════════════════
-- Migration 036: close the trainer-message forgery hole (DB-H2 follow-up)
-- ═══════════════════════════════════════════════════════════════════
-- Smoke-testing 034 revealed DB-H2 was only half-fixed. 001's
-- `trainer_messages_trainer FOR ALL USING (trainer_id = auth.uid())` has
-- no "is actually a trainer" check, and for INSERT its USING doubles as
-- WITH CHECK. Because permissive policies are OR'd, a member could set
-- trainer_id = their own uid + sender_type='trainer' and satisfy this
-- policy, forging a trainer message into any member's thread — bypassing
-- the tightened member-send policy from 034.
--
-- Fix: require is_gym_trainer(gym_id) on the trainer policy, and force
-- sender_type='trainer' on trainer inserts. Web-admin uses the service
-- role (bypasses RLS); real trainers satisfy is_gym_trainer, so no
-- legitimate path is affected.
--
-- Rollback: restore 001's `trainer_messages_trainer FOR ALL USING
-- (trainer_id = auth.uid())`.

DROP POLICY IF EXISTS "trainer_messages_trainer" ON trainer_member_messages;

CREATE POLICY "trainer_messages_trainer"
  ON trainer_member_messages FOR ALL
  USING (trainer_id = auth.uid() AND is_gym_trainer(gym_id))
  WITH CHECK (
    trainer_id = auth.uid()
    AND is_gym_trainer(gym_id)
    AND sender_type = 'trainer'
  );
