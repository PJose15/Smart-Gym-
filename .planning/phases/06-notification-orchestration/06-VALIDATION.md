---
phase: 6
slug: notification-orchestration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-20
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 30.x/ts-jest (web-admin), jest (mobile), vitest (ai-assist untouched) |
| **Config file** | `apps/web-admin/jest.config.js`, `apps/mobile/jest.config.js` |
| **Quick run command** | `cd apps/web-admin && npx jest --silent` |
| **Full suite command** | `cd apps/web-admin && npx tsc --noEmit && npx jest --silent && cd ../mobile && npx tsc --noEmit && npx jest --silent` |
| **Estimated runtime** | ~45 seconds full, ~10 seconds quick |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` command, then the owning app's jest suite
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite green both apps + packages/types typecheck (type union change ripples)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

*Filled by gsd-planner.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| — | — | — | NOTIF-01..06 | unit + component | see full suite | ✅ | ⬜ pending |

---

## Wave 0 Requirements

- [ ] Dispatcher (lib/notifications/dispatcher.ts) TDD RED-first — preference enforcement, quiet hours, dedup/rate caps, is_agent_initiated loop guard, profile_id/member_id identity bridge, no-PII contract
- [ ] NotificationType union (packages/types) + NOTIFICATION_ROUTES (mobile) expanded together (4 → 24+) — tsc across workspace gates this
- [ ] Migration 031 (receipt-poll cron via net.http_post + any inbox/receipt schema gaps) — apply gated by user-approval checkpoint
- [ ] Test stubs per-task via TDD

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real push arrives on device < 1 min with correct deep link | NOTIF-01/03 | Physical device + Expo push | Complete a workout as Carlos w/ registered device; tap push, land on right screen |
| Quiet hours + category opt-out hold on device | NOTIF-02 | Timing + device | Set quiet hours, trigger event, verify silence; disable category, verify nothing |
| Inbox unread badge + read sync on tap | NOTIF-04 | Device gesture | Open inbox, tap item, badge decrements |
| Stale token deactivation | NOTIF-05 | Needs uninstalled-device receipt cycle | Verify via receipt-poll cron logs + device_tokens.is_active flip |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are explicit human checkpoints
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
