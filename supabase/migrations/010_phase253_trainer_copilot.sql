-- ============================================================
-- Phase 2.5.3: Trainer Co-Pilot
-- ============================================================
-- Adds: trainer_assignments, coach_notes, coach_note_drafts,
--        coach_note_actions, feature flag, indexes, RLS
-- ============================================================

-- ─── A) Trainer Assignments ─────────────────────────────

CREATE TABLE IF NOT EXISTS trainer_assignments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  trainer_profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_trainer_assignment UNIQUE (gym_id, trainer_profile_id, member_profile_id)
);

ALTER TABLE trainer_assignments ENABLE ROW LEVEL SECURITY;

-- Trainers/owners can create assignments in their gym
CREATE POLICY "trainer_assignments_insert"
  ON trainer_assignments FOR INSERT
  WITH CHECK (has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]));

-- Trainers/owners can read assignments in their gym
CREATE POLICY "trainer_assignments_select_staff"
  ON trainer_assignments FOR SELECT
  USING (has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]));

-- Members can read their own assignments
CREATE POLICY "trainer_assignments_select_member"
  ON trainer_assignments FOR SELECT
  USING (member_profile_id = auth.uid());

-- Trainers/owners can update assignments in their gym
CREATE POLICY "trainer_assignments_update"
  ON trainer_assignments FOR UPDATE
  USING (has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]));

-- Trainers/owners can delete assignments in their gym
CREATE POLICY "trainer_assignments_delete"
  ON trainer_assignments FOR DELETE
  USING (has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]));

CREATE INDEX IF NOT EXISTS idx_trainer_assignments_trainer
  ON trainer_assignments (trainer_profile_id, status);

CREATE INDEX IF NOT EXISTS idx_trainer_assignments_member
  ON trainer_assignments (member_profile_id, status);

CREATE INDEX IF NOT EXISTS idx_trainer_assignments_gym
  ON trainer_assignments (gym_id);

-- ─── B) Coach Notes (sent to members) ──────────────────

CREATE TABLE IF NOT EXISTS coach_notes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  trainer_profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source              TEXT NOT NULL CHECK (source IN ('workout', 'weekly', 'manual')),
  status              TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'archived')),
  title               TEXT NOT NULL,
  body                TEXT NOT NULL,
  meta                JSONB NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at             TIMESTAMPTZ NULL
);

ALTER TABLE coach_notes ENABLE ROW LEVEL SECURITY;

-- Members can read notes addressed to them
CREATE POLICY "coach_notes_member_select"
  ON coach_notes FOR SELECT
  USING (member_profile_id = auth.uid());

-- Trainers can read/insert/update notes they authored in their gym
CREATE POLICY "coach_notes_trainer_select"
  ON coach_notes FOR SELECT
  USING (
    trainer_profile_id = auth.uid()
    AND gym_id IN (SELECT get_my_gym_ids())
  );

CREATE POLICY "coach_notes_trainer_insert"
  ON coach_notes FOR INSERT
  WITH CHECK (
    trainer_profile_id = auth.uid()
    AND gym_id IN (SELECT get_my_gym_ids())
  );

CREATE POLICY "coach_notes_trainer_update"
  ON coach_notes FOR UPDATE
  USING (
    trainer_profile_id = auth.uid()
    AND gym_id IN (SELECT get_my_gym_ids())
  );

-- Owners can read all notes in their gym
CREATE POLICY "coach_notes_owner_select"
  ON coach_notes FOR SELECT
  USING (has_gym_role(gym_id, ARRAY['owner']::user_role[]));

CREATE INDEX IF NOT EXISTS idx_coach_notes_member
  ON coach_notes (member_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coach_notes_trainer
  ON coach_notes (trainer_profile_id, created_at DESC);

-- ─── C) Coach Note Drafts (AI-generated) ───────────────

