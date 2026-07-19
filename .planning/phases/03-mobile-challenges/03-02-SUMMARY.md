---
phase: 03-mobile-challenges
plan: "02"
subsystem: mobile-data-layer
tags: [mobile, challenges, tdd, service-layer, supabase, expo-haptics]
dependency_graph:
  requires: [03-01]
  provides: [challengeLogic.ts, challengeService.ts, resolveMemberInfo export]
  affects: [wave-2-challenge-screens]
tech_stack:
  added: [expo-haptics@~14.0.1]
  patterns:
    - feedService/feedLogic split mirrored for challenges
    - TDD red/green per task (5 commits: 1 chore + 2 RED + 2 GREEN)
    - injected now param for deterministic time logic
    - resolveMemberInfo reused from feedService (no duplication)
    - Bearer JWT join via EXPO_PUBLIC_API_URL env var
key_files:
  created:
    - apps/mobile/src/lib/challengeLogic.ts
    - apps/mobile/src/lib/__tests__/challengeLogic.test.ts
    - apps/mobile/src/lib/challengeService.ts
    - apps/mobile/src/lib/__tests__/challengeService.test.ts
  modified:
    - apps/mobile/package.json
    - apps/mobile/.env.example
    - apps/mobile/src/lib/cacheManager.ts
    - apps/mobile/src/lib/feedService.ts
    - apps/mobile/jest.setup.js
decisions:
  - "expo-haptics pinned to ~14.0.1 (SDK 52 compatible, expo install --check reveals this); pnpm resolved 57.x by default but Expo CLI confirmed 14.x"
  - "progressPct uses my_score/top_score ratio — no goal_value column exists in DB (research-confirmed)"
  - "fetchChallengeDetail returns null (not throw) for missing challenge — stale deep link graceful handling"
  - "resolveMemberInfo exported from feedService.ts to avoid duplication in challengeService"
  - "jest.setup.js extended with getSession mock for joinChallenge test isolation"
  - "formatScore volume/pr: convertFromLbs from feedLogic.ts (no KG_PER_LB constant duplication)"
metrics:
  duration: "9 minutes"
  completed: "2026-07-19"
  tasks_total: 3
  tasks_completed: 3
  files_created: 4
  files_modified: 5
  tests_added: 54
  tests_total: 189
---

# Phase 3 Plan 2: Mobile Challenges Data Layer Summary

**One-liner:** TDD-built challenges data layer — pure challengeLogic.ts (39 tests) + direct-Supabase challengeService.ts (15 tests) with expo-haptics, EXPO_PUBLIC_API_URL env, and CacheTTL extension.

## What Was Built

Wave 1 of the mobile challenges phase: the entire data layer that Wave 2 screens will consume without touching Supabase directly.

### Task 1 — Prerequisites (commit `8445de0`)

- `expo-haptics@~14.0.1` installed in `apps/mobile/` (SDK 52 compatible; Expo CLI confirms 14.x, pnpm default was 57.x — corrected)
- `EXPO_PUBLIC_API_URL=http://localhost:3000` appended to `.env.example` with explanation comment
- `CacheTTL.challengesList` (5 min) and `CacheTTL.challengeDetail` (2 min) added to `cacheManager.ts`

### Task 2 — challengeLogic.ts (RED `7dffcf6`, GREEN `6a3b8c7`)

Pure functions (no Supabase, no React), 39 tests:

- `splitByStatus(challenges)` — active sorted end_date ascending, completed descending
- `progressPct(myScore, topScore)` — null/negative/zero/clamp 0-100; no goal_value column
- `formatScore(score, type, unit)` — volume/pr lbs→kg via `convertFromLbs`; sessions/streak/machine_explorer/team/custom as plain integers with unit labels
- `countdownLabel(endDate, now)` — injected `now` for determinism (mirrors Phase 1 computeDaysRemaining pattern)
- `buildLeaderboardRows(participants, myMemberId, topN=10)` — top/pinnedMe split; pinnedMe null when inside topN or not a participant
- `canJoin(detail)` — active && !is_joined && entry_mode !== 'invite'
- `challengeIcon(type)` — 7-type emoji record, '🎯' fallback

### Task 3 — challengeService.ts (RED `11b79cc`, GREEN `9f908ba`)

Supabase data layer + API-route join, 15 tests:

- `fetchChallenges(gymId, memberId)` — gym_challenges list + own participation + participant counts in 3 parallel queries (no N+1); maps to ChallengeListItem[] with is_joined/my_score/rank/total_participants/progress_pct/days_left
- `fetchChallengeDetail(challengeId, memberId)` — `.maybeSingle()` returns null for deleted/stale deep link (not throw); participants resolved via `resolveMemberInfo` from feedService.ts
- `joinChallenge(challengeId, memberId, gymId)` — Bearer JWT POST to `${EXPO_PUBLIC_API_URL}/api/member/challenges/${id}/join`; maps 201→'joined', 409→'already_joined', 400→'ended', other→'error', throw→'error', no session→'error' without fetch
- `CHALLENGES_CACHE_KEY(gymId)` / `CHALLENGE_DETAIL_CACHE_KEY(id)` — helper functions returning cache key strings
- `feedService.ts`: `resolveMemberInfo` made `export` (was module-private)
- `jest.setup.js`: `getSession` added to `auth` mock

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| challengeLogic.test.ts | 39 | PASS |
| challengeService.test.ts | 15 | PASS |
| Baseline (8 suites) | 135 | PASS |
| **Total** | **189** | **ALL GREEN** |

tsc --noEmit: CLEAN

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] expo-haptics version mismatch**
- **Found during:** Task 1 — pnpm resolved ^57.0.1, but Expo SDK 52 requires ~14.0.1
- **Fix:** Ran `pnpm remove expo-haptics && pnpm add expo-haptics@~14.0.1` after confirming with `npx expo install expo-haptics --check`
- **Files modified:** `apps/mobile/package.json`
- **Commit:** `8445de0`

**2. [Rule 2 - Missing functionality] jest.setup.js missing getSession mock**
- **Found during:** Task 3 GREEN — `joinChallenge` tests failed with "Cannot read properties of undefined (reading 'mockResolvedValue')" because `supabase.auth.getSession` was not in the global mock
- **Fix:** Added `getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null })` to jest.setup.js
- **Files modified:** `apps/mobile/jest.setup.js`
- **Commit:** `9f908ba`

## Self-Check: PASSED

All created files found. All 5 per-task commits verified in git log. 189 tests pass, tsc clean.
