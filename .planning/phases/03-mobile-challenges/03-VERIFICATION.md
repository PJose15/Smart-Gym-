---
phase: 03-mobile-challenges
verified: 2026-07-19T00:00:00Z
status: human_needed
score: 12/13 must-haves verified
human_verification:
  - test: "CHAL-01: Browse Challenges tab — 5 active cards with type badges, descriptions, countdowns; toggle to Completed shows 1 ended challenge"
    expected: "Trophy-icon tab visible; 5 active challenge cards rendered with type badge chips, 2-line descriptions, 'Xd left' countdown chips; Active/Completed toggle switches lists; Completed tab shows 1 ended card"
    why_human: "Tab bar rendering, card visual layout, countdown readability, and toggle animation cannot be verified by jest; requires a running Expo app on a physical/emulator device"
  - test: "CHAL-02: One-tap join — haptic feedback fires, confetti bursts, card flips to Joined state"
    expected: "Tapping Join disables button (spinner shows), success haptic buzz fires, confetti burst overlays screen, card updates to 'Joined' chip, leaderboard shows new row after pull-to-refresh"
    why_human: "Haptics only fire on physical device (not simulator); confetti visual effect and its reduced-motion gate need visual confirmation; optimistic state flip in UI cannot be asserted by jest"
  - test: "CHAL-02: Already-joined and ended CTA states"
    expected: "Reopening the same challenge: Join CTA is absent. Opening the completed challenge: 'Challenge ended' banner shows, no Join CTA present"
    why_human: "CTA presence/absence and ended banner visibility are UI state checks requiring a running app against live data"
  - test: "CHAL-03: Progress bar reads 'You: X · Leader: Y' with correct unit conversion (kg/lbs) on a joined challenge with scores"
    expected: "Progress bar fills to correct percentage; score labels use the member's preferred weight unit for volume/PR types; labels are legible at default font size"
    why_human: "Requires a joined challenge with non-zero scores in the demo environment; unit conversion correctness at the display layer needs visual confirmation against actual DB values"
  - test: "CHAL-04: Leaderboard medals and pinned YOU row — gold/silver/bronze rank badges, own row pinned below divider when outside top 10"
    expected: "Ranks 1/2/3 show colored medal badges (gold/silver/bronze); rank 4+ show plain '#N'; when member rank > 10, a '···' divider appears followed by their actual rank row with infoSubtle background"
    why_human: "Medal color rendering and pinned-row visual layout require visual inspection on device; requires demo data where the test member is outside the top 10"
  - test: "CHAL-04: Stale deep link shows graceful 'no longer available' state — no crash"
    expected: "Navigating to nexera://challenges/00000000-0000-0000-0000-000000000000 (or equivalent garbage UUID) renders 'This challenge is no longer available' full-screen state with a working 'Back to challenges' button; app does not crash"
    why_human: "Deep-link navigation and graceful state rendering require a running app; crash absence must be confirmed on device"
---

# Phase 3: Mobile Challenges Verification Report

