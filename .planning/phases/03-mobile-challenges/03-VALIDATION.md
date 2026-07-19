---
phase: 3
slug: mobile-challenges
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-19
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest (mobile), jest 30.x/ts-jest (web-admin) |
| **Config file** | `apps/mobile/jest.config.js` |
| **Quick run command** | `cd apps/mobile && npx jest --silent` |
| **Full suite command** | `cd apps/mobile && npx tsc --noEmit && npx jest --silent && cd ../web-admin && npx tsc --noEmit && npx jest --silent` |
| **Estimated runtime** | ~30 seconds full, ~10 seconds quick |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` command, then `cd apps/mobile && npx jest --silent`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite green + tsc clean both apps
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

*Filled by gsd-planner — every plan task maps to a requirement + automated command.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01/T1 | 03-01 | 1 | CHAL-04 | file check | `grep 'challenge_participants_member_gym_read' supabase/migrations/028_challenge_member_read.sql` | ❌ created by task | ⬜ pending |
| 03-01/T2 | 03-01 | 1 | CHAL-02 | unit (TDD) | `cd apps/web-admin && npx jest --silent --testPathPattern=verifyMember` | ❌ created RED-first by task | ⬜ pending |
| 03-01/T3 | 03-01 | 1 | CHAL-04 | checkpoint:human-action | Supabase MCP execute_sql pg_policies check after `npx supabase db push --linked` | — | ⬜ pending |
| 03-02/T1 | 03-02 | 1 | CHAL-02 | config check | `grep '"expo-haptics"' apps/mobile/package.json && cd apps/mobile && npx tsc --noEmit` | ✅ (package.json) | ⬜ pending |
| 03-02/T2 | 03-02 | 1 | CHAL-01, CHAL-03, CHAL-04 | unit (TDD) | `cd apps/mobile && npx jest --silent --testPathPattern=challengeLogic` | ❌ created RED-first by task | ⬜ pending |
| 03-02/T3 | 03-02 | 1 | CHAL-01, CHAL-02, CHAL-04 | unit (TDD) | `cd apps/mobile && npx jest --silent --testPathPattern=challengeService` | ❌ created RED-first by task | ⬜ pending |
| 03-03/T1 | 03-03 | 2 | CHAL-01, CHAL-03 | tsc + grep | `cd apps/mobile && npx tsc --noEmit` + progressPct wiring grep | — | ⬜ pending |
| 03-03/T2 | 03-03 | 2 | CHAL-01 | tsc + full suite | `cd apps/mobile && npx tsc --noEmit && npx jest --silent` | ✅ (suite) | ⬜ pending |
| 03-03/T3 | 03-03 | 2 | CHAL-01 | tsc + grep | `cd apps/mobile && npx tsc --noEmit` + trophy tab grep | — | ⬜ pending |
| 03-04/T1 | 03-04 | 2 | CHAL-04 | tsc + grep | `cd apps/mobile && npx tsc --noEmit` + buildLeaderboardRows/medal grep | — | ⬜ pending |
| 03-04/T2 | 03-04 | 2 | CHAL-02, CHAL-03, CHAL-04 | tsc + full suite + grep | `cd apps/mobile && npx tsc --noEmit && npx jest --silent` + not-found/haptic/route greps | ✅ (suite) | ⬜ pending |
| 03-05/T1 | 03-05 | 3 | CHAL-01..04 | full gate | full suite command (both apps, tsc + jest) | ✅ | ⬜ pending |
| 03-05/T2 | 03-05 | 3 | CHAL-01..04 | checkpoint:human-verify | — (device walkthrough, 6 checks) | — | ⬜ pending |

**Behavior → test mapping (from research validation map, all covered):**

| Req | Behavior | Covered by |
|-----|----------|------------|
| CHAL-01 | fetchChallenges returns list with is_joined populated | 03-02/T3 |
| CHAL-01 | Active/Completed split filters on is_active | 03-02/T2 (splitByStatus) |
| CHAL-02 | Join result mapping 201/409/400/error + no-token guard | 03-02/T3 |
| CHAL-02 | Bearer JWT auth accepted by verifyMember | 03-01/T2 |
| CHAL-03 | progressPct clamped 0-100, null/zero guards | 03-02/T2 |
| CHAL-03 | Volume/PR scores convert lbs→kg per weightUnit | 03-02/T2 (formatScore) |
| CHAL-04 | Pinned "You" row when outside top-10 (rank 10 vs 11 boundary) | 03-02/T2 (buildLeaderboardRows) |
| CHAL-04 | fetchChallengeDetail returns null for missing challenge | 03-02/T3 |
| CHAL-04 | Ended challenge → no join CTA | 03-02/T2 (canJoin) + 03-04/T2 grep + 03-05/T2 device check |

---

## Wave 0 Requirements

All Wave 0 gaps are owned by Wave 1 plans (03-01, 03-02):

- [ ] Migration 028: `challenge_participants_member_gym_read` SELECT policy via `is_gym_member(gym_id)` — **03-01/T1** (apply gated by user-approval checkpoint 03-01/T3, repo convention)
- [ ] `expo-haptics` install in apps/mobile — **03-02/T1**
- [ ] `EXPO_PUBLIC_API_URL` env documented — **03-02/T1** (user sets value in local .env)
- [ ] verifyMember.ts Bearer-JWT acceptance — confirmed MISSING by planner audit (cookie-only `getSession()`); added in **03-01/T2** before any join-flow UI
- [ ] Test stubs created per-task via TDD (challengeLogic + challengeService RED-first) — **03-02/T2, 03-02/T3, 03-01/T2**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Join haptic + confetti feel | CHAL-02 | Physical device feedback | 03-05/T2 check 2 — join a demo challenge on device |
| Challenge tab/entry navigation on device | CHAL-01 | Visual/UX | 03-05/T2 check 1 — browse 6 seeded Iron Society challenges |
| Leaderboard medals + pinned YOU visuals | CHAL-04 | Visual | 03-05/T2 check 5 |
| Stale deep-link graceful state | CHAL-04 | Navigation flow | 03-05/T2 check 6 — bogus challenge id |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are explicit human checkpoints
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (owned by Wave 1 plans 03-01/03-02)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-07-19 by gsd-planner; execution sign-off pending
