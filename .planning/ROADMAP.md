# Roadmap — Milestone v1.0 "Tier 1 Launch Blockers"

**Created:** 2026-07-19 (retroactive; milestone started 2026-06-03)
**Goal:** Ship the 6 capabilities that block public launch — gym customer acquisition flow + core mobile engagement + automation layer.
**Coverage:** 30/30 v1.0 requirements mapped (see REQUIREMENTS.md Traceability).

## Context Notes

- Brownfield: backend exists for most of this. Phases 3-4 are mobile UI on working APIs; Phases 5-6 are wiring on existing infra; Phase 1 is the most novel build (new auth+billing flow, CSV import).
- **Phase 2 already delivered** (2026-07-17, commits `cba42c0` + `af69753`) before this roadmap was written — marked complete below, no planning needed.
- Database is clean as of migrations 024-026 (DOC_02 reconciliation): the "4 ghost tables" note in PROJECT.md Context is resolved; client grants restored. Migrations now 001-026.
- Full demo environment exists (Iron Society, 50 members, deterministic UUIDs) via `supabase/seed-bulk.sql` + `DEMO_SETUP.md` — use it to verify success criteria.
- Design system (DOC_03) fully implemented: brand fonts, purple `#7C5CFF` token palette, celebration components, skeletons. **All new UI in Phases 1, 3, 4, 6 must use these tokens/components** — no ad-hoc colors.
- Test baseline: 803 tests (399 ai-assist + 269 web-admin + 135 mobile). CI (ESLint + tsc + tests) must stay green.
- Phase ordering vs dependencies: research recommends the notification dispatcher before agent wiring. Phase 5 stays before Phase 6 per milestone plan, but Phase 5 planning should either build the minimal dispatcher early or scope agent output to owner email + logs until Phase 6 lands (see Phase 5 dependency note).

## Phases

- [ ] **Phase 1: Gym Owner Self-Serve Onboarding** - 4-step signup → Stripe trial checkout → first-machine wizard → member CSV import
- [x] **Phase 2: Mobile Social Feed** - COMPLETE 2026-07-17 — full mobile feed tab (18 event types, reactions, comments, realtime, follow/unfollow, unread badge, workout share)
- [ ] **Phase 3: Mobile Challenges** - Browse, join, track progress, and view leaderboards from mobile (existing backend)
- [ ] **Phase 4: Mobile Program View** - Full week/day program visibility on mobile (existing backend)
- [ ] **Phase 5: UptimizeAI Agent Connection** - 13 automations wired end-to-end through the existing agent webhook infra
- [ ] **Phase 6: Notification Orchestration Wiring** - 24+ push triggers through a preference-enforcing dispatcher, with inbox + deep links

## Phase Details

### Phase 1: Gym Owner Self-Serve Onboarding
**Goal**: A gym owner can go from landing page to a working, billed gym — account, plan, first machine QR, and imported members — with zero human intervention
**Depends on**: Nothing (first phase; standalone web-admin work)
**Requirements**: ONBD-01, ONBD-02, ONBD-03, ONBD-04, ONBD-05, ONBD-06, ONBD-07
**Success Criteria** (what must be TRUE):
  1. A new owner completes the 4-step wizard (account → gym info → plan → Stripe checkout) and lands on their own dashboard with a trialing subscription — no manual admin steps
  2. Abandoning any step (including Stripe checkout) never leaves a stuck state: the owner can resume, and no orphaned auth users / duplicate gyms exist even under webhook retries
  3. The owner creates their first machine through the guided wizard and downloads a printable QR PDF that scans into the member flow
  4. The owner imports a real Excel-exported member CSV, sees a per-row success/failure report, and imported members can claim accounts via phone OTP on mobile
  5. The dashboard shows a setup checklist and trial countdown that reflect actual completion state
**Dependency notes**: Existing billing code at `apps/web-admin/src/app/api/billing/*` + `lib/billing/stripeHelpers.ts` handles checkout/portal/webhooks — this phase adds the pre-checkout gym-creation path, `stripe_events_processed` idempotency, `checkout.session.completed/expired` handlers, and the `(onboard)/` unauthenticated route group. Key pitfalls: webhook idempotency (P1), atomic gym creation (P2), RLS/session refresh (P3), CSV BOM + partial import (P4/P5), ghost checkout state (P6). New deps: `react-hook-form`, `@hookform/resolvers`, `csv-parse`.
**Plans:** 8/9 plans executed

