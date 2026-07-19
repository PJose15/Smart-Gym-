---
phase: 1
slug: gym-owner-self-serve-onboarding
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-19
updated: 2026-07-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 30.2.0 (web-admin), vitest (ai-assist), jest (mobile) |
| **Config file** | `apps/web-admin/jest.config.js` |
| **Quick run command** | `cd apps/web-admin && npx jest --silent` |
| **Full suite command** | `cd apps/web-admin && npx tsc --noEmit && npx jest --silent && cd ../mobile && npx jest --silent` |
| **Estimated runtime** | ~60 seconds full, ~10 seconds quick |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` command (below), then `cd apps/web-admin && npx jest --silent`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite green + `npx tsc --noEmit` clean
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01 T1 | 01-01 | 1 | ONBD-02/05/06 (substrate) | file/dep check | `node -e` dep check + `npx jest --silent` | ✅ | ⬜ pending |
| 01-01 T2 | 01-01 | 1 | ONBD-02 | checkpoint (db push) | Supabase SQL object check post-approval | manual gate | ⬜ pending |
| 01-02 T1 | 01-02 | 1 | ONBD-03 | unit (TDD) | `npx jest --testPathPattern="stripeHelpers"` | created in task | ⬜ pending |
| 01-02 T2 | 01-02 | 1 | ONBD-03 | unit (TDD) | `npx jest --testPathPattern="stripeHelpers"` + tsc | created in task | ⬜ pending |
| 01-03 T1 | 01-03 | 1 | ONBD-04 | unit (TDD) | `npx jest --testPathPattern="machines-post"` | created in task | ⬜ pending |
| 01-03 T2 | 01-03 | 1 | ONBD-04 | component | `npx jest --testPathPattern="MachineForm"` + tsc | created in task | ⬜ pending |
| 01-04 T1 | 01-04 | 1 | ONBD-07 | unit (TDD) | `npx jest --testPathPattern="onboarding-status"` | created in task | ⬜ pending |
| 01-04 T2 | 01-04 | 1 | ONBD-07 | tsc + suite | `npx tsc --noEmit && npx jest --silent` | — | ⬜ pending |
| 01-05 T1 | 01-05 | 2 | ONBD-01/02 | unit (TDD) | `npx jest --testPathPattern="onboard"` | created in task | ⬜ pending |
| 01-05 T2 | 01-05 | 2 | ONBD-01 | component | `npx jest --testPathPattern="WizardProgress"` + tsc | created in task | ⬜ pending |
| 01-05 T3 | 01-05 | 2 | ONBD-01 | tsc + suite | `npx tsc --noEmit && npx jest --silent` | — | ⬜ pending |
| 01-06 T1 | 01-06 | 3 | ONBD-01/03 | unit (TDD) | `npx jest --testPathPattern="checkout-context"` | created in task | ⬜ pending |
| 01-06 T2 | 01-06 | 3 | ONBD-01/03 | tsc + suite | `npx tsc --noEmit && npx jest --silent` | — | ⬜ pending |
| 01-07 T1 | 01-07 | 3 | ONBD-04 | tsc | `npx tsc --noEmit` (tests land in T2) | — | ⬜ pending |
| 01-07 T2 | 01-07 | 3 | ONBD-04 | component (TDD) | `npx jest --testPathPattern="setup-wizard"` | created in task | ⬜ pending |
| 01-08 T1 | 01-08 | 3 | ONBD-05 | unit (TDD) | `npx jest --testPathPattern="parseMembersCsv\|members.*import"` | created in task | ⬜ pending |
| 01-08 T2 | 01-08 | 3 | ONBD-05 | tsc (UI; e2e in 01-09) | `npx tsc --noEmit` | — | ⬜ pending |
| 01-08 T3 | 01-08 | 3 | ONBD-06 | unit (TDD) | `npx jest --testPathPattern="verify-claim"` | created in task | ⬜ pending |
| 01-09 T1 | 01-09 | 4 | all | full gate | tsc + eslint + all 3 suites | ✅ | ⬜ pending |
| 01-09 T2 | 01-09 | 4 | all | manual checkpoint | 9-step walkthrough (see plan) | manual gate | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

All test commands run from `apps/web-admin` with `--no-coverage --silent` per plan text.

---

## Wave 0 Requirements

Wave 0 gaps are satisfied inside Wave 1 plans (no separate Wave 0 needed):

- [x] Migration for `stripe_events_processed` + `'invited'` status + both RPCs → plan 01-01 Task 1 (apply gated by 01-01 Task 2 checkpoint)
- [x] Install `react-hook-form`, `@hookform/resolvers`, `csv-parse` → plan 01-01 Task 1
- [x] Test scaffolds: every code-producing task is `tdd="true"` and creates its own test file RED-first (stripeHelpers, machines-post, onboarding-status, onboard register/status, checkout-context, parseMembersCsv/import, verify-claim, setup-wizard, MachineForm, WizardProgress)

---

## Manual-Only Verifications

Consolidated into plan 01-09 Task 2 (single checkpoint, 9 steps):

| Behavior | Requirement | Why Manual | Where |
|----------|-------------|------------|-------|
| Stripe checkout end-to-end + idempotent replay + abandonment resume | ONBD-03 | Needs `stripe listen` + real checkout session | 01-09 steps 3-5 |
| QR PDF scans into member flow | ONBD-04 | Physical scan of printed/displayed QR | 01-09 step 6 |
| Imported member claims via phone OTP | ONBD-06 | Requires mobile app + OTP delivery | 01-09 step 8 |
| Migration applied to live DB | ONBD-02 | Repo convention: db push needs user approval | 01-01 Task 2 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are explicit human checkpoints
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (folded into Wave 1 TDD tasks)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-07-19 — execution pending
