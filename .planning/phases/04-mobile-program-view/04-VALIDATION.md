---
phase: 4
slug: mobile-program-view
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-19
updated: 2026-07-19
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest (mobile) |
| **Config file** | `apps/mobile/jest.config.js` |
| **Quick run command** | `cd apps/mobile && npx jest --testPathPattern="programLogic|programService" --silent` |
| **Full suite command** | `cd apps/mobile && npx tsc --noEmit && npx jest --silent` |
| **Estimated runtime** | ~20 seconds full, ~10 seconds quick |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` command, then `cd apps/mobile && npx jest --silent`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite green, tsc clean, web-admin suite green (`cd apps/web-admin && npx jest --silent`)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01 T1 (RED) | 04-01 | 1 | PROG-01, PROG-02, PROG-04 | unit (failing-first) | `cd apps/mobile && npx jest --testPathPattern="programLogic\|programService" --silent` (MUST fail — Wave 0 creates the test files) | ❌ Wave 0 | ✅ passed |
| 04-01 T2 (GREEN) | 04-01 | 1 | PROG-01, PROG-02, PROG-04 | unit + tsc | `cd apps/mobile && npx tsc --noEmit && npx jest --silent` | created in T1 | ✅ passed |
| 04-02 T1 | 04-02 | 2 | PROG-01, PROG-02 | tsc + hex scan | `cd apps/mobile && npx tsc --noEmit` + grep for hardcoded hex in `src/components/program/` | ✅ (tsc) | ✅ passed |
| 04-02 T2 | 04-02 | 2 | PROG-01, PROG-02, PROG-03, PROG-04 | tsc + full suite + structure grep | `cd apps/mobile && npx tsc --noEmit && npx jest --silent && grep -q "program/index" app/_layout.tsx` | ✅ | ✅ passed |
| 04-03 T1 | 04-03 | 3 | PROG-01, PROG-03 | tsc + wiring grep | `cd apps/mobile && npx tsc --noEmit` + `grep "router.push('/program')" src/components/home/TodayZone.tsx` | ✅ | ✅ passed |
| 04-03 T2 (gate) | 04-03 | 3 | PROG-01..04 | full gate | `cd apps/mobile && npx tsc --noEmit && npx jest --silent && cd ../web-admin && npx tsc --noEmit && npx jest --silent` | ✅ | ✅ passed |

**Nyquist compliance:** every task has an `<automated>` command; the only MISSING test files (programLogic.test.ts, programService.test.ts) are created by 04-01 Task 1 (Wave 0 / TDD RED) before any implementation.

---

## Wave 0 Requirements

- [x] Verify Expo Router route registration — RESOLVED at planning: root `app/_layout.tsx` explicitly registers every stack route (`coach-notes/index` precedent); plan 04-02 T2 adds `<Stack.Screen name="program/index" options={{ title: 'Your Program' }} />`
- [x] Test stubs created RED-first via TDD (plan 04-01 Task 1: `programLogic.test.ts` + `programService.test.ts`)
- [x] `CacheTTL.programData` constant added to `cacheManager.ts` (plan 04-01 Task 2)
- [x] No migration, no new deps — RLS (`programs_own`) + migration 026 grants confirmed sufficient by research

---

## Manual-Only Verifications

Deferred to `/gsd:verify-work` UAT (no in-plan checkpoints — phase is fully autonomous):

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual: today highlight + completed checkmarks on device | PROG-02 | Visual | Open program view as Carlos (Iron Society demo), verify TODAY pill/accent on the same day TodayZone shows, checked earlier-cycle days |
| Start today's workout navigation feel | PROG-03 | Navigation flow | Tap CTA on program screen, land in scan flow; tap an exercise, land on its detail screen |
| Empty state | PROG-04 | Needs member without program | Sign in as a member with no active ai_programs row, open /program via TodayZone absent → navigate directly, verify "No program assigned yet" + Open Scanner CTA |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are explicit human checkpoints
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** SIGNED OFF 2026-07-19 — 04-03 Task 2 gate: mobile 227/227, web-admin 347/347, both tsc clean, zero hex in Phase 4 files, tab group 7 entries, field-name check passed.
