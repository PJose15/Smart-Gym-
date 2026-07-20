---
phase: 06-notification-orchestration
plan: 07
subsystem: api
tags: [typescript, push-notifications, billing-webhook, cron, agent-initiated, tdd]

# Dependency graph
requires:
  - "06-01 (NotificationType union — trial_ending, payment_failed, subscription_cancelled, member_at_risk, weekly_summary, checkin_overdue, machine_underutilized, agent_dormant_alert, agent_welcome, challenge_complete all in union)"
  - "06-03 (sendNotification dispatcher + resolveOwnerProfileId)"
  - "06-05 (challenge_complete participant push pattern established)"
provides:
  - "Billing webhook owner pushes: trial_ending, payment_failed, subscription_cancelled via resolveOwnerProfileId"
  - "agent-daily cron pushes: agent_dormant_alert (member), checkin_overdue (owner), machine_underutilized (owner), challenge_complete (participants)"
  - "agent-weekly cron pushes: weekly_summary (owner), member_at_risk (owner, no PII, one per gym)"
  - "Onboarding route agent_welcome push on member completion"
  - "pushes_dispatched counter in both cron responses"
affects:
  - "06-06 (completes NOTIF-02: remaining 5 types — feed_reaction, feed_comment, new_follower, program_assigned, leaderboard_rank — are 06-06 scope)"
  - "06-09 (mobile inbox receives all agent-initiated notifications)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget async IIFE: (async () => { ... })() for webhook owner pushes — response never blocked or failed by push errors"
    - "resolveOwnerProfileId(admin, gymId) → null guard before sendNotification — no dispatch, no throw"
    - "is_agent_initiated:true on all cron-sourced dispatches; omitted on Stripe/business event pushes"
    - "Per-gym dedup for owner pushes: Set<string> over gymIds from batched scan results — one push per gym per run"
    - "challenge_complete push to participants: admin.from('challenge_participants').select('member_id').eq('challenge_id', ...) within existing expiry loop"
    - "member_at_risk: ONE owner push per gym per run regardless of at-risk count (barrage rule, no PII)"

key-files:
  created:
    - "apps/web-admin/src/app/api/billing/webhook/__tests__/webhook-push.test.ts"
  modified:
    - "apps/web-admin/src/app/api/billing/webhook/route.ts"
    - "apps/web-admin/src/app/api/cron/agent-daily/route.ts"
    - "apps/web-admin/src/app/api/cron/agent-weekly/route.ts"
    - "apps/web-admin/src/app/api/members/onboard/route.ts"
    - "apps/web-admin/src/app/api/cron/agent-daily/__tests__/agent-daily.test.ts"
    - "apps/web-admin/src/app/api/cron/agent-weekly/__tests__/agent-weekly.test.ts"

key-decisions:
  - "[Phase 06-07-billing-webhook]: Billing pushes (trial_ending, payment_failed, subscription_cancelled) omit is_agent_initiated — they are Stripe/business events, not agent outputs"
  - "[Phase 06-07-billing-webhook]: Webhook owner push wrapped in async IIFE with catch — route response never blocked by push failures"
  - "[Phase 06-07-daily-cron]: checkin_overdue and machine_underutilized owner pushes: one per unique affected gym per run (Set dedup) — dispatcher 5-min dedup is the backstop for reruns"
  - "[Phase 06-07-daily-cron]: challenge_complete participant push fetches challenge_participants inside the auto-expiry loop — no separate scan pass"
  - "[Phase 06-07-weekly-cron]: member_at_risk push is exactly ONE per gym per run regardless of at-risk member count (barrage rule) — no member names or IDs in push payload"
  - "[Phase 06-07-onboard]: agent_welcome dispatched fire-and-forget after onboarding_events insert — no_devices is expected/harmless for fresh members"

requirements-completed: [NOTIF-02]

# Metrics
duration: 14min
completed: 2026-07-20
---

# Phase 6 Plan 7: Operational/Billing/Agent-Output Push Wiring Summary

