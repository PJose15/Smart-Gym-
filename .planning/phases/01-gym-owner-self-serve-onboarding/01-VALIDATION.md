---
phase: 1
slug: gym-owner-self-serve-onboarding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (web-admin), vitest (ai-assist), jest (mobile) |
| **Config file** | `apps/web-admin/jest.config.js` |
| **Quick run command** | `cd apps/web-admin && npx jest --silent` |
| **Full suite command** | `pnpm typecheck && cd apps/web-admin && npx jest --silent && cd ../mobile && npx jest --silent` |
| **Estimated runtime** | ~60 seconds full, ~10 seconds quick |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web-admin && npx jest --silent`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

*Filled by gsd-planner — every plan task maps to a requirement + automated command.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| — | — | — | ONBD-01..07 | unit + integration | `cd apps/web-admin && npx jest --silent` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Migration for `stripe_events_processed` + `members.onboarding_status 'invited'` value (schema gaps found in research)
- [ ] Install `react-hook-form`, `@hookform/resolvers`, `csv-parse` in web-admin
- [ ] Test stubs for webhook idempotency + CSV parse pure logic (jest, existing config covers)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stripe checkout end-to-end (test mode) | ONBD-03 | Requires Stripe test-mode session + webhook delivery (stripe CLI listen) | `stripe listen --forward-to localhost:3000/api/billing/webhook`, complete checkout with 4242 card, verify gym_billing row + dashboard state |
| QR PDF scans into member flow | ONBD-05 | Physical scan of printed/displayed QR | Download PDF, scan QR with phone, verify /m/[slug] loads machine |
| Imported member claims via phone OTP | ONBD-06 | Requires mobile app + OTP delivery | Import CSV with own phone, complete OTP on mobile, verify member linked |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