**Phase Goal:** Members can discover, join, and compete in gym challenges from the mobile app (consume existing gym_challenges backend)
**Verified:** 2026-07-19
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Mobile client authenticated only by Bearer JWT passes verifyMember and can join a challenge | VERIFIED | `verifyMember.ts` lines 37-44: Bearer path extracts token, calls `admin.auth.getUser(token)`; join route passes `request` at line 25 |
| 2 | Gym member can SELECT other members' challenge_participants rows (leaderboard data) | VERIFIED | `028_challenge_member_read.sql` creates `challenge_participants_member_gym_read` SELECT policy using `is_gym_member(gym_id)`; STATE.md records 115 rows visible post-apply |
| 3 | All existing web-admin routes using verifyMember cookie sessions still work | VERIFIED | `verifyMember.ts` signature `(requestedMemberId: string, request?: Request)` — optional second param; 347/347 web-admin tests pass per 03-05-SUMMARY |
| 4 | fetchChallenges() returns ChallengeListItem[] with is_joined and my_score populated | VERIFIED | `challengeService.ts` lines 68-119: parallel fetch of own participations + all participant counts; maps `is_joined`, `my_score`, `rank`, `total_participants`, `progress_pct`, `days_left` |
| 5 | fetchChallengeDetail() returns null for a missing/deleted challenge id | VERIFIED | `challengeService.ts` line 147: `if (!challengeRow) return null;` — maybeSingle + explicit null return, not a throw |
| 6 | joinChallenge() calls the web-admin join route with Bearer JWT and maps 201/409/400 to typed results | VERIFIED | `challengeService.ts` lines 236-258: `Authorization: Bearer ${session.access_token}` header; switch maps 201→'joined', 409→'already_joined', 400→'ended', else→'error' |
| 7 | Pure challenge logic is unit-tested with no network (tab split, progress, score formatting, pinned-row, countdown) | VERIFIED | `challengeLogic.test.ts` 321 lines covering all 7 functions; `challengeService.test.ts` 380 lines covering fetch/join paths; 189/189 mobile tests pass |
| 8 | Member opens a Challenges tab and sees active challenges as cards with type badge, countdown, description, progress | VERIFIED (automated) / HUMAN NEEDED (visual) | `challenges.tsx` (380 lines): cacheFirst load, splitByStatus, FlatList of ChallengeCard with toggle; ChallengeCard (263 lines): type emoji + badge + countdown chip + description + progress bar; requires on-device confirmation |
| 9 | Member toggles between Active and Completed lists | VERIFIED (code) / HUMAN NEEDED (feel) | `challenges.tsx` lines 218-236: TABS array, TouchableOpacity toggle, `splitByStatus()`; `_layout.tsx` line 187: `name="challenges"` Tabs.Screen with trophy AnimatedTabIcon |
| 10 | Joined challenges show progress bar with 'You: X · Leader: Y' | VERIFIED (code) / HUMAN NEEDED (visual) | `ChallengeCard.tsx` lines 105-114: `showProgress` guard renders progress bar + label; `[id].tsx` lines 422-431: detail-screen progress section with same pattern |
| 11 | Member joins with one tap — optimistic update, haptic, confetti; CTA disabled when joined/ended/invite-only | VERIFIED (code) / HUMAN NEEDED (feel) | `[id].tsx` lines 188-263: `handleJoin` — optimistic state update, `Haptics.notificationAsync(Success)`, `setShowConfetti(true)` gated by `!reducedMotion`; `canJoin()` guards CTA at line 322 |
| 12 | Leaderboard shows top ranks with medal colors and pins member's own row below divider when outside top 10 | VERIFIED (code) / HUMAN NEEDED (visual) | `ChallengeLeaderboard.tsx` 294 lines: `buildLeaderboardRows(participants, myMemberId, 10)`; `MEDAL_COLORS` record; `PinnedDivider` + pinned row render at lines 174-183 |
| 13 | Opening a deleted challenge shows 'This challenge is no longer available' — no crash | VERIFIED (code) / HUMAN NEEDED (device) | `[id].tsx` lines 52-58: UUID validation → not-found state; lines 154-157: `null` detail → `{ kind: 'not-found' }`; `renderNotFound()` at lines 277-295 |

