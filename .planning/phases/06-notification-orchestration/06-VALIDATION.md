---
phase: 6
slug: notification-orchestration
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-20
updated: 2026-07-20
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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01 T1 | 06-01 | 1 | NOTIF-03 | typecheck | `cd apps/web-admin && npx tsc --noEmit` | ✅ tsc | ⬜ pending |
| 06-01 T2 | 06-01 | 1 | NOTIF-03 | unit (mobile) | `cd apps/mobile && npx tsc --noEmit && npx jest notificationService --silent` | Wave 0 (created in-task, RED-first) | ⬜ pending |
| 06-02 T1 | 06-02 | 1 | NOTIF-06 | content check | `node -e "...migration 031 grep..."` (in plan) | ✅ inline | ⬜ pending |
| 06-02 T2 | 06-02 | 1 | NOTIF-06 | checkpoint:human-action | manual (db push convention) | — | ⬜ pending |
| 06-03 T1 | 06-03 | 2 | NOTIF-01, NOTIF-04 | unit RED | `cd apps/web-admin && npx tsc --noEmit` | Wave 0 (16-case suite created RED-first) | ⬜ pending |
| 06-03 T2 | 06-03 | 2 | NOTIF-01, NOTIF-04 | unit GREEN | `cd apps/web-admin && npx jest dispatcher --silent` | created in T1 | ⬜ pending |
| 06-04 T1 | 06-04 | 2 | NOTIF-06 | unit | `cd apps/web-admin && npx jest receipt-poll --silent` | Wave 0 (created in-task, RED-first) | ⬜ pending |
| 06-04 T2 | 06-04 | 2 | NOTIF-06 | typecheck + suite | `cd apps/web-admin && npx tsc --noEmit && npx jest --silent` | ✅ | ⬜ pending |
| 06-08 T1 | 06-08 | 2 | NOTIF-05 | unit | `cd apps/web-admin && npx jest --testPathPattern="member.*notifications" --silent` | Wave 0 (created in-task, RED-first) | ⬜ pending |
| 06-05 T1 | 06-05 | 3 | NOTIF-02 | unit (pure coalescer) | `cd apps/web-admin && npx jest sessionPush --silent` | Wave 0 (created in-task, RED-first) | ⬜ pending |
| 06-05 T2 | 06-05 | 3 | NOTIF-02 | unit (route) | `cd apps/web-admin && npx jest --testPathPattern="complete" --silent` | Wave 0 (complete-push.test.ts created in-task) | ⬜ pending |
| 06-05 T3 | 06-05 | 3 | NOTIF-02 | typecheck + suite | `cd apps/web-admin && npx tsc --noEmit && npx jest --silent` | ✅ | ⬜ pending |
| 06-06 T1 | 06-06 | 3 | NOTIF-02 | unit | `cd apps/web-admin && npx jest --testPathPattern="checkIn|check-ins|trainer-note" --silent` | Wave 0 (created/extended in-task) | ⬜ pending |
| 06-06 T2 | 06-06 | 3 | NOTIF-02 | typecheck + suite | `cd apps/web-admin && npx tsc --noEmit && npx jest --silent` | ✅ | ⬜ pending |
| 06-07 T1 | 06-07 | 3 | NOTIF-02 | unit | `cd apps/web-admin && npx jest --testPathPattern="webhook" --silent` | Wave 0 (created/extended in-task) | ⬜ pending |
| 06-07 T2 | 06-07 | 3 | NOTIF-02 | unit | `cd apps/web-admin && npx jest --testPathPattern="agent-daily|agent-weekly" --silent` | ✅ existing suites extended | ⬜ pending |
| 06-07 T3 | 06-07 | 3 | NOTIF-02 | typecheck + suite | `cd apps/web-admin && npx tsc --noEmit && npx jest --silent` | ✅ | ⬜ pending |
| 06-09 T1 | 06-09 | 3 | NOTIF-04, NOTIF-05 | unit (mobile) | `cd apps/mobile && npx jest notificationInboxService --silent` | Wave 0 (created in-task, RED-first) | ⬜ pending |
| 06-09 T2 | 06-09 | 3 | NOTIF-05 | typecheck + suite | `cd apps/mobile && npx tsc --noEmit && npx jest --silent` | ✅ | ⬜ pending |
| 06-09 T3 | 06-09 | 3 | NOTIF-04 | typecheck + suite | `cd apps/mobile && npx tsc --noEmit && npx jest --silent` | ✅ | ⬜ pending |
| 06-10 T1 | 06-10 | 4 | all | full gate (7 checks) | `cd apps/web-admin && npx jest --silent && npx tsc --noEmit` | ✅ | ⬜ pending |
| 06-10 T2 | 06-10 | 4 | all | checkpoint:human-verify | device walkthrough (7 steps) | — | ⬜ pending |

---

## Wave 0 Requirements

- [x] Dispatcher (lib/notifications/dispatcher.ts) TDD RED-first — plan 06-03 Task 1 creates the 16-case suite BEFORE implementation (preference enforcement, quiet hours, dedup/rate caps, is_agent_initiated loop guard, identity bridge, no-PII contract via generic-body convention + device checkpoint)
- [x] NotificationType union (packages/types) + NOTIFICATION_ROUTES (mobile) expanded together (4 → 24) — plan 06-01, single plan, workspace tsc gates
- [x] Migration 031 (receipt-poll cron via net.http_post + notification_log status CHECK gap) — plan 06-02, apply gated by checkpoint:human-action
- [x] Test stubs per-task via TDD — every code-producing task is tdd="true" with RED-first behavior blocks; no `<verify>` lacks an `<automated>` command except the two explicit human checkpoints

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real push arrives on device < 1 min with correct deep link | NOTIF-01/02/03 | Physical device + Expo push | 06-10 T2 step 1-2 |
| Quiet hours + category opt-out hold on device | NOTIF-04 | Timing + device | 06-10 T2 step 3-4 |
| Inbox unread badge + read sync on tap | NOTIF-05 | Device gesture | 06-10 T2 step 5 |
| Stale token deactivation + delivery rate | NOTIF-06 | Needs receipt cycle against live Expo | 06-10 T2 step 6 (receipt-poll cron logs + device_tokens.active flip + admin health delivery_rate) |
| Migration 031 applied to live DB | NOTIF-06 | Repo convention: human-gated db push | 06-02 T2 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are explicit human checkpoints
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (all new test files are created RED-first inside their owning tasks)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-07-20 by gsd-planner (10 plans, 4 waves)
