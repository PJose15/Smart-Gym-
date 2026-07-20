---
phase: 06-notification-orchestration
plan: 06
subsystem: api
tags: [notifications, push, dispatcher, social, coaching, feed, follow]

# Dependency graph
requires:
  - phase: 06-03-dispatcher
    provides: sendNotification dispatcher that owns inbox writes and push preference guards
provides:
  - checkin_generated push via dispatcher (replaces raw notifications.insert in sendCheckIn.ts)
  - checkin_reply push to trainer with no reply-text PII in body
  - coach_note push to member with note_id deep-link data
  - program_assigned push to member on trainer program assignment
  - feed_reaction push to event owner on new reaction (self-skip)
  - feed_comment push to event owner on new comment (self-skip)
  - new_follower push to followed member on social follow upsert
affects: [06-10-e2e-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget dispatcher: sendNotification(...).catch() at every call site — 200 path never blocked by push failure"
    - "Self-action skip: compare actor member_id vs event owner member_id before dispatch"
    - "PII rule: push bodies use 'Someone...' phrasing — names appear only after tap in-app"
    - "Owner lookup pattern: gym_feed_events.select(member_id, gym_id).eq(id, event_id) before dispatch"

key-files:
  created: []
  modified:
    - apps/web-admin/src/lib/checkIn/sendCheckIn.ts
    - apps/web-admin/src/app/api/member/[memberId]/check-ins/[checkInId]/reply/route.ts
    - apps/web-admin/src/app/api/sessions/[sessionId]/trainer-note/route.ts
    - apps/web-admin/src/app/api/trainer/members/[memberId]/program/assign/route.ts
    - apps/web-admin/src/app/api/member/feed/react/route.ts
    - apps/web-admin/src/app/api/member/feed/comments/route.ts
    - apps/web-admin/src/app/api/social/follow/route.ts

key-decisions:
  - "Feed owner lookup inline (not cached): gym_feed_events select member_id+gym_id per reaction/comment — low volume, no caching overhead"
  - "Follow route at /api/social/follow (not /api/member/social/follow) — discovered actual path vs plan; plan spec was approximate"
  - "23505 race branch for reactions: dispatch only on clean insert success branch to avoid double-fire on duplicate-tap"

patterns-established:
  - "Social trigger pattern: lookup event owner → skip if owner == actor → sendNotification fire-and-forget"

requirements-completed: [NOTIF-02]

# Metrics
duration: 25min
completed: 2026-07-20
---

# Phase 06 Plan 06: Coaching + Social Notification Triggers Summary

**Seven dispatcher call sites wired: checkin_generated, checkin_reply, coach_note, program_assigned, feed_reaction, feed_comment, new_follower — preference-bypass inserts eliminated, reply-text PII fixed**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-20T14:30:00Z
- **Completed:** 2026-07-20T14:55:00Z
- **Tasks:** 2 (Task 1 completed prior session; Task 2 completed this session)
- **Files modified:** 7

## Accomplishments

- Replaced raw `notifications.insert` in sendCheckIn.ts with dispatcher `checkin_generated` call
- Fixed PII leak in reply route: push body was `replyText.slice(0,100)`; now a generic constant string
- Wired `coach_note`, `program_assigned`, `feed_reaction`, `feed_comment`, `new_follower` dispatcher calls
- Self-action skip for reactions and comments (actor == owner guard before dispatch)
- All dispatches fire-and-forget; dispatcher's 5-min dedup prevents reaction storms

## Task Commits

1. **Task 1: Coaching triggers (sendCheckIn, reply, trainer-note)** — RED `40013f8` (test) + GREEN `44cc803` (feat)
2. **Task 2: Social + program triggers (react, comment, follow, program_assigned)** — `4e9afc4` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `apps/web-admin/src/lib/checkIn/sendCheckIn.ts` — replaced notifications.insert with sendNotification(checkin_generated)
- `apps/web-admin/src/app/api/member/[memberId]/check-ins/[checkInId]/reply/route.ts` — replaced insert with sendNotification(checkin_reply), PII-safe body
- `apps/web-admin/src/app/api/sessions/[sessionId]/trainer-note/route.ts` — added sendNotification(coach_note) with note_id data
- `apps/web-admin/src/app/api/trainer/members/[memberId]/program/assign/route.ts` — added sendNotification(program_assigned) after insert
- `apps/web-admin/src/app/api/member/feed/react/route.ts` — owner lookup + sendNotification(feed_reaction) on clean add only
- `apps/web-admin/src/app/api/member/feed/comments/route.ts` — owner lookup + sendNotification(feed_comment) on POST
- `apps/web-admin/src/app/api/social/follow/route.ts` — followed member lookup + sendNotification(new_follower)

## Decisions Made

- Feed owner lookup is inline (not cached) per dispatch — gym_feed_events select member_id+gym_id. Low volume at launch, no caching overhead justified.
- Reactions: dispatch only on the clean INSERT success branch, not the 23505 race-condition branch, to prevent double-fire on duplicate-tap.
- Follow route is at `/api/social/follow` (not `/api/member/social/follow` as the plan spec listed) — discovered the actual path; no route relocation needed.

## Deviations from Plan

None — plan executed exactly as written. The follow route path discrepancy was informational only (plan spec was approximate); no code movement required.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 7 coaching/social notification types now have live emitting code paths through the dispatcher
- Preference-bypass inserts eliminated; PII leak in reply push body fixed
- Ready for 06-10 E2E verification gate (final plan in phase)

---
*Phase: 06-notification-orchestration*
*Completed: 2026-07-20*
