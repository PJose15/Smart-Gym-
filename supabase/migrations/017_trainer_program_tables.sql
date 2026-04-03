-- Migration 017: Trainer program template tables
-- Creates relational tables for trainer-created program templates
-- that can be assigned to members (converted to ai_programs on assignment)

-- Trainer-created program templates
CREATE TABLE programs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id            uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name              text NOT NULL,
  description       text,
  goal              text,
  duration_weeks    integer NOT NULL DEFAULT 4,
  sessions_per_week integer NOT NULL DEFAULT 3,
  is_active         boolean NOT NULL DEFAULT true,
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER programs_updated_at
  BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Days within a program template
CREATE TABLE program_days (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  day_number    integer NOT NULL,
  name          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, day_number)
);

-- Exercises within a program day
CREATE TABLE program_exercises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_day_id  uuid NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
  exercise_name   text NOT NULL,
  machine_id      uuid REFERENCES machines(id) ON DELETE SET NULL,
  default_sets    integer NOT NULL DEFAULT 3,
  default_reps    integer NOT NULL DEFAULT 10,
  order_index     integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Tracks which trainer program was assigned to which member
CREATE TABLE member_program_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  program_id    uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  ai_program_id uuid REFERENCES ai_programs(id) ON DELETE SET NULL,
  assigned_by   uuid REFERENCES users(id),
  assigned_at   timestamptz NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_program_assignments ENABLE ROW LEVEL SECURITY;

-- Service role has full access (all queries go through admin client)
CREATE POLICY "service_role_programs" ON programs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_program_days" ON program_days FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_program_exercises" ON program_exercises FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_member_program_assignments" ON member_program_assignments FOR ALL USING (true) WITH CHECK (true);