CREATE TABLE IF NOT EXISTS coach_note_drafts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  trainer_profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_id          UUID NULL REFERENCES workouts(id) ON DELETE SET NULL,
  period_start        DATE NULL,
  period_end          DATE NULL,
  draft_title         TEXT NOT NULL,
  draft_body          TEXT NOT NULL,
  confidence          NUMERIC(3,2) NOT NULL DEFAULT 0.6 CHECK (confidence >= 0 AND confidence <= 1),
  signals             JSONB NULL,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'sent', 'discarded')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE coach_note_drafts ENABLE ROW LEVEL SECURITY;

-- Idempotency: prevent duplicate drafts per workout
CREATE UNIQUE INDEX IF NOT EXISTS uq_draft_workout
  ON coach_note_drafts (gym_id, member_profile_id, workout_id)
  WHERE workout_id IS NOT NULL;

-- Idempotency: prevent duplicate weekly drafts per member per period
CREATE UNIQUE INDEX IF NOT EXISTS uq_draft_weekly_period
  ON coach_note_drafts (gym_id, member_profile_id, period_start, period_end)
  WHERE period_start IS NOT NULL AND period_end IS NOT NULL;

-- Trainers can read drafts where they are assigned
CREATE POLICY "coach_note_drafts_trainer_select"
  ON coach_note_drafts FOR SELECT
  USING (
    trainer_profile_id = auth.uid()
    AND gym_id IN (SELECT get_my_gym_ids())
  );

-- Owners can read all drafts in their gym
CREATE POLICY "coach_note_drafts_owner_select"
  ON coach_note_drafts FOR SELECT
  USING (has_gym_role(gym_id, ARRAY['owner']::user_role[]));

-- Trainers can insert drafts in their gym
CREATE POLICY "coach_note_drafts_trainer_insert"
  ON coach_note_drafts FOR INSERT
  WITH CHECK (
    trainer_profile_id = auth.uid()
    AND gym_id IN (SELECT get_my_gym_ids())
  );

-- Only the assigned trainer can update their own drafts
CREATE POLICY "coach_note_drafts_trainer_update"
  ON coach_note_drafts FOR UPDATE
  USING (trainer_profile_id = auth.uid());

-- Members cannot see drafts (no policy for members)

CREATE INDEX IF NOT EXISTS idx_coach_note_drafts_inbox
  ON coach_note_drafts (gym_id, trainer_profile_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coach_note_drafts_member
  ON coach_note_drafts (member_profile_id, created_at DESC);

-- ─── D) Coach Note Actions (audit trail) ───────────────

CREATE TABLE IF NOT EXISTS coach_note_actions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  draft_id            UUID NULL REFERENCES coach_note_drafts(id) ON DELETE SET NULL,
  note_id             UUID NULL REFERENCES coach_notes(id) ON DELETE SET NULL,
  actor_profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action              TEXT NOT NULL CHECK (action IN ('generated', 'edited', 'approved', 'sent', 'discarded')),
  meta                JSONB NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE coach_note_actions ENABLE ROW LEVEL SECURITY;

-- Trainers/owners can read actions in their gym
CREATE POLICY "coach_note_actions_staff_select"
  ON coach_note_actions FOR SELECT
  USING (has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]));

-- Trainers/owners can insert actions
CREATE POLICY "coach_note_actions_staff_insert"
  ON coach_note_actions FOR INSERT
  WITH CHECK (has_gym_role(gym_id, ARRAY['owner', 'trainer']::user_role[]));

-- Members cannot read actions

CREATE INDEX IF NOT EXISTS idx_coach_note_actions_draft
  ON coach_note_actions (draft_id, created_at);

CREATE INDEX IF NOT EXISTS idx_coach_note_actions_note
  ON coach_note_actions (note_id, created_at);

-- ─── Feature Flag ──────────────────────────────────────

INSERT INTO feature_flags (gym_id, profile_id, key, enabled) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'ai_trainer_copilot', true)
ON CONFLICT DO NOTHING;

-- ─── Updated_at trigger for drafts ─────────────────────

CREATE OR REPLACE FUNCTION update_coach_note_draft_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_coach_note_draft_updated_at
  BEFORE UPDATE ON coach_note_drafts
  FOR EACH ROW EXECUTE FUNCTION update_coach_note_draft_updated_at();
