# Requirements — Milestone v1.0 "Tier 1 Launch Blockers"

**Defined:** 2026-07-19
**Source:** PROJECT.md Active list + `.planning/research/` (FEATURES, ARCHITECTURE, STACK, PITFALLS) + NEXERA_FULL_CODEBASE_AUDIT.md

Scope: the 6 capabilities that block public launch. Everything pre-GSD is captured as Validated requirements in PROJECT.md and is not re-listed here.

---

## v1.0 Requirements

### ONBD — Gym Owner Self-Serve Onboarding

- [ ] **ONBD-01**: Owner can sign up via a 4-step wizard (account → gym info → plan selection → Stripe checkout) with no human intervention
  - Unauthenticated `(onboard)/` route group with signup, verify-email, subscribe, setup pages; progress indicator across steps
  - Plan tiers (Starter/Growth/Pro) shown in-app before checkout; wizard uses react-hook-form + Zod; brand design tokens (DOC_03)
- [x] **ONBD-02**: Gym creation is atomic and resumable — no orphaned auth users or half-created gyms
  - Single transaction (Postgres RPC) creates `gyms`, `gym_memberships` (role=owner), `gym_settings`, `gym_billing` (trialing)
  - `onboarding_status` tracks partial completion; session refreshed post-creation so RLS sees the new membership immediately
- [x] **ONBD-03**: Stripe checkout completes the trial subscription safely, including retry and abandonment paths
  - `stripe_events_processed` dedup table guards webhook idempotency before any new event handler ships
  - `checkout.session.completed` and `checkout.session.expired` handled; abandoned checkout shows "complete your subscription" banner; `payment_method_collection` + `trial_settings.end_behavior` configured
- [x] **ONBD-04**: First-machine setup wizard gets a new gym from zero machines to a printable QR code
  - Guided 3-step wizard (name → muscle groups → QR PDF) using existing `POST /api/machines` + QR endpoints; shared `MachineForm` extracted so `/machines` CRUD page and wizard stay in sync
- [x] **ONBD-05**: Owner can bulk-import members from CSV with validate-then-import flow
  - Column mapping UI, preview, per-row error report ("47 imported, 3 failed — download error report"); BOM/encoding handling (Excel exports); all-or-nothing batch import capped at 500 rows/request; `csv-parse` server-side
- [x] **ONBD-06**: Imported members can claim their accounts on mobile
  - Import creates members with `invited` status + claim email; first mobile phone-OTP login links the invited record to the auth user
- [x] **ONBD-07**: Owner dashboard shows post-signup setup checklist and trial countdown
  - Checklist (add machine, import/invite members, share QR) with completion state; "X days left in trial → Upgrade" banner on dashboard

### FEED — Mobile Social Feed ✅ COMPLETE (delivered 2026-07-17, commits `cba42c0` + `af69753`)

- [x] **FEED-01**: Member sees the gym feed on mobile with all event types rendered — *complete 2026-07-17*
  - Full feed tab renders all 18 event types with pinned announcements, pull-to-refresh, cursor pagination, empty state
- [x] **FEED-02**: Member can react and comment on feed events from mobile — *complete 2026-07-17*
  - Reaction bar + comment threads wired to existing social endpoints with optimistic updates
- [x] **FEED-03**: Feed updates in realtime and surfaces unread activity — *complete 2026-07-17*
  - Realtime subscription + unread badge on the feed tab
- [x] **FEED-04**: Member can follow/unfollow other members and share workouts to the feed — *complete 2026-07-17*
  - Follow/unfollow + workout share card; backed by migrations 024-026 (DOC_02 schema reconciliation, client grants restored)

### CHAL — Mobile Challenges

- [ ] **CHAL-01**: Member can browse active and completed gym challenges on mobile
  - Challenge cards show type badge (7 types), title, description, end-date countdown; active/completed tab toggle; consumes existing `/api/member/challenges` endpoints
- [ ] **CHAL-02**: Member can join a challenge with one tap
  - Join CTA on challenge detail → existing join endpoint; optimistic update + success haptic; disabled when already joined or ended
- [ ] **CHAL-03**: Member sees their own progress within a joined challenge
  - Progress bar "You: current / goal" from existing `current_value`/`goal_value` API fields
- [ ] **CHAL-04**: Member sees the challenge leaderboard with their own rank always visible
  - Top ranks with gold/silver/bronze badges; own row pinned when outside visible window; deep-link target handles deleted/ended challenges with a "no longer available" state (no crash)

### PROG — Mobile Program View

- [ ] **PROG-01**: Member can open a full program view showing plan metadata and overall progress
  - Program header (name, goal, weeks, sessions/week, trainer) + week progress bar from existing `/api/member/[id]/program` response
- [ ] **PROG-02**: Member sees every program day with its exercises, with today highlighted and past days marked complete
  - Day cards list exercises as "sets × reps" chips; today gets active accent state; completed days show checkmarks
- [ ] **PROG-03**: Member can start today's workout or drill into an exercise from the program view
  - "Start today's workout" CTA routes into the scan/workout flow; exercise names link to existing `/exercise/[name]` screen
- [ ] **PROG-04**: Member with no assigned program sees a useful empty state
  - "No program assigned yet" explanation with request/next-step CTA where tier allows

### AGENT — UptimizeAI Agent Connection (13 automations)

- [ ] **AGENT-01**: Agent triggers actually reach the UptimizeAI engine (not just logged)
  - `/api/agents/trigger` forwards to `UPTIMIZE_WEBHOOK_URL` fire-and-forget after logging; failures recorded as `status: 'failed'` in `smartgym_agent_logs`
