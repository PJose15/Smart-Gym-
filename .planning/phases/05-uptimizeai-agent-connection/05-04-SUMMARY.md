---
phase: 05-uptimizeai-agent-connection
plan: 04
subsystem: api
tags: [agents, feature-gate, upgrade-opportunity, new-gym-onboarded, revenue-agent, growth-agent, tdd]

# Dependency graph
requires:
  - phase: 05-uptimizeai-agent-connection
    provides: "PLATFORM_EVENTS bypass for upgrade-opportunity + new-gym-onboarded; trigger route cooldown dedup (05-02)"
  - phase: 05-uptimizeai-agent-connection
    provides: "Migration 029; echo receiver; env vars contract (05-01)"
provides:
  - "shouldTriggerUpgradeAgent guard + fireUpgradeOpportunity helper in featureGate.ts"
  - "Automation #8: upgrade-opportunity wired at machine-limit 403 denial surface"
  - "Automation #13: new-gym-onboarded wired at registration RPC success"
  - "Reusable guard list (UPGRADE_NUDGE_FEATURES) for future feature-gate callers"
affects: [05-05, 05-06, 06-notification-orchestration-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard list pattern: UPGRADE_NUDGE_FEATURES constant filters which denials fire revenue-agent"
    - "Fire-and-forget void function: synchronous call + .catch() never blocks response path"
    - "TDD RED-then-GREEN: failing tests committed before each implementation"
    - "No dedup_key for new-gym-onboarded: 30-day cooldown per (gym, event) makes it once-per-gym"
    - "dedup_key=feature for upgrade-opportunity: 7-day per-(gym, feature) cooldown via trigger route"

key-files:
  created:
    - apps/web-admin/src/lib/billing/__tests__/featureGate-upgrade.test.ts
  modified:
    - apps/web-admin/src/lib/billing/featureGate.ts
    - apps/web-admin/src/app/api/gym/[gymId]/machines/route.ts
    - apps/web-admin/src/app/api/onboard/register/route.ts
    - apps/web-admin/src/app/api/onboard/__tests__/register.test.ts

key-decisions:
  - "UPGRADE_NUDGE_FEATURES excludes leaderboards/social_feed/push_notifications/franchise_support: low-value/internal gates that would spam the revenue agent on every denial"
  - "fireUpgradeOpportunity is NOT called inside checkFeatureAccess: avoids firing from internal/admin bypass reads; only explicit call sites trigger the nudge"
  - "machines/route.ts is the only live feature-gate denial surface today: checkFeatureAccess has zero callers; wiring the TIER_LIMITS 403 branch is the one concrete callsite"
  - "No await on either trigger call: fire-and-forget by design; response path never waits on agent"
  - "No PII in new-gym-onboarded payload: gym_id/gym_name/gym_type only; no email or owner_name"

# Metrics
duration: 41min
completed: 2026-07-20
---

# Phase 05 Plan 04: Upgrade-Opportunity + New-Gym-Onboarded Wiring Summary

**shouldTriggerUpgradeAgent guard + fireUpgradeOpportunity helper in featureGate.ts; machine-limit 403 fires revenue-agent upgrade-opportunity; registration success fires growth-agent new-gym-onboarded**

## Performance

- **Duration:** 41 min
- **Started:** 2026-07-20T03:40:25Z
- **Completed:** 2026-07-20T04:21:00Z
- **Tasks:** 2 (both TDD — RED then GREEN)
- **Files modified:** 5 (3 prod + 2 test)

## Accomplishments

- `featureGate.ts` extended with `UPGRADE_NUDGE_FEATURES` guard list (5 features), `shouldTriggerUpgradeAgent` export, and `fireUpgradeOpportunity` fire-and-forget helper with `.catch()` error swallowing
- `gym/[gymId]/machines/route.ts`: `fireUpgradeOpportunity(gymId, 'max_machines', 'growth')` at the `count >= limit` 403 denial — synchronous void call, response path unaffected
- `onboard/register/route.ts`: `triggerUptimizeAIAgent('growth-agent', {...})` fire-and-forget after RPC success, before response — no PII, PLATFORM_EVENT comment explaining tier-bypass
- 15 new featureGate-upgrade tests: 9 `shouldTriggerUpgradeAgent` cases (5 true + 4 false) + 6 `fireUpgradeOpportunity` cases (payload contract, guard, no-throw)
- 4 new register tests (T6-T9): agent fires on success, not on 409/500, rejection doesn't change 200
- Both new-gym-onboarded and upgrade-opportunity fire as plain `.catch()` — no `await` in either route; verified with grep

## Task Commits

1. **Task 1 RED** — `0cfa02a` (test) — 15 failing featureGate-upgrade tests
2. **Task 1 GREEN** — `c183b5b` (feat) — featureGate.ts helpers + machines/route.ts wiring; all 15 pass
3. **Task 2 RED** — `a497b20` (test) — 4 new register tests (T6-T9); T6 fails (agent not yet wired)
4. **Task 2 GREEN** — `8ed665d` (feat) — register/route.ts wired; all 9 register tests pass

## Files Created/Modified

- `apps/web-admin/src/lib/billing/featureGate.ts` — Added: `triggerAgent` import, `UPGRADE_NUDGE_FEATURES`, `shouldTriggerUpgradeAgent`, `fireUpgradeOpportunity`
- `apps/web-admin/src/lib/billing/__tests__/featureGate-upgrade.test.ts` — New: 15 tests for guard list + payload contract + no-throw guarantee
- `apps/web-admin/src/app/api/gym/[gymId]/machines/route.ts` — Added: `fireUpgradeOpportunity` import + call at machine-limit 403
- `apps/web-admin/src/app/api/onboard/register/route.ts` — Added: `triggerUptimizeAIAgent` import + fire-and-forget after RPC success
- `apps/web-admin/src/app/api/onboard/__tests__/register.test.ts` — Extended: `triggerAgent` mock + T6-T9 agent wiring tests

## Decisions Made

- **UPGRADE_NUDGE_FEATURES excludes low-value gates:** leaderboards, social_feed, push_notifications, franchise_support excluded. Only high-intent denials (ai_programs, challenges, coach_notes, custom_branding, max_machines) trigger the nudge — prevents spam.
- **fireUpgradeOpportunity not inside checkFeatureAccess:** Deliberately kept as a call-site decision. Internal/admin reads of checkFeatureAccess should not fire nudges; only user-facing denial paths should.
- **machines/route.ts is the only concrete wiring point today:** checkFeatureAccess has zero callers in the codebase; the TIER_LIMITS 403 branch is the only live denial surface. The reusable helper is ready for future callers.
- **No await on trigger calls:** Both automations are fire-and-forget. User-facing responses must never wait on agent delivery.
- **No PII in new-gym-onboarded:** gym_id, gym_name, gym_type only. No email or owner_name in the payload.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `featureGate.ts` FOUND with shouldTriggerUpgradeAgent + fireUpgradeOpportunity exports
- `featureGate-upgrade.test.ts` FOUND (15 tests)
- `machines/route.ts` FOUND with fireUpgradeOpportunity call
- `register/route.ts` FOUND with triggerUptimizeAIAgent call
- `register.test.ts` FOUND with T6-T9
- Commit `0cfa02a` (RED 1): FOUND
- Commit `c183b5b` (GREEN 1): FOUND
- Commit `a497b20` (RED 2): FOUND
- Commit `8ed665d` (GREEN 2): FOUND
- No await on trigger calls: VERIFIED (grep confirms)
- featureGate-upgrade tests: 15/15 PASS
- register tests: 9/9 PASS
- tsc: EXIT CODE 0

---
*Phase: 05-uptimizeai-agent-connection*
*Completed: 2026-07-20*
