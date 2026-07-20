---
phase: 4
slug: mobile-program-view
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest (mobile) |
| **Config file** | `apps/mobile/jest.config.js` |
| **Quick run command** | `cd apps/mobile && npx jest --silent` |
| **Full suite command** | `cd apps/mobile && npx tsc --noEmit && npx jest --silent` |
| **Estimated runtime** | ~20 seconds full, ~10 seconds quick |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` command, then `cd apps/mobile && npx jest --silent`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite green, tsc clean
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

*Filled by gsd-planner.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| — | — | — | PROG-01..04 | unit + component | `cd apps/mobile && npx jest --silent` | ✅ | ⬜ pending |

---

## Wave 0 Requirements

- [ ] Verify Expo Router auto-discovers `app/program/index.tsx` (no explicit Stack.Screen needed — confirm against existing non-tab routes like app/challenges/[id])
- [ ] Test stubs created per-task via TDD (programLogic pure module)
- [ ] No migration, no new deps — RLS + grants confirmed sufficient by research

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual: today highlight + completed checkmarks on device | PROG-02 | Visual | Open program view as Carlos, verify today ring + checked past days |
| Start today's workout navigation feel | PROG-03 | Navigation flow | Tap CTA, land in workout/scan flow |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are explicit human checkpoints
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