- [ ] **AGENT-02**: Agent firing is loop-safe and deduplicated
  - Cooldown check against `smartgym_agent_logs` per (gym, agent, event, window) before firing; `is_agent_initiated` flag prevents agent → notification → agent loops; dead-table references (`error_log`, etc.) verified resolved before wiring (done via migrations 024-026)
- [ ] **AGENT-03**: Event-driven automations fire from their source events
  - Wired call sites: session complete (level-up, streak-broken, leaderboard-updated), feature-gate denial (upgrade opportunity), at-risk detection, new-gym-onboarded, challenge-ended — plus the 3 already-wired Stripe billing triggers
- [ ] **AGENT-04**: Scheduled automations fire from cron scans
  - Daily/weekly cron routes cover: dormant members (14d), at-risk early warning, machine underutilization, check-in SLA overdue, weekly summary
- [ ] **AGENT-05**: Every agent fire respects tier gating and is observable
  - `checkAgentAccess()` tier gating enforced (Growth vs Pro agent sets); every fire logged with agent name, trigger event, status, payload; all 13 automations verifiably end-to-end in staging

### NOTIF — Notification Orchestration Wiring (24+ triggers)

- [ ] **NOTIF-01**: All pushes flow through one dispatcher that enforces user preferences
  - Central `dispatcher.ts` checks `notification_preferences`, quiet hours, 5-minute (profile, type) dedup, and per-member hourly rate cap before calling the `send-push-notification` Edge Function; opted-out members provably never receive pushes
- [ ] **NOTIF-02**: The 24+ trigger types are wired from their event sources
  - Activity (PR, badge, level-up, streak, challenge rank/complete), social (feed reaction, comment), coaching (check-in generated/reply, coach note, program assigned), and operational (trial ending, payment failed, at-risk, weekly summary) triggers all dispatch through NOTIF-01
- [ ] **NOTIF-03**: Every push deep-links to the right screen
  - `NotificationType` union expanded from 4 to full trigger set in `@nexera/types`; `NOTIFICATION_ROUTES` maps every type to a mobile route; deleted-resource targets render "not found" gracefully
- [ ] **NOTIF-04**: Member controls notifications by category, with quiet hours
  - Mobile settings section with per-category toggles (activity, social, coaching, operational, agents) + quiet hours window; enforced server-side, not just UI
- [ ] **NOTIF-05**: Member has a notification inbox with unread badge
  - `/notifications` screen listing history from `notifications` table; mark-read on tap; unread count badge on bell/tab icon
- [ ] **NOTIF-06**: Push delivery failures are detected and stale tokens cleaned up
  - Cron polls Expo receipts; `DeviceNotRegistered` deactivates `device_tokens`; failures reflected in `notification_log`; delivery rate visible to admin

---

## Out of Scope (v1.0)

Mirrors PROJECT.md — deferred to post-launch milestones:

| Deferred | Tier |
|----------|------|
| Spanish localization | Tier 4 |
| Playwright E2E tests | Tier 4 |
| PWA offline (web) — mobile offline already works | Tier 4 |
| White-label rendering (Pro tier) | Tier 3 |
| Multi-location gym chains | Tier 3 |
| Monthly business report generation | Tier 3 |
| Member spotlights (AI-drafted recognition) | Tier 3 |
| Form videos on machine pages | Tier 3 |
| Program accept/reject flow | Tier 3 |
| Rest day streak protection (Growth+) | Tier 4 |
| Travel grace period (Pro) | Tier 4 |
| Multi-step agent sequences, send-time optimization, friend challenges, A/B agent messages | Tier 2-3 (research-flagged) |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ONBD-01 | Phase 1 | Pending |
| ONBD-02 | Phase 1 | Complete |
| ONBD-03 | Phase 1 | Complete |
| ONBD-04 | Phase 1 | Complete |
| ONBD-05 | Phase 1 | Complete |
| ONBD-06 | Phase 1 | Complete |
| ONBD-07 | Phase 1 | Complete |
| FEED-01 | Phase 2 | ✅ Complete (2026-07-17) |
| FEED-02 | Phase 2 | ✅ Complete (2026-07-17) |
| FEED-03 | Phase 2 | ✅ Complete (2026-07-17) |
| FEED-04 | Phase 2 | ✅ Complete (2026-07-17) |
| CHAL-01 | Phase 3 | Pending |
| CHAL-02 | Phase 3 | Pending |
| CHAL-03 | Phase 3 | Pending |
| CHAL-04 | Phase 3 | Pending |
| PROG-01 | Phase 4 | Pending |
| PROG-02 | Phase 4 | Pending |
| PROG-03 | Phase 4 | Pending |
| PROG-04 | Phase 4 | Pending |
| AGENT-01 | Phase 5 | Pending |
| AGENT-02 | Phase 5 | Pending |
| AGENT-03 | Phase 5 | Pending |
| AGENT-04 | Phase 5 | Pending |
| AGENT-05 | Phase 5 | Pending |
| NOTIF-01 | Phase 6 | Pending |
| NOTIF-02 | Phase 6 | Pending |
| NOTIF-03 | Phase 6 | Pending |
| NOTIF-04 | Phase 6 | Pending |
| NOTIF-05 | Phase 6 | Pending |
| NOTIF-06 | Phase 6 | Pending |

**Coverage:** 30/30 v1.0 requirements mapped. No orphans, no duplicates.

---
*Requirements defined 2026-07-19 (retroactive for milestone started 2026-06-03; Phase 2 delivered 2026-07-17). Update Traceability as phases complete.*
