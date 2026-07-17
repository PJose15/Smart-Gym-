#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Nexera demo environment seeder (DOC_04). bash — for CI / macOS / Linux.
#
# DESTRUCTIVE: runs `supabase db reset` (wipes ALL local data, reapplies all
# migrations + supabase/seed.sql), then loads supabase/seed-bulk.sql, then
# prints the manual auth step and runs the verification query.
#
# Usage:
#   ./scripts/seed-demo.sh --yes                 # full reset + bulk seed
#   ./scripts/seed-demo.sh --yes --with-auth     # also run seed-auth.sql (local)
#   ./scripts/seed-demo.sh --yes --skip-reset    # keep DB, just apply bulk seed
#   DB_URL=postgresql://... ./scripts/seed-demo.sh --yes
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
CONFIRM=0
WITH_AUTH=0
SKIP_RESET=0

for arg in "$@"; do
  case "$arg" in
    --yes)        CONFIRM=1 ;;
    --with-auth)  WITH_AUTH=1 ;;
    --skip-reset) SKIP_RESET=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

cd "$(dirname "$0")/.."

cat <<'BANNER'

  ██████████████████████████████████████████████████████████████
  ██                                                          ██
  ██   !! WARNING: 'supabase db reset' DESTROYS ALL DATA !!   ██
  ██                                                          ██
  ██   Every table in the LOCAL database will be wiped and    ██
  ██   rebuilt from migrations + seed files.                  ██
  ██   NEVER run this against a production database.          ██
  ██                                                          ██
  ██████████████████████████████████████████████████████████████

BANNER

if [ "$CONFIRM" -ne 1 ]; then
  echo "Refusing to run without explicit confirmation."
  echo "Re-run with:  ./scripts/seed-demo.sh --yes"
  exit 1
fi

command -v psql >/dev/null 2>&1 || { echo "psql not found on PATH." >&2; exit 1; }
command -v supabase >/dev/null 2>&1 || { echo "supabase CLI not found on PATH." >&2; exit 1; }

# Step 1: reset (migrations + basic seed: feature flags, achievements, tips)
if [ "$SKIP_RESET" -eq 1 ]; then
  echo "[1/4] Skipping 'supabase db reset' (--skip-reset)"
else
  echo "[1/4] supabase db reset (migrations + supabase/seed.sql)..."
  supabase db reset
fi

# Step 2: bulk demo seed
echo "[2/4] Applying supabase/seed-bulk.sql (Iron Society demo data)..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed-bulk.sql

# Step 3: auth users (manual, or --with-auth on local)
if [ "$WITH_AUTH" -eq 1 ]; then
  echo "[3/4] Applying supabase/seed-auth.sql via psql (local superuser)..."
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed-auth.sql
else
  echo "[3/4] MANUAL STEP — create demo auth users:"
  echo "      Open the Supabase SQL Editor (local Studio: http://127.0.0.1:54323)"
  echo "      and run the contents of:  supabase/seed-auth.sql"
  echo "      (or re-run with --with-auth to do it via psql locally)"
fi

# Step 4: verification
echo "[4/4] Verifying demo state..."
psql "$DB_URL" -c "
SELECT
  (SELECT COUNT(*) FROM public.members          WHERE gym_id = '00000000-0000-0000-0000-000000000001' AND id::text LIKE '00000000-0000-0000-0001-%') AS members,
  (SELECT COUNT(*) FROM public.machines         WHERE gym_id = '00000000-0000-0000-0000-000000000001') AS machines,
  (SELECT COUNT(*) FROM public.workout_sessions WHERE gym_id = '00000000-0000-0000-0000-000000000001') AS sessions,
  (SELECT COUNT(*) FROM public.gym_feed_events  WHERE gym_id = '00000000-0000-0000-0000-000000000001') AS feed_events,
  (SELECT COUNT(*) FROM public.gym_challenges   WHERE gym_id = '00000000-0000-0000-0000-000000000001') AS challenges,
  (SELECT COUNT(*) FROM public.weekly_checkins  WHERE gym_id = '00000000-0000-0000-0000-000000000001') AS checkins;
"

echo
echo "Expected: members=50, machines=20, sessions=600+, feed_events=200+, challenges=6, checkins=40+"
echo "Demo logins: owner@ironsociety.com / alex@ironsociety.com / admin@nexera.io (see supabase/seed-auth.sql)"
echo "Member demo: phone +17875550003 (Carlos). Machine scan page: /m/chest-press"
echo "Full guide: DEMO_SETUP.md"