**Score:** 13/13 truths have verified code implementations. 6 truths additionally require human on-device confirmation for feel/visual/haptic behaviors.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/028_challenge_member_read.sql` | SELECT policy via is_gym_member(gym_id) | VERIFIED | 11 lines; contains `challenge_participants_member_gym_read`, `FOR SELECT`, `is_gym_member(gym_id)`; applied to live DB (STATE.md + 115 participant rows confirmed) |
| `apps/web-admin/src/lib/auth/verifyMember.ts` | Bearer JWT acceptance + cookie fallback | VERIFIED | 73 lines; Bearer path lines 37-44; cookie path lines 47-54; admin-client member ownership check lines 61-66 |
| `apps/web-admin/src/lib/auth/__tests__/verifyMember.test.ts` | 5-test coverage: cookie, Bearer, invalid token, wrong member, no auth | VERIFIED | 139 lines; T1–T5 all present and testing correct behaviors |
| `apps/mobile/src/lib/challengeLogic.ts` | Pure helpers — min 80 lines | VERIFIED | 171 lines; 7 exported pure functions: splitByStatus, progressPct, formatScore, countdownLabel, buildLeaderboardRows, canJoin, challengeIcon |
| `apps/mobile/src/lib/challengeService.ts` | Supabase reads + API-route join — exports fetchChallenges, fetchChallengeDetail, joinChallenge | VERIFIED | 261 lines; all 3 functions exported + CHALLENGES_CACHE_KEY + CHALLENGE_DETAIL_CACHE_KEY helpers |
| `apps/mobile/src/lib/__tests__/challengeLogic.test.ts` | CHAL-01 tab filter, CHAL-03 progress/units, CHAL-04 pinned-row tests | VERIFIED | 321 lines; covers all 7 logic functions with edge cases |
| `apps/mobile/src/lib/__tests__/challengeService.test.ts` | CHAL-01 fetch, CHAL-02 join result mapping, CHAL-04 not-found | VERIFIED | 380 lines; full fetch + join + null-detail coverage |
| `apps/mobile/src/components/challenges/ChallengeCard.tsx` | Reusable card with type icon/badge, countdown, progress bar — min 80 lines | VERIFIED | 263 lines; all required rows implemented; DOC_03 tokens only (no raw hex) |
| `apps/mobile/app/(tabs)/challenges.tsx` | List screen with toggle, cacheFirst load, pull-to-refresh — min 100 lines | VERIFIED | 380 lines; cacheFirst + RefreshControl + splitByStatus + ChallengesScreenSkeleton + empty states |
| `apps/mobile/src/components/skeleton/ChallengesScreenSkeleton.tsx` | Skeleton matching card layout | VERIFIED | 66 lines; toggle bar bone + 4 card-shaped bones; exported from `skeleton/index.ts` |
| `apps/mobile/src/components/challenges/ChallengeLeaderboard.tsx` | Medal colors + pinned YOU row — min 80 lines | VERIFIED | 294 lines; MEDAL_COLORS record; buildLeaderboardRows; PinnedDivider; infoSubtle "You" highlight |
| `apps/mobile/app/challenges/[id].tsx` | Detail screen: join flow, progress, leaderboard, 4 states — min 150 lines | VERIFIED | 739 lines; loading/not-found/error/detail state machine; full join flow with haptic + confetti |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `join/route.ts` | `verifyMember(member_id, request)` | request param forwarded | VERIFIED | Line 25: `verifyMember(member_id, request)` — request forwarded so Bearer header reaches verifyMember |
| `challengeService.ts` | `feedService.resolveMemberInfo` | exported and imported | VERIFIED | feedService.ts line 44: `export async function resolveMemberInfo`; challengeService.ts line 20: `import { resolveMemberInfo } from './feedService'`; used at line 160 |
| `challengeService.ts` | `/api/member/challenges/[id]/join` | fetch with Bearer JWT | VERIFIED | Lines 236-242: `Authorization: Bearer ${session.access_token}` header in fetch POST |
| `challengeLogic.ts` | `feedLogic.convertFromLbs` | imported for score display | VERIFIED | Line 16: `import { convertFromLbs } from './feedLogic'`; used in formatScore for volume/pr types |
| `challenges.tsx` (tab) | `challengeService.fetchChallenges + cacheFirst` | cacheFirst load | VERIFIED | Lines 87-91: `cacheFirst(CHALLENGES_CACHE_KEY(ctx.gymId), () => fetchChallenges(...), CacheTTL.challengesList)` |
| `challenges.tsx` (tab) | `/challenges/[id] detail route` | router.push on card tap | VERIFIED | Line 141: `router.push(\`/challenges/${challengeId}\`)` |
| `app/(tabs)/_layout.tsx` | challenges tab | `name="challenges"` Tabs.Screen | VERIFIED | Line 187: `name="challenges"` with trophy AnimatedTabIcon |
| `[id].tsx` | `challengeService.fetchChallengeDetail + joinChallenge` | null → not-found + Bearer join | VERIFIED | Lines 38-39: both imported; fetchChallengeDetail used at lines 142/148; joinChallenge at line 187 |
| `[id].tsx` | expo-haptics + ConfettiEffect | `notificationAsync` + confetti on 'joined' | VERIFIED | Line 219: `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`; line 224: `setShowConfetti(true)` gated by `!reducedMotion`; ConfettiEffect rendered at line 456 |
| `ChallengeLeaderboard.tsx` | `challengeLogic.buildLeaderboardRows` | top-N + pinned me | VERIFIED | Line 14: imported; line 150: `buildLeaderboardRows(participants, myMemberId, 10)` |
| `app/_layout.tsx` | `challenges/[id]` stack registration | Stack.Screen entry | VERIFIED | Line 158: `name="challenges/[id]"` |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| CHAL-01 | 03-01, 03-02, 03-03, 03-05 | Member can browse active and completed gym challenges on mobile | SATISFIED | `challenges.tsx` list screen + ChallengeCard + splitByStatus + cacheFirst load; tab registered in `_layout.tsx` |
| CHAL-02 | 03-01, 03-02, 03-04, 03-05 | Member can join a challenge with one tap | SATISFIED (code); HUMAN NEEDED (feel) | `joinChallenge()` via Bearer JWT; `[id].tsx` handleJoin with optimistic update + haptic + confetti; CTA disabled via `canJoin()` |
| CHAL-03 | 03-02, 03-03, 03-04, 03-05 | Member sees their own progress within a joined challenge | SATISFIED (code); HUMAN NEEDED (visual) | `progressPct()` + `formatScore()` in both ChallengeCard and detail screen; "You: X · Leader: Y" label + progress bar |
| CHAL-04 | 03-01, 03-02, 03-04, 03-05 | Member sees challenge leaderboard with own rank always visible; graceful deleted/ended handling | SATISFIED (code); HUMAN NEEDED (visual) | `buildLeaderboardRows()` + ChallengeLeaderboard + PinnedDivider; `fetchChallengeDetail` returns null for missing id; UUID validation + not-found render state in `[id].tsx` |

No orphaned requirements — all 4 CHAL requirements are mapped to plans and have implementation evidence.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ChallengeCard.tsx` | 248 | `'rgba(0, 200, 150, 0.25)'` hardcoded rgba for joinedChip borderColor | Info | Minor deviation from pure DOC_03 token usage; color is a translucent variant of `colors.success` not directly available as a token; no visual breakage |
| `ChallengeLeaderboard.tsx` | 216 | `colors.info + '55'` hex-alpha concatenation | Info | Workaround for missing translucent token; consistent with pattern used elsewhere in the codebase (`colors.success + '40'` in `[id].tsx:691`) |
| `[id].tsx` | 691 | `colors.success + '40'` hex-alpha concatenation | Info | Same workaround; not a blocker |

No blockers. No stubs. No TODO/FIXME/PLACEHOLDER patterns. No empty implementations.

---

## Human Verification Required

### 1. CHAL-01: Challenges Tab Browse

**Test:** Sign into Iron Society demo gym on physical device. Open the app, tap the trophy-icon Challenges tab. Verify 5 active challenge cards appear with type badges, descriptions, and countdown chips. Toggle to "Completed" tab and verify 1 ended challenge appears.
**Expected:** 5 active cards visible under Active tab; each card has a colored type badge (e.g. "Volume", "Streak"), up to 2-line description, and a "Xd left" countdown chip. Completed tab shows 1 card with "Ended" chip.
**Why human:** Tab bar visibility, card visual layout, chip styling, and toggle animation cannot be asserted by jest.

### 2. CHAL-02: One-Tap Join with Haptic and Confetti

**Test:** Open an active challenge not yet joined. Tap "Join Challenge". Observe the join sequence.
**Expected:** Button disables immediately with a spinner, a success haptic buzz fires (physical device only), a confetti burst overlays the screen, the Joined badge appears, and after a pull-to-refresh (or within ~30s background refetch) the member's row appears in the leaderboard.
**Why human:** Haptics do not fire in the Expo Go simulator — physical device required. Confetti visual and its timing are not testable by jest.

### 3. CHAL-02: Already-Joined and Ended CTA States

**Test:** Re-open the challenge just joined. Then open the one completed challenge.
**Expected:** Already-joined challenge: Join CTA is absent (no button visible). Completed challenge: "Challenge ended" banner appears at the top; no Join CTA.
**Why human:** CTA presence/absence in a running app against live Supabase state must be confirmed visually.

### 4. CHAL-03: Progress Bar Unit Conversion

**Test:** On a joined volume or PR challenge with non-zero scores, observe the progress section. Then change weight unit preference in settings and return.
**Expected:** Progress bar label reads "You: X [unit] · Leader: Y [unit]" using the member's preferred unit (kg or lbs). Changing unit updates the label.
**Why human:** Requires a joined challenge with non-zero `current_score` in the demo DB; unit conversion correctness at the rendered label level needs visual confirmation.

### 5. CHAL-04: Leaderboard Medals and Pinned YOU Row

**Test:** Open a challenge where the demo member has rank > 10. Observe the leaderboard.
**Expected:** Ranks 1, 2, 3 show gold, silver, bronze colored badge backgrounds respectively. Ranks 4+ show plain "#N" in secondary text. A "Your rank" divider line appears below the top 10, followed by the member's own row with a blue-tinted background and "(You)" suffix.
**Why human:** Color rendering (gold/silver/bronze tokens) and pinned-row visual layout require on-device inspection. Requires demo data with the test member outside the top 10.

### 6. CHAL-04: Stale Deep Link Graceful State

**Test:** Navigate to a challenge detail screen with a nonexistent UUID. Either use `nexera://challenges/00000000-0000-0000-0000-000000000000` as a deep link or manually edit the route URL in Expo Go.
**Expected:** Screen shows "This challenge is no longer available" as a full-screen state with a trophy emoji and a "Back to challenges" button. Tapping the button navigates back. App does not crash.
**Why human:** Deep-link routing and crash absence must be confirmed on a running device; the UUID validation and null-detail paths are code-verified but the end-to-end navigation needs human confirmation.

---

## Summary

All 13 observable truths have fully implemented, substantive, and wired code artifacts. The automated gate (03-05-SUMMARY) confirmed 189/189 mobile tests, 347/347 web-admin tests, both tsc clean, and zero hardcoded hex colors in challenge files. Migration 028 is applied to the live DB with 115 visible participant rows confirmed.

The only remaining gate is the on-device walkthrough (03-05 Plan Task 2), which was deferred by the user because it requires a physical device for haptics, confetti feel, leaderboard visual rendering, and deep-link routing. All 6 checklist items from the plan map directly to the human_verification items above.

The phase goal — "Members can discover, join, and compete in gym challenges from the mobile app" — is fully implemented in code. Goal achievement is contingent on the device walkthrough confirming the feel and visual behaviors that automated tests cannot cover.

---

_Verified: 2026-07-19_
_Verifier: Claude (gsd-verifier)_
