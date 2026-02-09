# SmartGym -- Data Model

**Database:** PostgreSQL via Supabase
**Migration file:** `supabase/migrations/001_initial_schema.sql`
**TypeScript types:** `packages/types/src/index.ts`

---

## Table of Contents

1. [Entity Relationship Overview](#1-entity-relationship-overview)
2. [Identity Tables](#2-identity-tables)
3. [Equipment Tables](#3-equipment-tables)
4. [Training / Program Tables](#4-training--program-tables)
5. [Logging Tables](#5-logging-tables)
6. [Gamification Tables](#6-gamification-tables)
7. [Helper Functions](#7-helper-functions)
8. [RLS Verification Checklist](#8-rls-verification-checklist)

---

## 1. Entity Relationship Overview

```
auth.users (Supabase Auth)
    |
    | 1:1 (profiles.id = auth.users.id)
    v
profiles
    |
    | 1:N via gym_members (a profile can belong to many gyms)
    v
gym_members ---- N:1 ----> gyms
                              |
              +---------------+---------------+---------------+
              |               |               |               |
              v               v               v               v
          machines        programs        workouts      points_ledger
              |               |               |
              |               v               v
              |         program_days    workout_exercises
              |               |               |
              |               v               v
              +-----> program_exercises     sets
```

**Key relationships:**

- A **gym** is the top-level tenant. Every data-bearing table carries a `gym_id` foreign key (directly or transitively).
- A **profile** maps 1:1 to a Supabase `auth.users` row. The `profiles.id` column is both the primary key and a foreign key to `auth.users(id)`.
- A **gym_member** is the join table between profiles and gyms. It also carries the `role` enum (`owner`, `trainer`, `member`). The combination `(gym_id, profile_id)` is unique -- a person can only have one role per gym.
- A **machine** belongs to exactly one gym. Its `qr_slug` is globally unique, enabling QR lookups without knowing the gym in advance.
- **Programs** are gym-scoped training templates. Each program has ordered **program_days**, and each day has ordered **program_exercises** that optionally link to a machine.
- A **workout** is a single training session for one member at one gym. It contains **workout_exercises**, each of which contains multiple **sets**.
- The **points_ledger** is an append-only ledger of point awards, scoped to gym and profile. Balances are computed by summing entries.

---

## 2. Identity Tables

### gyms

The top-level organizational unit. Each gym operates as an isolated tenant.

| Column | Type | Constraints | Description |
|------------|-------------|----------------------------------------|--------------------------------------|
| id | UUID | PK, default `uuid_generate_v4()` | Unique gym identifier |
| name | TEXT | NOT NULL | Display name of the gym |
| slug | TEXT | NOT NULL, UNIQUE | URL-safe identifier (e.g., `iron-paradise`) |
| address | TEXT | nullable | Physical address |
| logo_url | TEXT | nullable | URL to gym logo image |
| created_at | TIMESTAMPTZ | NOT NULL, default `now()` | Record creation timestamp |

### profiles

Mirrors Supabase Auth users with application-specific fields.

| Column | Type | Constraints | Description |
|------------|-------------|----------------------------------------|--------------------------------------|
| id | UUID | PK, FK -> `auth.users(id)` ON DELETE CASCADE | Matches the Supabase auth user ID |
| email | TEXT | NOT NULL | User email address |
| full_name | TEXT | NOT NULL, default `''` | Display name |
| avatar_url | TEXT | nullable | URL to profile photo |
| created_at | TIMESTAMPTZ | NOT NULL, default `now()` | Record creation timestamp |

### gym_members

Join table associating profiles with gyms and assigning roles.

| Column | Type | Constraints | Description |
|------------|-------------|----------------------------------------|--------------------------------------|
| id | UUID | PK, default `uuid_generate_v4()` | Row identifier |
| gym_id | UUID | NOT NULL, FK -> `gyms(id)` ON DELETE CASCADE | The gym |
| profile_id | UUID | NOT NULL, FK -> `profiles(id)` ON DELETE CASCADE | The user |
| role | user_role | NOT NULL, default `'member'` | Enum: `owner`, `trainer`, `member` |
| joined_at | TIMESTAMPTZ | NOT NULL, default `now()` | When the membership was created |

**Constraints:** UNIQUE on `(gym_id, profile_id)` -- a profile can only hold one role per gym.

**Indexes:**
- `idx_gym_members_gym` on `gym_id`
- `idx_gym_members_profile` on `profile_id`

---

## 3. Equipment Tables

### machines

Represents a single piece of gym equipment with a QR code.

| Column | Type | Constraints | Description |
|----------------|-------------|----------------------------------------|--------------------------------------|
| id | UUID | PK, default `uuid_generate_v4()` | Machine identifier |
| gym_id | UUID | NOT NULL, FK -> `gyms(id)` ON DELETE CASCADE | Owning gym |
| name | TEXT | NOT NULL | Machine display name (e.g., "Lat Pulldown") |
| qr_slug | TEXT | NOT NULL, UNIQUE | Globally unique slug encoded in QR codes |
| target_muscles | TEXT[] | NOT NULL, default `'{}'` | Array of muscle groups (e.g., `{"Lats", "Biceps"}`) |
| setup_steps | TEXT[] | NOT NULL, default `'{}'` | Ordered setup instructions |
| safety_cues | TEXT[] | NOT NULL, default `'{}'` | Safety warnings and form tips |
| image_url | TEXT | nullable | URL to machine photo |
| created_at | TIMESTAMPTZ | NOT NULL, default `now()` | Record creation timestamp |

**Indexes:**
- `idx_machines_gym` on `gym_id`
- `idx_machines_qr_slug` on `qr_slug` (supports fast QR lookup)

**QR slug format:** Generated by `@smartgym/utils.generateQrSlug()` as `<gym-slug>-<machine-name>-<random-4-chars>`. Example: `iron-paradise-lat-pulldown-a3f9`.

---

## 4. Training / Program Tables

### programs

A reusable training program template created by a trainer or owner.

| Column | Type | Constraints | Description |
|------------|-------------|----------------------------------------|--------------------------------------|
| id | UUID | PK, default `uuid_generate_v4()` | Program identifier |
| gym_id | UUID | NOT NULL, FK -> `gyms(id)` ON DELETE CASCADE | Owning gym |
| name | TEXT | NOT NULL | Program name (e.g., "Beginner Full Body") |
| description | TEXT | nullable | Free-text description |
| created_by | UUID | NOT NULL, FK -> `profiles(id)` | Profile of the trainer/owner who created it |
| created_at | TIMESTAMPTZ | NOT NULL, default `now()` | Record creation timestamp |

**Indexes:**
- `idx_programs_gym` on `gym_id`

### program_days

A single day within a program (e.g., "Day 1 -- Push").

| Column | Type | Constraints | Description |
|------------|-------------|----------------------------------------|--------------------------------------|
| id | UUID | PK, default `uuid_generate_v4()` | Day identifier |
| program_id | UUID | NOT NULL, FK -> `programs(id)` ON DELETE CASCADE | Parent program |
| day_number | INT | NOT NULL | Ordering within the program (1, 2, 3, ...) |
| name | TEXT | NOT NULL | Day label (e.g., "Upper Body") |

### program_exercises

A single exercise within a program day.

| Column | Type | Constraints | Description |
|----------------|-------------|----------------------------------------|--------------------------------------|
| id | UUID | PK, default `uuid_generate_v4()` | Exercise identifier |
| program_day_id | UUID | NOT NULL, FK -> `program_days(id)` ON DELETE CASCADE | Parent day |
| machine_id | UUID | nullable, FK -> `machines(id)` ON DELETE SET NULL | Optional link to a specific machine |
| exercise_name | TEXT | NOT NULL | Exercise name (e.g., "Bench Press") |
| order_index | INT | NOT NULL, default `0` | Display order within the day |
| default_sets | INT | NOT NULL, default `3` | Recommended number of sets |
| default_reps | INT | NOT NULL, default `10` | Recommended number of reps per set |

**Note:** When a machine is deleted, `machine_id` is set to NULL rather than cascading the delete, so program structure is preserved.

### member_program_assignments

Links a member to a program they should follow.

| Column | Type | Constraints | Description |
|------------|-------------|----------------------------------------|--------------------------------------|
| id | UUID | PK, default `uuid_generate_v4()` | Assignment identifier |
| gym_id | UUID | NOT NULL, FK -> `gyms(id)` ON DELETE CASCADE | Gym context |
| profile_id | UUID | NOT NULL, FK -> `profiles(id)` ON DELETE CASCADE | The member being assigned |
| program_id | UUID | NOT NULL, FK -> `programs(id)` ON DELETE CASCADE | The program being assigned |
| assigned_by | UUID | NOT NULL, FK -> `profiles(id)` | The trainer/owner who assigned it |
| assigned_at | TIMESTAMPTZ | NOT NULL, default `now()` | When the assignment was made |

**Constraints:** UNIQUE on `(profile_id, program_id)` -- a member cannot be assigned the same program twice.

---

## 5. Logging Tables

### workouts

A single workout session by a member.

| Column | Type | Constraints | Description |
|-------------|-------------|----------------------------------------|--------------------------------------|
| id | UUID | PK, default `uuid_generate_v4()` | Workout identifier |
| gym_id | UUID | NOT NULL, FK -> `gyms(id)` ON DELETE CASCADE | Where the workout happened |
| profile_id | UUID | NOT NULL, FK -> `profiles(id)` ON DELETE CASCADE | Who performed the workout |
| started_at | TIMESTAMPTZ | NOT NULL, default `now()` | Session start time |
| finished_at | TIMESTAMPTZ | nullable | Session end time (NULL while in progress) |

**Indexes:**
- `idx_workouts_profile` on `profile_id`
- `idx_workouts_gym` on `gym_id`

### workout_exercises

An exercise performed within a workout. Links to a machine if the exercise was machine-based.

| Column | Type | Constraints | Description |
|---------------|-------------|----------------------------------------|--------------------------------------|
| id | UUID | PK, default `uuid_generate_v4()` | Row identifier |
| workout_id | UUID | NOT NULL, FK -> `workouts(id)` ON DELETE CASCADE | Parent workout |
| machine_id | UUID | nullable, FK -> `machines(id)` ON DELETE SET NULL | Machine used (if applicable) |
| exercise_name | TEXT | NOT NULL | Exercise name |
| order_index | INT | NOT NULL, default `0` | Order within the workout |

### sets

Individual set data within a workout exercise.

| Column | Type | Constraints | Description |
|---------------------|-------------|----------------------------------------|--------------------------------------|
| id | UUID | PK, default `uuid_generate_v4()` | Set identifier |
| workout_exercise_id | UUID | NOT NULL, FK -> `workout_exercises(id)` ON DELETE CASCADE | Parent exercise |
| set_number | INT | NOT NULL | Set ordering (1, 2, 3, ...) |
| reps | INT | NOT NULL | Number of repetitions performed |
| weight_kg | NUMERIC(6,2) | NOT NULL, default `0` | Weight used in kilograms |
| rpe | NUMERIC(3,1) | nullable | Rate of Perceived Exertion (1.0--10.0) |
| logged_at | TIMESTAMPTZ | NOT NULL, default `now()` | When the set was recorded |

---

## 6. Gamification Tables

### points_ledger

Append-only ledger of point transactions. To compute a member's balance, sum all entries for that `(gym_id, profile_id)` pair.

| Column | Type | Constraints | Description |
|--------------|-------------|----------------------------------------|--------------------------------------|
| id | UUID | PK, default `uuid_generate_v4()` | Ledger entry identifier |
| gym_id | UUID | NOT NULL, FK -> `gyms(id)` ON DELETE CASCADE | Gym context |
| profile_id | UUID | NOT NULL, FK -> `profiles(id)` ON DELETE CASCADE | Member earning points |
| points | INT | NOT NULL | Number of points (positive = credit) |
| reason | points_reason | NOT NULL | Enum: `workout_completed`, `set_logged`, `streak_bonus`, `manual` |
| reference_id | UUID | nullable | Optional FK to the triggering entity (e.g., workout ID) |
| created_at | TIMESTAMPTZ | NOT NULL, default `now()` | When the points were awarded |

**Indexes:**
- `idx_points_ledger_profile` on `profile_id`
- `idx_points_ledger_gym` on `gym_id`

---

## 7. Helper Functions

### get_my_gym_ids()

Returns the set of `gym_id` values for the currently authenticated user. Used in RLS policies for efficient gym-scoped access checks.

```sql
CREATE OR REPLACE FUNCTION get_my_gym_ids()
RETURNS SETOF UUID AS $$
  SELECT gym_id FROM gym_members WHERE profile_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### has_gym_role(target_gym_id UUID, allowed_roles user_role[])

Returns `TRUE` if the currently authenticated user holds one of the specified roles at the given gym. Used in RLS policies that require role-based authorization (e.g., only trainers and owners can write to machines).

```sql
CREATE OR REPLACE FUNCTION has_gym_role(target_gym_id UUID, allowed_roles user_role[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM gym_members
    WHERE gym_id = target_gym_id
    AND profile_id = auth.uid()
    AND role = ANY(allowed_roles)
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

Both functions are marked `SECURITY DEFINER` so they execute with the privileges of the function owner (bypassing RLS on the `gym_members` table itself) and `STABLE` to indicate they do not modify data and can be safely cached within a transaction.

---

## 8. RLS Verification Checklist

Every row in the database must be protected by Row-Level Security policies. Use this checklist to verify that isolation is correctly enforced before each release.

### Cross-Gym Isolation

- [ ] **Member A in Gym X cannot see machines in Gym Y.** Verify by authenticating as a member of Gym X and running `SELECT * FROM machines WHERE gym_id = '<gym_y_id>'`. Expected result: zero rows.

- [ ] **No cross-gym data leakage via joins or subqueries.** Verify that a query like `SELECT * FROM machines WHERE gym_id IN (SELECT gym_id FROM gyms)` still only returns machines for the authenticated user's gyms, not all gyms.

### Ownership Constraints

- [ ] **Member can only create workouts with their own profile_id.** Verify by attempting `INSERT INTO workouts (gym_id, profile_id, started_at) VALUES ('<gym_id>', '<other_user_id>', now())`. Expected result: RLS policy violation.

- [ ] **Member cannot write to machines table.** Verify by authenticating as a member (not trainer/owner) and attempting `INSERT INTO machines (gym_id, name, qr_slug) VALUES (...)`. Expected result: denied.

### Role-Based Access

- [ ] **Trainer can manage machines in their gym only.** Verify that a trainer in Gym X can INSERT/UPDATE/DELETE machines where `gym_id = '<gym_x_id>'`, but cannot modify machines where `gym_id = '<gym_y_id>'`.

- [ ] **Owner can manage all resources in their gym.** Verify that an owner can perform full CRUD on machines, programs, program_days, program_exercises, member_program_assignments, and gym_members within their gym scope.

### Scoped Ledger

- [ ] **points_ledger entries scoped to gym_id.** Verify that querying `SELECT * FROM points_ledger` as a member of Gym X returns only rows where `gym_id` matches Gym X. Verify that inserting a points entry with a foreign `gym_id` is rejected.

### Testing Procedure

For each checklist item above:

1. Create test users with the relevant roles in separate gyms.
2. Authenticate as each test user via Supabase client.
3. Execute the described query or mutation.
4. Assert the expected outcome (zero rows, policy violation error, or success).
5. Log the result. All items must pass before the release is approved.
