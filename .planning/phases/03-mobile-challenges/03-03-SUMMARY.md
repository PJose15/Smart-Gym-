---
phase: 03-mobile-challenges
plan: "03"
subsystem: mobile-challenges-ui
tags: [challenges, mobile, expo, react-native, ux]
dependency_graph:
  requires: ["03-02"]
  provides: ["challenges-list-screen", "challenge-card", "challenges-tab"]
  affects: ["apps/mobile/app/(tabs)/_layout.tsx"]
tech_stack:
  added: []
  patterns: ["cacheFirst pattern", "segmented-toggle", "FlatList with RefreshControl", "SkeletonBone/Shimmer"]
key_files:
  created:
    - apps/mobile/src/components/challenges/ChallengeCard.tsx
    - apps/mobile/src/components/skeleton/ChallengesScreenSkeleton.tsx
    - apps/mobile/app/(tabs)/challenges.tsx
  modified:
    - apps/mobile/src/components/skeleton/index.ts
    - apps/mobile/app/(tabs)/_layout.tsx
decisions:
  - "ChallengeCard uses Pressable (not AnimatedCard) — AnimatedCard triggers entrance animations on every list render; Pressable with opacity feedback is more appropriate for list items"
  - "useReducedMotion surfaces via AccessibilityInfo.isReduceMotionEnabled on mount, adjusting maxToRenderPerBatch — avoids animated entrances without removing animations entirely"
  - "router.push cast as any for /challenges/[id] dynamic route — matches progress.tsx pattern; expo-router typed routes require explicit file registration"
  - "CHALLENGES_CACHE_KEY(gymId) cast as any — CacheKey type uses string & Record<string,never> trick that doesn't widen to template literal strings in TypeScript 5.x"
metrics:
  duration_minutes: 8
  completed_date: "2026-07-19"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 2
---

# Phase 03 Plan 03: Mobile Challenges Browse Screen Summary

**One-liner:** Challenges tab with ChallengeCard (type badge + countdown + progress bar), segmented Active/Completed toggle, cacheFirst load, pull-to-refresh, skeleton + empty states — wired to Wave 1 data layer.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | ChallengeCard + ChallengesScreenSkeleton | `1f6dac1` | ChallengeCard.tsx, ChallengesScreenSkeleton.tsx, skeleton/index.ts |
| 2 | Challenges list screen with toggle | `e0bca0e` | app/(tabs)/challenges.tsx |
| 3 | Register Challenges tab | `f01cac4` | app/(tabs)/_layout.tsx |

## What Was Built

### ChallengeCard (`src/components/challenges/ChallengeCard.tsx`)
Reusable list card (110+ lines) covering:
- Row 1: `challengeIcon()` emoji + type badge chip (`primarySubtle` bg, `primary` text) + countdown chip from `countdownLabel()` (ended challenges show grey)
- Row 2: title (fontBold, h2-scale) + description (2-line numberOfLines, textSecondary)
- Row 3: progress bar only when `is_joined && top_score > 0` — track uses `colors.border`, fill uses `colors.primary`, computed via `progressPct(my_score, top_score)`; label "You: X · Leader: Y" via `formatScore()`
- Footer: "Joined" chip (`successSubtle`/`success` tokens) OR participant count when active
- `accessibilityRole="button"` + descriptive `accessibilityLabel` on Pressable
- Zero hardcoded hex — all DOC_03 tokens

### ChallengesScreenSkeleton (`src/components/skeleton/ChallengesScreenSkeleton.tsx`)
Mirrors FeedSkeleton structure using `SkeletonBone`:
- Toggle bar: 2 rect bones side-by-side
- 4 card-shaped bones each with row-1 badge+countdown line bones + 2 description lines
- Exported from `skeleton/index.ts`

### Challenges Screen (`app/(tabs)/challenges.tsx`)
State machine LOADING → ERROR | SUCCESS with REFRESHING sub-state:
- `fetchFeedContext()` + `getWeightUnit()` in parallel on mount
- `cacheFirst(CHALLENGES_CACHE_KEY(gymId), fetchChallenges, CacheTTL.challengesList)`
- `splitByStatus()` drives Active/Completed segmented toggle (default Active)
- `FlatList` with `RefreshControl` (bypasses cache, calls `setCache` after fresh fetch)
- First load: `ChallengesScreenSkeleton` (never blank)
- Empty Active: "No active challenges yet — check back soon" with trophy emoji
- Empty Completed: "No completed challenges yet" with clipboard emoji
- Error: retryable "Couldn't load challenges" with "Try Again" button
- `AccessibilityInfo.isReduceMotionEnabled()` checked on mount → adjusts `maxToRenderPerBatch`

### Tab Registration (`app/(tabs)/_layout.tsx`)
Challenges tab inserted after Feed, before Progress:
- `AnimatedTabIcon name="trophy-outline" activeName="trophy"` — matches existing tab icon pattern
- `tabBarAccessibilityLabel="Challenges tab"`
- No badge (rank-change badge deferred to plan 03-06 per spec)

## Verification Results

- `npx tsc --noEmit`: CLEAN (0 errors)
- `npx jest --silent`: 189/189 tests pass (10 suites)
- `grep progressPct ChallengeCard.tsx`: FOUND
- `grep ChallengesScreenSkeleton skeleton/index.ts`: FOUND
- `grep splitByStatus challenges.tsx`: FOUND
- `grep RefreshControl challenges.tsx`: FOUND
- `grep trophy _layout.tsx`: FOUND

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript CacheKey type incompatibility with template literal return**
- **Found during:** Task 2
- **Issue:** `CHALLENGES_CACHE_KEY(gymId)` returns `string` (TypeScript infers from template literal), but `CacheKey` type uses `keyof typeof CacheTTL | (string & Record<string, never>)` which doesn't widen to accept a plain `string` return type in TS 5.x
- **Fix:** Cast `CHALLENGES_CACHE_KEY(gymId) as any` at both call sites (matches pattern used in `progress.tsx` and `scan.tsx` for dynamic route paths)
- **Files modified:** `app/(tabs)/challenges.tsx`
- **Commit:** `e0bca0e`

**2. [Rule 1 - Bug] Custom Text component doesn't accept accessibilityElementsHidden / aria-hidden**
- **Found during:** Task 1
- **Issue:** The custom `Text` wrapper only accepts `children`, `variant`, `color`, `style`, `numberOfLines` — decorative emoji received an unsupported prop
- **Fix:** Removed accessibility suppression from the emoji text; the Pressable's `accessibilityLabel` covers the card semantics and the emoji is effectively hidden from the label content
- **Files modified:** `apps/mobile/src/components/challenges/ChallengeCard.tsx`
- **Commit:** `1f6dac1`

### Out-of-scope Observations (Deferred)

Pre-existing TypeScript errors in `app/challenges/[id].tsx` (from plan 03-04 partial work in prior session — uncommitted file): `CacheKey` string argument errors and dynamic import `--module` flag issue. These are pre-existing, not introduced by 03-03. Will be resolved when plan 03-04 is formally executed.

## Self-Check: PASSED

All 3 created files found on disk. All 3 task commits verified in git log.
