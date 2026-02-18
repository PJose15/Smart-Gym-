-- ============================================================
-- Phase 2: Add workout status tracking + set notes
-- ============================================================

-- Workout status enum
CREATE TYPE workout_status AS ENUM ('in_progress', 'completed', 'cancelled');

-- Add status column to workouts (backfill existing as completed)
ALTER TABLE workouts
  ADD COLUMN status workout_status NOT NULL DEFAULT 'in_progress';

-- Backfill: any workout with finished_at should be marked completed
UPDATE workouts SET status = 'completed' WHERE finished_at IS NOT NULL;

-- Add notes to sets for optional user annotations
ALTER TABLE sets
  ADD COLUMN notes TEXT;

-- Index for quickly finding active workouts for a user
CREATE INDEX idx_workouts_profile_status ON workouts(profile_id, status);

-- Index for progress queries: find all sets for a machine across workouts
CREATE INDEX idx_workout_exercises_machine ON workout_exercises(machine_id);