Plans:
- [x] 01-01-PLAN.md — Migration 027 (idempotency table, 'invited' status, atomic-gym + bulk-import RPCs) + deps install [wave 1, checkpoint: db push] ✅ COMPLETE 2026-07-19
- [ ] 01-02-PLAN.md — Stripe webhook idempotency + checkout.session.completed/expired + hardened createCheckoutSession [wave 1]
- [ ] 01-03-PLAN.md — POST /api/machines route + shared MachineForm component [wave 1]
- [ ] 01-04-PLAN.md — Owner dashboard setup checklist + trial countdown banner [wave 1]
- [x] 01-05-PLAN.md — (onboard)/ route group, register API with rollback, signup + verify-email pages [wave 2] ✅ COMPLETE 2026-07-19
- [ ] 01-06-PLAN.md — Subscribe page: session handshake, live-price tier picker, abandonment resume [wave 3]
- [x] 01-07-PLAN.md — First-machine wizard with QR PDF download [wave 3] ✅ COMPLETE 2026-07-19
- [ ] 01-08-PLAN.md — CSV member import (validate-then-import) + phone-OTP claim link [wave 3]
- [ ] 01-09-PLAN.md — Full automated gate + end-to-end walkthrough checkpoint [wave 4]

### Phase 2: Mobile Social Feed ✅ COMPLETE
**Goal**: Members experience their gym community from their phone — the full feed, reactions, comments, and sharing
**Delivered**: 2026-07-17 (commits `cba42c0`, `af69753`) — before this roadmap was written; no GSD plans were executed for it
**Requirements**: FEED-01, FEED-02, FEED-03, FEED-04 (all complete)
**Success Criteria** (verified delivered):
  1. ✓ Member sees the gym feed tab rendering all 18 event types with pull-to-refresh and pagination
  2. ✓ Member reacts and comments from mobile with optimistic updates
  3. ✓ Feed updates in realtime and an unread badge surfaces new activity
  4. ✓ Member can follow/unfollow others and share workouts to the feed
**Dependency notes**: Shipped with migrations 024-026 (DOC_02 schema reconciliation — ghost tables resolved, client grants restored). Establishes the mobile community-surface patterns (cursor pagination, gym_id session validation) that Phases 3-4 should reuse.
**Plans**: — (delivered pre-roadmap)

### Phase 3: Mobile Challenges
**Goal**: Members can discover, join, and compete in gym challenges entirely from their phone
**Depends on**: Phase 2 patterns (tab/screen structure, cache keys, session-validated gym_id) — backend already exists (`gym_challenges`, `challenge_participants`, join/leaderboard endpoints)
**Requirements**: CHAL-01, CHAL-02, CHAL-03, CHAL-04
**Success Criteria** (what must be TRUE):
  1. Member browses active and completed challenges with type, description, and end-date countdown
  2. Member joins a challenge with one tap and appears on its leaderboard within a minute
  3. Member sees their own progress toward the challenge goal after logging qualifying workouts
  4. Member finds their own rank on the leaderboard even when outside the top ranks (pinned "YOU" row)
  5. Opening a deleted or ended challenge (e.g., from a stale deep link) shows a graceful "no longer available" state, never a crash
**Dependency notes**: Consumption-only — challenge creation stays in web admin. Use aggregated screen endpoints (avoid the 20-query home-screen anti-pattern), leaderboard caching, and DOC_03 tokens/celebration components. Rank-change push trigger lands in Phase 6, not here.
**Plans**: TBD

### Phase 4: Mobile Program View
**Goal**: Members see their full training program — where they are, what's next, and what each day holds — not just today's slice
**Depends on**: Nothing hard (independent modal route; `/api/member/[id]/program` already returns everything needed). Reuses Phase 2/3 screen patterns.
**Requirements**: PROG-01, PROG-02, PROG-03, PROG-04
**Success Criteria** (what must be TRUE):
  1. Member opens a full program view showing program name, goal, duration, trainer, and overall week progress
  2. Member scrolls all program days with exercises shown as sets × reps; today is visually highlighted and completed days are checked
  3. Member taps "Start today's workout" and lands in the workout/scan flow; tapping an exercise opens its detail screen
  4. Member without an assigned program sees a helpful empty state instead of a blank screen
