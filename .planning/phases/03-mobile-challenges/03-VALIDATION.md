---
phase: 3
slug: mobile-challenges
status: draft
nyquist_compliant: false
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
| **Full suite command** | `cd apps/mobile && npx tsc --noEmit && npx jest --silent && cd ../web-admin && npx jest --silent` |
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
| — | — | — | CHAL-01..04 | unit + component | `cd apps/mobile && npx jest --silent` | ✅ | ⬜ pending |

---

## Wave 0 Requirements

- [ ] Migration 028: `challenge_participants_member_gym_read` SELECT policy via `is_gym_member(gym_id)` (RLS gap — leaderboards empty without it). Apply gated by user-approval checkpoint (repo convention).
- [ ] `expo-haptics` install in apps/mobile
- [ ] Verify `verifyMember.ts` Bearer-JWT acceptance (or add) before join flow
- [ ] Test stubs created per-task via TDD (challengeLogic pure module)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Join haptic + celebration feel | CHAL-02 | Physical device feedback | Join a demo challenge on device, feel success haptic, see confetti |
| Challenge tab/entry navigation on device | CHAL-01 | Visual/UX | Open challenges from mobile, browse 6 seeded Iron Society challenges |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are explicit human checkpoints
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
