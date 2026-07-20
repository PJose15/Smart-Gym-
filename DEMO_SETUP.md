# Nexera Demo Environment — Setup Guide

Condensed from **DOC_04 — Bulk Seed Data & Demo Environment**. Builds the
"Iron Society" demo gym: 50 members, 4 trainers, 20 machines, 90 days of
workout history, live feed, challenges, check-ins and populated dashboards.

> ⚠️ **Everything here is for the LOCAL / dev database only.**
> `supabase db reset` destroys all data. Never point these scripts at production.

---

## 1. Quick Start

```powershell
# Windows (primary)
.\scripts\seed-demo.ps1 -Confirm:$true -WithAuth
```

```bash
# macOS / Linux / CI
./scripts/seed-demo.sh --yes --with-auth
```

What the script does:

| Step | Action |
|---|---|
| 1 | `supabase db reset` — reapplies migrations 001–024 + `supabase/seed.sql` (feature flags, achievement catalog, tip library) |
| 2 | `psql -f supabase/seed-bulk.sql` — the full Iron Society demo dataset |
| 3 | Auth users — `supabase/seed-auth.sql`. With `-WithAuth`/`--with-auth` it runs via psql (local superuser). Otherwise run it manually in the **Supabase SQL Editor** (local Studio: http://127.0.0.1:54323) |
| 4 | Verification query (expected: **50 members · 20 machines · 600+ sessions · 200+ feed events · 6 challenges · 40+ check-ins**) |

Both seed files are **idempotent** — re-running them is safe (fixed/md5 UUIDs +
`ON CONFLICT` everywhere). `-SkipReset` / `--skip-reset` re-applies the bulk
seed without wiping the DB.

## 2. Demo Logins

| Role | Login | Password |
|---|---|---|
| Gym owner | `owner@ironsociety.com` | `DemoOwner2026!` |
| Trainer (primary demo) | `alex@ironsociety.com` | `DemoTrainer2026!` |
| Trainers | `maria@` / `jose@` / `laura@ironsociety.com` | `DemoTrainer2026!` |
| Super admin | `admin@nexera.io` | `DemoAdmin2026!` |
| Member (Carlos Vega) | phone `+17875550003` | OTP — for a fixed local OTP `123456`, uncomment `[auth.sms.test_otp]` in `supabase/config.toml` and add `17875550003 = "123456"` (then `supabase stop && supabase start`) |

Key fixed IDs: gym `00000000-0000-0000-0000-000000000001`, members
`...0001-000000000001..050` (01 Marcus, 02 Sofia, 03 Carlos, 04 Ana, 05 Jorge,
06 Isabella), machines `...0003-...001..020`. Full map in the header of
`supabase/seed-bulk.sql`.

## 3. Demo Scenarios (DOC_04 §17)

### A — Gym Owner Pitch
Login as **owner**. Focus: retention + operations.
- Active members 35+, at-risk cohort (Ana + members 38–44, 14–30 days inactive), 4 inactive (45–48)
- Machine utilization: **Chest Press Machine** is most-used; cardio deck has traffic too
- Live activity strip: sessions in the last 2 hours are always present (seeded "happening now" rows)
- Billing: Growth plan, active subscription
- Verify at `/owner/dashboard` (or the root staff dashboard) before the demo.

### B — Member First Experience (Carlos)
Login as **Carlos** (`+17875550003`). Focus: scan → log → coach → PR.
1. Open `localhost:3000/m/chest-press`
2. Carlos has **no session today**; yesterday's chest-press session is his PR (seeded 5 lbs above his previous best)
3. Log a set heavier than yesterday's top weight → **PR celebration fires**
- Home shows his AI program ("AI Muscle Builder — Upper/Lower", Day 1 "Upper A — Push Focus"), a 4-week streak, 6 badges, readiness 82 ("ready"), progression-dominant DNA pentagon (archetype: Climber).

### C — Trainer Portal (Alex)
Login as **alex@ironsociety.com**. Focus: caseload + copilot.
- 12 assigned members (01–12) with status badges; Marcus active/high-readiness; **Ana flagged at-risk (~18 days)**
- **2 pending check-in drafts** (Marcus, Ana) awaiting review this week; 4 weeks of sent check-in history; Sofia's latest is unread (shimmer)
- Coach copilot: 1 sent note + 1 pending AI draft for Carlos
- Messages: live thread with Carlos (his last message unread), thread with Marcus
- Verify at `/trainer/today`.

### D — Investor Platform Demo
Login as **admin@nexera.io**. Focus: platform scale.
- 1 active gym, 50 members, 600+ sessions, populated charts (12 weeks of leaderboard snapshots, 90 days of session history)
- Verify at `/admin/overview`.

## 4. Visual Checklist (run before ANY demo)

**Owner**: active count 35+ · at-risk 8+ · all 20 machines listed with usage ·
Chest Press most popular · live strip shows a session < 2h old · peak-hour
heatmap has morning + evening hot spots · Growth plan billing.

**Member (Carlos)**: hero zone is NOT "no-program" · streak flame (4 weeks) ·
TodayZone shows "Upper A — Push Focus" · 6 badges on the wall · DNA pentagon
has a distinct shape · progress charts are not flat · leaderboard shows his rank ·
CommunityPulse shows 3+ recent events.

**Scan flow**: `/m/chest-press` loads · muscles shown · readiness banner ·
AI tip renders (tip library is seeded) · previous-session data appears ·
suggested weight populated.

**Trainer (Alex)**: 12 members · Ana at-risk badge · 2 pending drafts ·
Carlos draft has personalized content · unread message from Carlos.

**Feed**: 10+ events in last 7 days · PR events show weights · achievement
events show badge names · 5+ events with reactions · 2+ events with comments.

If dates have drifted (data is `NOW()`-relative, so it ages), run:

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -f scripts/refresh-demo-dates.sql
```

## 5. Snapshot & Restore (DOC_04 §18)

After verifying the checklist, freeze the state:

```bash
mkdir -p backups
pg_dump "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  --format=custom --schema=public --schema=auth \
  --exclude-table='auth.audit_log_entries' \
  --file="backups/nexera-demo-$(date +%Y%m%d).pgdump"
```

Restore before a demo (destroys current data):

```bash
supabase db reset --no-seed
pg_restore --dbname "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  --clean --if-exists backups/nexera-demo-YYYYMMDD.pgdump
```

Re-snapshot after every schema change (old snapshots go stale) and before
every investor pitch (verify the restore on the demo machine).

## 6. Maintenance Schedule

| Cadence | Action |
|---|---|
| Weekly (or pre-demo) | `scripts/refresh-demo-dates.sql` — re-anchors at-risk dates, Carlos's "yesterday" session, fresh feed events, readiness cache |
| After schema changes | Full re-seed (`seed-demo.ps1 -Confirm:$true`) + new snapshot |
| Monthly | Full re-seed — challenge windows are anchored to the current month |

## 8. Agent Staging Verification

Verify that all 13 UptimizeAI agent automations reach the forwarding endpoint
before pointing at a live UptimizeAI URL.

### Setup (one time)

Add these three lines to `apps/web-admin/.env.local` (create if it does not exist):

```
UPTIMIZE_WEBHOOK_URL=http://localhost:3000/api/dev/agent-echo
UPTIMIZE_API_KEY=staging-echo-key
DEMO_ECHO_AGENTS=true
```

Restart the dev server: `pnpm dev` (or `npx next dev` from `apps/web-admin`).

### Firing a trigger

Any action that fires an agent (session complete after a level-up, a feature
gate denial, the billing webhook, etc.) will forward the payload to the echo
receiver. You can also POST directly:

```bash
curl -s -X POST http://localhost:3000/api/agents/trigger \
  -H "Content-Type: application/json" \
  -H "x-smartgym-internal-key: <INTERNAL_WEBHOOK_KEY>" \
  -d '{"agent_name":"engagement-agent","gym_id":"<GYM_UUID>","payload":{"event":"level-up","is_agent_initiated":false}}'
```

### Confirming reception

1. **Console log** — the dev server terminal will show:
   ```
   [agent-echo] received: {"agent_name":"engagement-agent","payload":{...},"log_id":"<UUID>"}
   ```

2. **Database row** — query the live (or local) DB:
   ```sql
   SELECT action_taken, status, agent_name, trigger_event
   FROM smartgym_agent_logs
   WHERE action_taken = 'echo-received'
   ORDER BY executed_at DESC
   LIMIT 5;
   ```
   `action_taken` should be `'echo-received'`; `status` remains `'sent'`.

### Going live

When ready to connect to the real UptimizeAI engine:

1. Set `UPTIMIZE_WEBHOOK_URL` to the URL provided by UptimizeAI.
2. Set `UPTIMIZE_API_KEY` to the API key provided by UptimizeAI.
3. Set `DEMO_ECHO_AGENTS=false` (or remove the var).
4. Restart. No code changes required.

---

## 7. Files

| File | Purpose |
|---|---|
| `supabase/seed.sql` | Basic seed (flags, achievement catalog, tip library) — run by `supabase db reset` |
| `supabase/seed-bulk.sql` | Full Iron Society demo dataset (this doc) |
| `supabase/seed-auth.sql` | Demo auth users + linking — **SQL Editor** (or psql locally) |
| `scripts/seed-demo.ps1` / `.sh` | Orchestration (reset → seed → auth → verify) |
| `scripts/refresh-demo-dates.sql` | Weekly freshness refresh |

### Known schema adaptations
The DOC_04 SQL drafts were written against a stale schema. `seed-bulk.sql`
was validated column-by-column against migrations 001–024; every adaptation is
commented inline at the section it applies to (members status/goal enums,
machines muscle_groups/qr_slug, gym_challenges without target_value,
weekly_checkins flags, coach_notes profile-ids, `compute_member_readiness()`
RPC replaced by direct cache seeding, etc.).