**Dependency notes**: Read-only view — no exercise swapping or editing from mobile (swaps stay in the machine/scan flow; editing stays in web admin; accept/reject is Tier 3 out of scope). Pure UI work, no new API routes.
**Plans**: TBD

### Phase 5: UptimizeAI Agent Connection
**Goal**: The 13 specified automations run end-to-end — real events fire real agents that take real actions, safely and observably
**Depends on**: Phase 1 (new-gym-onboarded trigger source; imported members give retention agents data to act on). Pre-GSD Phase 7 built the webhook infra (`/api/agents/trigger`, `triggerUptimizeAIAgent()`, `gym_agent_config`, `smartgym_agent_logs`, tier gating).
**Requirements**: AGENT-01, AGENT-02, AGENT-03, AGENT-04, AGENT-05
**Success Criteria** (what must be TRUE):
  1. A triggering event (e.g., Stripe trial-ending, member level-up) produces a verified call arriving at the UptimizeAI engine — not just a log row
  2. The same (gym, agent, event) combination cannot fire more than once per cooldown window, and no agent → notification → agent loop is possible
  3. All 13 automations (3 retention, 3 engagement, 2 revenue, 3 operations, 2 growth) demonstrably fire from their event or cron sources in staging against the demo environment
  4. Starter-tier gyms get no agent fires; Growth/Pro gyms get exactly their tier's agent set
  5. Every fire — success, skip, dedup, or failure — is visible in `smartgym_agent_logs`
**Dependency notes**: Sequenced before Phase 6 per milestone plan, but most agents output member pushes whose delivery layer lands in Phase 6. Phase 5 planning must resolve this: either build the minimal notification dispatcher (NOTIF-01 core) as Phase 5's first plan, or scope Phase 5 agent outputs to owner email + logged actions and activate member pushes in Phase 6. Loop-safety dedup (AGENT-02) is the first task before wiring any trigger (Pitfall 7).
**Plans**: TBD

### Phase 6: Notification Orchestration Wiring
**Goal**: Members and owners get timely, relevant, controllable push notifications for everything that matters — and nothing they opted out of
**Depends on**: Phases 3-5 (challenge rank triggers need Phase 3 screens as deep-link targets; program-assigned links need Phase 4; agent outputs from Phase 5 deliver through this layer). Expo push infra + `send-push-notification` Edge Function already exist.
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06
**Success Criteria** (what must be TRUE):
  1. A member who hits a PR, earns a badge, gets a coach note, or moves up a challenge leaderboard receives a push within a minute — and tapping it lands on exactly the right screen
  2. A member who disables a category (or is in quiet hours) provably receives nothing from that category, enforced server-side
  3. One workout that triggers multiple events (PR + badge + streak) does not produce a barrage — dedup and rate caps hold
  4. Member reviews past notifications in an inbox with unread badge; read state syncs on tap
  5. Uninstalled devices stop receiving sends: stale Expo tokens are auto-deactivated via receipt polling, and delivery rate is visible to admins
**Dependency notes**: Build order from research: dispatcher first (everything depends on it), then `NotificationType`/`NOTIFICATION_ROUTES` expansion, then trigger wiring by value (session-complete cluster → coaching → social), then preferences UI, inbox, receipt-polling cron. `is_agent_initiated` flag in the payload schema is required for Phase 5 loop safety. No PII in push bodies (lock-screen exposure).
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Gym Owner Self-Serve Onboarding | 8/9 | In Progress|  |
| 2. Mobile Social Feed | — | ✅ Complete (delivered pre-roadmap) | 2026-07-17 |
| 3. Mobile Challenges | 0/? | Not started | - |
| 4. Mobile Program View | 0/? | Not started | - |
| 5. UptimizeAI Agent Connection | 0/? | Not started | - |
| 6. Notification Orchestration Wiring | 0/? | Not started | - |

---
*Roadmap created 2026-07-19. Next: `/gsd:plan-phase 1` (user priority: plan Owner Onboarding in full executable detail first).*