**Owner billing pushes (trial_ending/payment_failed/subscription_cancelled via resolveOwnerProfileId) + agent cron delivery (agent_dormant_alert, checkin_overdue, machine_underutilized, challenge_complete, weekly_summary, member_at_risk all is_agent_initiated:true) + agent_welcome on onboarding completion**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-20T14:04:21Z
- **Completed:** 2026-07-20T14:18:11Z
- **Tasks:** 3
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments
- Wired 9 notification types across 4 routes completing the operational/billing/agent cluster of NOTIF-02
- Billing webhook: fire-and-forget owner pushes for all 3 Stripe billing events; agent triggers preserved and untouched; null owner guard prevents throws
- Agent-daily cron: 4 push paths (dormant member re-engagement, owner checkin SLA alert, owner machine usage alert, participant challenge_complete on auto-expiry); pushes_dispatched counter added
- Agent-weekly cron: 2 owner push paths (weekly_summary, member_at_risk with no PII — one per gym per run); pushes_dispatched counter added
- Onboarding: agent_welcome dispatched fire-and-forget after member activation; no_devices expected for fresh members

## Task Commits

1. **Task 1: Billing webhook owner pushes (TDD)** - `3a472fb` (feat)
2. **Task 2: Agent cron delivery — daily + weekly** - `80889c7` (feat)
3. **Task 3: agent_welcome on member onboarding** - `55026e9` (feat)

## Files Created/Modified
- `apps/web-admin/src/app/api/billing/webhook/route.ts` — Added getAdminClient, resolveOwnerProfileId + sendNotification imports, fire-and-forget owner push IIFE in each billing switch case
- `apps/web-admin/src/app/api/billing/webhook/__tests__/webhook-push.test.ts` — 8 TDD tests: all 3 billing actions, agent trigger co-fire, null owner resilience, push error resilience
- `apps/web-admin/src/app/api/cron/agent-daily/route.ts` — 4 push paths added; pushes_dispatched counter; challenge_participants query for challenge_complete
- `apps/web-admin/src/app/api/cron/agent-daily/__tests__/agent-daily.test.ts` — dispatcher mock added; challenge_participants table chain added to Supabase mock
- `apps/web-admin/src/app/api/cron/agent-weekly/route.ts` — weekly_summary + member_at_risk owner pushes per gym; pushes_dispatched counter
- `apps/web-admin/src/app/api/cron/agent-weekly/__tests__/agent-weekly.test.ts` — dispatcher mock added
- `apps/web-admin/src/app/api/members/onboard/route.ts` — sendNotification import; agent_welcome fire-and-forget after onboarding_events insert

## Decisions Made
- Billing pushes omit is_agent_initiated (they are business/Stripe events); all cron pushes set is_agent_initiated:true (agent outputs)
- Owner pushes for checkin_overdue/machine_underutilized are per-unique-gym (Set dedup) not per-checkin/machine — one alert per gym per run
- challenge_complete participants fetched inline within the expiry loop — avoids a second DB pass
- member_at_risk: exactly one push per gym regardless of how many at-risk members (no PII barrage rule)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added dispatcher mock to existing cron test files**
- **Found during:** Task 2 verification
- **Issue:** agent-daily/agent-weekly tests failed because new imports of resolveOwnerProfileId/sendNotification from dispatcher were not mocked — the Supabase mock covered admin client calls but not the dispatcher module
- **Fix:** Added `jest.mock('@/lib/notifications/dispatcher', ...)` with mockResolveOwnerProfileId/mockSendNotification to both test files; set defaults in beforeEach; added challenge_participants table chain to agent-daily Supabase mock
- **Files modified:** agent-daily.test.ts, agent-weekly.test.ts
- **Verification:** All 20 existing cron tests pass after mock addition
- **Committed in:** `80889c7` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing test infrastructure for new imports)
**Impact on plan:** Required to keep existing test suites green after new dispatcher imports. No scope creep.

## Issues Encountered
- 24-type coverage audit yields 19 (not 24): the 5 remaining types (feed_reaction, feed_comment, new_follower, program_assigned, leaderboard_rank) are scoped to 06-06, which has no SUMMARY.md indicating it was not yet executed. This plan wired its 9 types correctly; the overall NOTIF-02 completion depends on 06-06 executing.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 06-07 types all live; 06-05 + 06-07 together cover 19 of 24 notification types
- 06-06 (coaching/social pushes) must execute to complete NOTIF-02 and reach 24/24
- 06-09 (mobile inbox) and 06-10 (delivery health dashboard) can proceed independently of 06-06

---
*Phase: 06-notification-orchestration*
*Completed: 2026-07-20*
