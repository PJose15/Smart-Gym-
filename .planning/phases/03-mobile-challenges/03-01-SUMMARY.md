---
phase: 03-mobile-challenges
plan: "01"
subsystem: auth-and-rls
tags: [bearer-jwt, rls, verifyMember, mobile, challenges, supabase]
dependency_graph:
  requires: []
  provides: [CHAL-02-auth, CHAL-04-rls]
  affects: [apps/web-admin/src/lib/auth/verifyMember.ts, supabase/migrations/028_challenge_member_read.sql]
tech_stack:
  added: []
  patterns: [Bearer-JWT-fallback, admin-client-ownership-check]
key_files:
  created:
    - supabase/migrations/028_challenge_member_read.sql
    - apps/web-admin/src/lib/auth/__tests__/verifyMember.test.ts
  modified:
    - apps/web-admin/src/lib/auth/verifyMember.ts
    - apps/web-admin/src/app/api/member/challenges/[challengeId]/join/route.ts
decisions:
  - "Bearer JWT falls through to cookie session on error — browser callers sending unrelated Authorization headers are not broken"
  - "Member ownership check uses admin client in both paths — identical security semantics; no RLS client needed for this check"
  - "verifyMember second param is optional — all ~36 existing call sites compile unchanged"
metrics:
  duration: "2 minutes"
  completed_date: "2026-07-19"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 2
---

# Phase 03 Plan 01: Mobile Auth + RLS Unblocking Summary

**One-liner:** Bearer JWT auth path added to verifyMember (mobile join unblocked) + RLS SELECT policy on challenge_participants for gym members (mobile leaderboard unblocked).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Migration 028 — member SELECT policy on challenge_participants | `4e73ecb` | supabase/migrations/028_challenge_member_read.sql |
| 2 | Add Bearer JWT support to verifyMember + forward request from join route | `4182c1b` | verifyMember.ts, verifyMember.test.ts, join/route.ts |
| 3 | Apply Migration 028 to live DB (human-approved checkpoint) | n/a (db push) | Live DB: challenge_participants_member_gym_read policy active |

## What Was Built

### Migration 028 (Tasks 1 + 3)
File: `supabase/migrations/028_challenge_member_read.sql`

- Adds `challenge_participants_member_gym_read` SELECT-only policy using `is_gym_member(gym_id)`
- Mirrors the existing `challenges_gym_members_read` policy on `gym_challenges` (migration 001)
- No INSERT/UPDATE/DELETE policies added — writes stay behind the web-admin join route (service role)
- **Applied to live DB** — `npx supabase db push --linked` executed after user approval; policy confirmed present; authenticated demo-gym member JWT can SELECT 115 challenge_participants rows for Iron Society gym via PostgREST (count=exact verified)

### verifyMember Bearer JWT (Task 2)
File: `apps/web-admin/src/lib/auth/verifyMember.ts`

- Signature changed: `verifyMember(requestedMemberId, request?)` — optional second param
- Bearer path: reads `Authorization: Bearer <token>` header, calls `admin.auth.getUser(token)`, falls through to cookie path on error/null user
- Cookie path: unchanged `createServerSupabaseClient → getSession` flow
- Member ownership: admin client used in both paths (`members.select.eq(user_id).eq(id).maybeSingle()`)
- Returns 401 if no identity resolved; 403 if user doesn't own the member row

### Join Route Forward (Task 2)
File: `apps/web-admin/src/app/api/member/challenges/[challengeId]/join/route.ts`

- Single-line change: `verifyMember(member_id)` → `verifyMember(member_id, request)`
- Forwards the NextRequest so Bearer header reaches verifyMember
- No other routes changed — all other verifyMember callers retain cookie-only behavior

### Tests (Task 2)
File: `apps/web-admin/src/lib/auth/__tests__/verifyMember.test.ts`

- T1: valid cookie session → `{ member_id, admin }`
- T2: Bearer JWT happy path → `{ member_id, admin }`
- T3: invalid Bearer + no cookie → 401
- T4: valid Bearer but user doesn't own member → 403
- T5: no auth at all → 401

## Verification

- Migration file: SELECT-only, uses `is_gym_member(gym_id)` — VERIFIED
- verifyMember: 5/5 unit tests pass — VERIFIED
- Join route: `request` forwarded — VERIFIED
- Full web-admin suite: 347/347 tests pass (5 new) — VERIFIED
- TypeScript: `tsc --noEmit` clean — VERIFIED
- Migration 028 applied to live DB: `npx supabase db push --linked` succeeded; PostgREST count=exact returns 115 rows for authenticated demo member — VERIFIED

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

1. **Bearer falls through on error** — if `admin.auth.getUser()` returns an error or null user, the function falls through to the cookie path rather than immediately returning 401. This ensures browser clients that happen to send an Authorization header for unrelated reasons are not broken.

2. **Admin client for ownership check** — the plan specified using the admin client for the member lookup in both paths. This is consistent and avoids RLS interference on the members table during the ownership check.

3. **Optional second param** — keeping `request?` optional preserves the existing call signature at all ~36 call sites across the codebase. Only the join route passes request; all other routes continue cookie-only behavior without any changes.

## Self-Check: PASSED

- supabase/migrations/028_challenge_member_read.sql: FOUND
- apps/web-admin/src/lib/auth/verifyMember.ts: FOUND
- apps/web-admin/src/lib/auth/__tests__/verifyMember.test.ts: FOUND
- .planning/phases/03-mobile-challenges/03-01-SUMMARY.md: FOUND
- Commit 4e73ecb (Task 1): FOUND
- Commit 4182c1b (Task 2): FOUND
- Task 3 (live DB push): CONFIRMED — user approved, orchestrator ran db push, PostgREST SELECT verified 115 rows
