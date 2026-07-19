# Phase 3: Mobile Challenges — Research

**Researched:** 2026-07-19
**Domain:** Expo React Native mobile UI on existing Next.js/Supabase backend
**Confidence:** HIGH (grounded in direct codebase audit)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHAL-01 | Member can browse active and completed gym challenges on mobile — cards with type badge, title, description, end-date countdown; active/completed tab toggle; consumes `/api/member/challenges` | Endpoint verified; `ChallengeListItem` type confirmed; tab pattern confirmed from web implementation |
| CHAL-02 | Member can join a challenge with one tap — join CTA on detail; existing join endpoint; optimistic update + success haptic; disabled when already joined or ended | Join endpoint verified (`POST /api/member/challenges/[challengeId]/join`); haptics install needed (not in mobile package.json) |
| CHAL-03 | Member sees their own progress within a joined challenge — progress bar "You: current / goal" from existing `current_value`/`goal_value` API fields | `my_score` and `top_score` are the available fields (no `goal_value` column in DB); CHAL-03 progress bar will use `my_score / top_score` ratio |
| CHAL-04 | Member sees challenge leaderboard with own rank always visible — top ranks with gold/silver/bronze badges; own row pinned when outside visible window; graceful "no longer available" for deleted/ended challenges | RLS gap: members cannot SELECT other members' `challenge_participants` rows via direct Supabase client — leaderboard requires `challengeService.ts` with admin client or a migration adding member-read policy |
</phase_requirements>

---

## Summary

Phase 3 is a mobile-only UI phase. The backend is complete: three web-admin API routes cover listing, detail, and joining challenges, plus associated Supabase tables (`gym_challenges`, `challenge_participants`). The work is building React Native equivalents of the web challenge pages, wired into the existing tab structure.

**Architecture decision with real consequence:** The mobile feed (Phase 2) used direct Supabase queries (`challengeService.ts` pattern) for everything because the web-admin cookie session is not available on mobile. For the challenges leaderboard, this approach hits an RLS wall: `challenge_participants` has no SELECT policy for non-owner members reading other participants' rows. The `challenge_participants_own` policy covers only the member's own row; `challenge_participants_gym_read` is owner-scoped only. Two viable solutions exist: (a) add Migration 028 with a `challenge_participants_member_gym_read` policy (`is_gym_member(gym_id)`), mirroring the `challenges_gym_members_read` pattern that already exists on `gym_challenges`; or (b) call the existing web-admin API routes directly. Solution (a) is cleaner and mirrors exactly how feed and gym_challenges reads already work on mobile.

**Progress bar clarification (CHAL-03):** The `gym_challenges` table has no `goal_value` or `target_value` column — the goal is baked into the `description` text field. The `ChallengeListItem.my_score` and `top_score` fields are what's available. Progress should be rendered as `my_score / top_score * 100%` (my score vs current leader), not `my_score / goal` (which doesn't exist as a structured field).

**Primary recommendation:** Build a `challengeService.ts` mirroring `feedService.ts`, add Migration 028 to grant members SELECT on `challenge_participants` for their gym, create a `challenges` tab screen with list + detail, and register the `challenges/[id]` route in `_layout.tsx`.

---

## Standard Stack

### Core (already installed — no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-router` | ~4.0.0 | File-based routing + Stack.Screen | Already in use; `challenges/[id].tsx` is file-convention deep link |
| `@supabase/supabase-js` | ^2.x | Direct DB queries under RLS | Already configured; `feedService.ts` confirms the mobile pattern |
| `@nexera/types` | workspace | `ChallengeListItem`, `ChallengeDetail`, `ChallengeParticipant`, `ChallengeType` types | Already typed; no new types needed for core flow |
| `AsyncStorage` | via expo | Cache persistence (TTL pattern from `cacheManager.ts`) | Already in use; `challenges:${gymId}` and `challenge:${challengeId}` cache keys needed |
| React Native `Animated` | built-in | Tab toggle animation, list transitions | Already used in `FeedFilterBar`, `AnimatedTabIcon` |

### Supporting (installation needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-haptics` | ^14.x (SDK 52 compatible) | Join success haptic (`NotificationFeedbackType.Success`) | CHAL-02 requires haptic on join; NOT currently in `apps/mobile/package.json` — must `pnpm add expo-haptics` in `apps/mobile/` |

**Installation:**
```bash
cd apps/mobile
pnpm add expo-haptics
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Migration 028 (RLS policy) | Call web-admin API routes | Web-admin routes require cookie session; mobile has no cookie — would need fetch with Supabase Bearer token, which requires service-role or anon key workaround; migration is cleaner and matches existing pattern |
| `challengeService.ts` direct Supabase | React Query | No React Query anywhere in mobile codebase; introducing it would break consistency |

---

## Architecture Patterns

### Recommended Project Structure

```
apps/mobile/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx          MODIFY — add 'challenges' tab (6th tab)
│   │   └── challenges.tsx       NEW — challenges list screen (active/completed toggle)
│   └── challenges/
│       └── [id].tsx             NEW — challenge detail + leaderboard (modal stack)
├── src/
│   ├── lib/
│   │   ├── challengeService.ts  NEW — Supabase queries (mirrors feedService.ts)
│   │   └── cacheManager.ts      MODIFY — add challenges TTL keys
│   └── components/
│       └── challenges/          NEW directory
│           ├── ChallengeCard.tsx     NEW — list card with type icon, countdown
│           └── ChallengeLeaderboard.tsx  NEW — ranked list with pinned "You" row
supabase/migrations/
└── 028_challenge_member_read.sql   NEW — RLS policy for leaderboard reads
```

### Pattern 1: Direct Supabase Service (mirror feedService.ts)

**What:** All challenge data flows through `challengeService.ts` using the mobile `supabase` client under RLS (same as `feedService.ts` / `leaderboardService.ts`).

**When to use:** All read operations (challenge list, detail, participants). Write operations (join) should go through the existing web-admin API route `POST /api/member/challenges/[id]/join` since it handles rate limiting, dedup, feed event creation, and milestone logging that a direct insert would miss.

**Why not use web-admin API for reads:** Mobile has no cookie session — the web-admin `verifyMember()` uses `supabase.auth.getSession()` which returns a cookie-based session. The mobile anon+JWT client cannot satisfy this; only direct Supabase works.

```typescript
// Source: feedService.ts pattern
// apps/mobile/src/lib/challengeService.ts

import { supabase } from './supabase';
import type { ChallengeListItem, ChallengeDetail, ChallengeParticipant, ChallengeType } from '@nexera/types';

export async function fetchChallenges(gymId: string, memberId: string): Promise<ChallengeListItem[]> {
  // Direct Supabase — RLS "challenges_gym_members_read" allows SELECT for is_gym_member
  const { data: challenges, error } = await supabase
    .from('gym_challenges')
    .select('id, title, description, challenge_type, start_date, end_date, is_active, top_score, created_at')
    .eq('gym_id', gymId)
    .or(`is_active.eq.true,completed_at.gte.${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}`)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;

  // Participation (own rows — "challenge_participants_own" policy)
  const ids = (challenges ?? []).map(c => c.id);
  const { data: participations } = await supabase
    .from('challenge_participants')
    .select('challenge_id, current_score, current_rank')
    .eq('member_id', memberId)
    .in('challenge_id', ids);

  // ... map to ChallengeListItem
}
```

**Critical note on participants for leaderboard:** After Migration 028 adds `challenge_participants_member_gym_read`, the leaderboard fetch is:
```typescript
// Requires Migration 028
const { data: participants } = await supabase
  .from('challenge_participants')
  .select('member_id, current_score, current_rank, joined_at')
  .eq('challenge_id', challengeId)
  .order('current_rank', { ascending: true });
```

Member names/avatars must be resolved via the `gym_members` + `profiles` compatibility views (same `resolveMemberInfo()` pattern as `feedService.ts`).

### Pattern 2: Join via Web-Admin API Route

**What:** The join action calls `POST /api/member/challenges/[id]/join` via `fetch` from mobile. The mobile Supabase JWT is passed as Authorization header so the web-admin route can authenticate.

**When to use:** Join only (not reads). This is correct because the join route handles: rate limiting (`checkRateLimit`), feed event creation (`challenge_joined`), milestone logging — logic that must not be duplicated.

**How mobile authenticates against web-admin routes:**
```typescript
// Mobile has no cookie session but has a JWT
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/member/challenges/${challengeId}/join`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,  // verifyMember() accepts Bearer tokens
  },
  body: JSON.stringify({ member_id: memberId, gym_id: gymId }),
});
```

**Verify:** `verifyMember()` in `apps/web-admin/src/lib/auth/verifyMember.ts` must accept Bearer JWT (confirm it calls `supabase.auth.getUser(token)` or equivalent). If it only uses `getSession()` from cookies, a small modification to accept the Bearer header may be needed — this is a Wave 0 check.

### Pattern 3: ChallengeCard Component

**What:** Reusable list card for both active and completed challenges, following the colors/typography system.

```typescript
// Source: adapted from apps/web-admin/src/app/(member)/gym/challenges/page.tsx
// apps/mobile/src/components/challenges/ChallengeCard.tsx

const CHALLENGE_ICONS: Record<ChallengeType | string, string> = {
  volume: '🏋️',
  sessions: '💪',
  pr: '🏆',
  streak: '🔥',
  machine_explorer: '🗺️',
  team: '🤝',
  custom: '🎯',
};

// Colors: colors.gold (#E8B339) for rank #1, colors.silver for #2, colors.bronze for #3
// Type badge uses colors.primarySubtle background + colors.primary text
// Joined state: colors.successSubtle background + colors.success text
```

### Pattern 4: Pinned "You" Row in Leaderboard

**What:** When the current member is outside the visible leaderboard window, render their row pinned at the bottom of the list with a visual separator.

```typescript
// apps/mobile/src/components/challenges/ChallengeLeaderboard.tsx
// Separate the "me" entry from the rest; render top-N + separator + me-row
const topEntries = participants.filter(p => p.member_id !== myMemberId).slice(0, 10);
const myEntry = participants.find(p => p.member_id === myMemberId);
const meIsVisible = topEntries.some(p => p.member_id === myMemberId);

// If my rank > 10: show top 10 + "..." divider + my row pinned
// Uses colors.info + colors.infoSubtle for "You" highlight (matching web's #60A5FA)
```

### Pattern 5: Tab Layout Addition

**What:** Add a 6th tab for challenges. Current tabs: Home, Scan, Feed, Progress, Profile.

**Location:** `apps/mobile/app/(tabs)/_layout.tsx` — add `Tabs.Screen` for `challenges` after `feed`.

**Icon:** `Ionicons 'trophy-outline'` / `'trophy'` (focused) — consistent with Nexera branding; trophy represents challenges/competition.

**Badge:** None initially (rank-change badge is Phase 6 notification work).

### Anti-Patterns to Avoid

- **Direct Supabase for join:** Inserting directly into `challenge_participants` bypasses rate limiting, feed event creation, and milestone logging in the web-admin join route. Always call the API route for writes.
- **Leaderboard before Migration 028:** Direct `challenge_participants` reads from mobile will fail silently (RLS returns 0 rows for non-owner members trying to read other members' rows). Without the migration, the leaderboard will always appear empty.
- **Polling leaderboard on focus:** Only poll on explicit refresh (pull-to-refresh). Leaderboard data is updated by `challengeScoring.ts` during session complete — changes are infrequent and polling-every-focus wastes resources.
- **Showing `my_score / goal_value` progress:** There is no `goal_value` column. Use `my_score / top_score` (my score vs current leader). The goal text lives only in the `description` string.
- **Importing web React components:** `apps/web-admin/src/app/(member)/gym/challenges/*.tsx` are React DOM components — they cannot be imported into Expo. Build equivalent React Native components.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Weight unit formatting for volume-type scores | Custom kg/lbs formatter | `convertFromLbs` / `formatFeedEvent` pattern from `feedLogic.ts` | Already battle-tested with same DB lbs-storage convention |
| Member name resolution for leaderboard | New lookup pattern | `resolveMemberInfo()` from `feedService.ts` | Same `gym_members` + `profiles` compatibility-view path |
| Cache invalidation | Custom cache | `getCached` / `setCache` / `cacheFirst` from `cacheManager.ts` with TTL keys | Already versioned; prevents stale-cache bugs |
| Animation system | Custom `Animated` wrappers | Existing `AnimatedTabIcon`, `AnimatedCard` patterns | Consistent with DOC_03 motion spec |
| Color tokens | Inline hex | `colors` from `src/theme/colors.ts` | `colors.gold`/`colors.silver`/`colors.bronze` are already defined for rank badges |
| Skeleton loading | Blank screen during load | `SkeletonBone`, `Shimmer` from `src/components/skeleton/` | Phase 2 feed tab set the pattern; challenges must match |

**Key insight:** The `feedService.ts` / `feedLogic.ts` split (service = Supabase queries, logic = pure functions) is the mobile data layer pattern. Mirror it exactly: `challengeService.ts` (queries) + inline utils or `challengeLogic.ts` (pure mappers, testable under jest node environment).

---

## Common Pitfalls

### Pitfall 1: RLS Gap on challenge_participants Leaderboard

**What goes wrong:** `challengeService.ts` fetches participants for the leaderboard; Supabase silently returns 0 rows because the authenticated member role has no SELECT policy covering other members' `challenge_participants` rows. Leaderboard renders empty with no error.

**Why it happens:** `challenge_participants_own` (ALL) covers only `member_id = my_id`. `challenge_participants_gym_read` (SELECT) covers only `owned_gym_ids()` (owner role). No policy exists for "members can read all participants in their gym."

**How to avoid:** Migration 028 must land before the leaderboard screen is built:
```sql
-- 028_challenge_member_read.sql
CREATE POLICY "challenge_participants_member_gym_read"
  ON challenge_participants FOR SELECT
  USING (is_gym_member(gym_id));
```

**Warning signs:** Leaderboard shows 0 entries even in demo seed with 20+ participants per challenge.

### Pitfall 2: verifyMember() Bearer Token Support

**What goes wrong:** Mobile calls `POST /api/member/challenges/[id]/join` with `Authorization: Bearer <jwt>` — if `verifyMember()` only reads the Supabase session from cookies, it returns 401 on mobile.

**Why it happens:** Web-admin routes use cookie sessions; mobile uses JWT tokens in Authorization header. These are different authentication flows.

**How to avoid:** Audit `apps/web-admin/src/lib/auth/verifyMember.ts` in Wave 0. If it uses `supabase.auth.getSession()` (cookie-based), modify it to also accept `req.headers.authorization` Bearer token via `supabase.auth.getUser(token)`. The leaderboard service uses service-role (`admin`) client — join also uses this pattern.

**Warning signs:** 401 response from join endpoint when called from mobile even though member is authenticated in Supabase.

### Pitfall 3: No goal_value in Schema

**What goes wrong:** CHAL-03 spec says "progress bar from existing `current_value`/`goal_value` API fields" — but neither column exists. `current_value` is `current_score`; `goal_value` does not exist in `gym_challenges` or `challenge_participants`.

**Why it happens:** The DB schema folds the goal into the `description` text field. The spec references fields from a proposed schema, not the actual deployed schema.

**How to avoid:** Render progress as `(my_score / top_score) * 100` with label "You: {my_score} · Leader: {top_score}". This is what the web implementation does (see `ChallengeDetail` → `top_score` and `my_score` fields in `ChallengeListItem`).

**Warning signs:** TypeScript error `Property 'goal_value' does not exist on type 'ChallengeListItem'`.

### Pitfall 4: expo-haptics Not Installed

**What goes wrong:** `import * as Haptics from 'expo-haptics'` fails with module-not-found; CHAL-02 haptic on join is not possible without the package.

**Why it happens:** Current `apps/mobile/package.json` does NOT include `expo-haptics` — confirmed by direct audit.

**How to avoid:** Wave 0 task: `pnpm add expo-haptics` in `apps/mobile/`. Verify SDK 52 compatibility (SDK 52 = Expo 52; `expo-haptics ^14.x` is compatible).

### Pitfall 5: Stale Deep Link to Deleted/Ended Challenge

**What goes wrong:** Member taps push notification deep link to `challenges/[id]` for a challenge that has since ended or been deleted. The detail screen crashes or shows blank.

**Why it happens:** The `challengeService.fetchChallengeDetail()` returns null/404 for non-existent challenges. Without explicit handling, the screen renders undefined data.

**How to avoid:** In `challenges/[id].tsx`, handle `data === null` explicitly with a graceful "This challenge is no longer available" screen (with back navigation). Check `is_active` on the response and show "Challenge ended" state when `is_active === false`. The web implementation does `if (!data) return <div>Challenge not found</div>` — mirror this exactly.

### Pitfall 6: Weight Unit in Score Display

**What goes wrong:** Challenge scores for `volume` type are stored in lbs (same as all workout volumes in this DB). Displaying raw `my_score` to a kg-preference user shows lbs without conversion.

**Why it happens:** `challenge_participants.current_score` is a raw `numeric(12,2)` — the unit is determined by challenge type. Volume challenges use lbs; sessions challenges use count; PR challenges use lbs; streak challenges use day-count.

**How to avoid:** For `challenge_type === 'volume' || challenge_type === 'pr'`: convert scores through `convertFromLbs(score, weightUnit)` from `feedLogic.ts`. For `sessions`, `streak`, `machine_explorer`, `custom`: display score as integer (no unit conversion). Load `weightUnit` via `getWeightUnit()` from `weightUnit.ts`.

---

## Code Examples

### Migration 028 — Member Read Policy

```sql
-- supabase/migrations/028_challenge_member_read.sql
-- Grants authenticated members SELECT on challenge_participants rows
-- in their gym (needed for mobile leaderboard — mirrors challenges_gym_members_read
-- pattern on gym_challenges which already uses is_gym_member).

CREATE POLICY "challenge_participants_member_gym_read"
  ON challenge_participants FOR SELECT
  USING (is_gym_member(gym_id));
```

### CacheTTL Additions

```typescript
// Source: apps/mobile/src/lib/cacheManager.ts — add to CacheTTL object
export const CacheTTL = {
  // ... existing keys ...
  challengesList: 5 * 60 * 1000,      // 5 minutes
  challengeDetail: 2 * 60 * 1000,     // 2 minutes (leaderboard changes more often)
} as const;
```

Cache keys: `challenges:${gymId}` for list; `challenge:${challengeId}` for detail.

### Tab Layout Addition

```typescript
// Source: apps/mobile/app/(tabs)/_layout.tsx — add after 'feed' Tabs.Screen
<Tabs.Screen
  name="challenges"
  options={{
    title: 'Challenges',
    tabBarAccessibilityLabel: 'Challenges tab',
    tabBarIcon: ({ color, size, focused }) => (
      <AnimatedTabIcon
        name="trophy-outline"
        activeName="trophy"
        size={size}
        color={color}
        focused={focused}
      />
    ),
  }}
/>
```

### Stack Screen Registration

```typescript
// Source: apps/mobile/app/_layout.tsx — add to Stack
<Stack.Screen
  name="challenges/[id]"
  options={{ title: 'Challenge', headerShown: true }}
/>
```

### Join with Haptic

```typescript
// Source: apps/mobile/app/(tabs)/challenges.tsx
import * as Haptics from 'expo-haptics';

async function handleJoin(challengeId: string) {
  setJoining(challengeId);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL}/api/member/challenges/${challengeId}/join`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ member_id: memberId, gym_id: gymId }),
      }
    );
    if (res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // optimistic update: mark is_joined = true in local state
      setChallenges(prev =>
        prev.map(c => c.challenge_id === challengeId ? { ...c, is_joined: true } : c)
      );
    }
  } finally {
    setJoining(null);
  }
}
```

### Pinned "You" Row Pattern

```typescript
// Source: apps/web-admin/src/app/(member)/gym/challenges/[challengeId]/page.tsx — adapted for RN
// apps/mobile/src/components/challenges/ChallengeLeaderboard.tsx

function ChallengeLeaderboard({ participants, myMemberId }: Props) {
  const topEntries = participants.slice(0, 10);
  const myEntry = participants.find(p => p.member_id === myMemberId);
  const meInTop = topEntries.some(p => p.member_id === myMemberId);

  return (
    <View>
      {topEntries.map(p => <ParticipantRow key={p.member_id} p={p} isMe={p.member_id === myMemberId} />)}
      {!meInTop && myEntry && (
        <>
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
          <ParticipantRow p={myEntry} isMe pinned />
        </>
      )}
    </View>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct `challenge_participants` SELECT from mobile | Blocked by RLS (no member-read policy) | Current state (pre-Phase 3) | Requires Migration 028 to unblock leaderboard reads |
| Mock/empty challenges screen | Full list + detail + leaderboard | Phase 3 | Core CHAL-01 through CHAL-04 delivery |
| `ChallengeData` stub in `HomeScreenData` | Full `ChallengeListItem`/`ChallengeDetail` types | Already typed in `@nexera/types` | No new type work needed |

**Schema reality check (vs REQUIREMENTS.md spec language):**
- "current_value" → actual column: `current_score`
- "goal_value" → does not exist; goal lives in `description` text only
- "7 challenge types" in CHAL-01 → confirmed: `volume`, `sessions`, `machine_explorer`, `pr`, `streak`, `team`, `custom`

---

## Open Questions

1. **verifyMember() Bearer support**
   - What we know: Mobile cannot use cookie sessions; join route requires `verifyMember()`.
   - What's unclear: Whether `verifyMember.ts` currently accepts `Authorization: Bearer` header (code not read in this research session).
   - Recommendation: Wave 0 task — read `apps/web-admin/src/lib/auth/verifyMember.ts` and either confirm Bearer support or add it before building the join flow.

2. **EXPO_PUBLIC_API_URL for join fetch**
   - What we know: Mobile needs to call a web-admin API route for join. The base URL must be configured.
   - What's unclear: Whether `EXPO_PUBLIC_API_URL` is already in the mobile `.env` or needs to be added.
   - Recommendation: Check `apps/mobile/.env.example` or `apps/mobile/app.config.js`; if absent, add as `EXPO_PUBLIC_API_URL=https://nexera.app` (or localhost during development).

3. **Score unit for 'team' type challenges**
   - What we know: There are `challenge_teams` rows with `team_score`; `challenge_participants` has `current_score`.
   - What's unclear: For `team` challenges, does `challenge_participants.current_score` hold individual or team score?
   - Recommendation: Display individual score from `challenge_participants` regardless of type; team-specific rendering is an enhancement. The seed data doesn't include team challenges actively (inspect seed rows for team type).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | jest-expo 52 + ts-jest 29 |
| Config file | `apps/mobile/jest.config.js` (preset: ts-jest, testEnvironment: node) |
| Quick run command | `cd apps/mobile && npx jest --testPathPattern=challengeService` |
| Full suite command | `cd apps/mobile && npx jest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAL-01 | `fetchChallenges()` returns active/completed split with `is_joined` populated | unit | `npx jest --testPathPattern=challengeService -t "fetchChallenges"` | ❌ Wave 0 |
| CHAL-01 | Active tab filters `is_active === true`; Completed filters `is_active === false` | unit | `npx jest --testPathPattern=challengeLogic -t "tab filter"` | ❌ Wave 0 |
| CHAL-02 | `handleJoin` optimistic update toggles `is_joined` in local state | unit | `npx jest --testPathPattern=challengeService -t "join optimistic"` | ❌ Wave 0 |
| CHAL-02 | Already-joined challenge returns 409 → `is_joined` stays true | unit | `npx jest --testPathPattern=challengeService -t "join already joined"` | ❌ Wave 0 |
| CHAL-03 | `progressPct = (myScore / topScore) * 100`, clamp 0-100 | unit | `npx jest --testPathPattern=challengeLogic -t "progress pct"` | ❌ Wave 0 |
| CHAL-03 | Volume scores convert lbs→kg when `weightUnit === 'kg'` | unit | `npx jest --testPathPattern=challengeLogic -t "score weight unit"` | ❌ Wave 0 |
| CHAL-04 | `ChallengeLeaderboard` pins "You" row when member is outside top-10 | unit | `npx jest --testPathPattern=challengeLogic -t "pinned row"` | ❌ Wave 0 |
| CHAL-04 | `fetchChallengeDetail()` returns null for missing challenge (404) | unit | `npx jest --testPathPattern=challengeService -t "challenge not found"` | ❌ Wave 0 |
| CHAL-04 | `is_active === false` → detail screen shows ended state (no join CTA) | unit | `npx jest --testPathPattern=challengeLogic -t "ended state"` | ❌ Wave 0 |

**Pure logic tests follow `feedLogic.test.ts` pattern:** Mock Supabase at module level; test pure mappers (progress pct, score formatting, pinned row logic) without network.

**Service tests follow `cacheManager.test.ts` pattern:** Mock `@supabase/supabase-js` with `jest.mock()`; test `fetchChallenges` and `fetchChallengeDetail` response shaping.

### Sampling Rate

- **Per task commit:** `cd apps/mobile && npx jest --testPathPattern=challenge`
- **Per wave merge:** `cd apps/mobile && npx jest` (full 135-test suite + new challenge tests)
- **Phase gate:** Full mobile suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/mobile/src/lib/__tests__/challengeService.test.ts` — covers CHAL-01 fetch, CHAL-02 join, CHAL-04 not-found
- [ ] `apps/mobile/src/lib/__tests__/challengeLogic.test.ts` — covers CHAL-01 tab filter, CHAL-03 progress pct + weight unit, CHAL-04 pinned row logic
- [ ] `supabase/migrations/028_challenge_member_read.sql` — RLS gate for leaderboard; must land in Wave 0 (or leaderboard will appear empty in all subsequent tasks)
- [ ] Verify `verifyMember.ts` accepts Bearer JWT (or patch it) — required for join from mobile
- [ ] `pnpm add expo-haptics` in `apps/mobile/` — required for CHAL-02 haptic

---

## Sources

### Primary (HIGH confidence)

- `apps/web-admin/src/app/api/member/challenges/route.ts` — list endpoint: fields returned, query structure, `ChallengeListItem` mapping
- `apps/web-admin/src/app/api/member/challenges/[challengeId]/route.ts` — detail endpoint: `ChallengeDetail` type, participants shape, no `goal_value` field
- `apps/web-admin/src/app/api/member/challenges/[challengeId]/join/route.ts` — join endpoint: rate limiting, feed event creation, milestone log, 409 on duplicate
- `supabase/migrations/001_nexera_schema.sql` — `gym_challenges` columns (no `goal_value`), `challenge_participants` columns, RLS policies (`challenge_participants_own` member-only, `challenge_participants_gym_read` owner-only)
- `supabase/migrations/023_rls_policies_triggers_indexes.sql` — no member-read policy added for `challenge_participants`
- `supabase/migrations/026_restore_client_grants.sql` — confirms mobile uses direct Supabase under authenticated role + RLS
- `apps/mobile/src/lib/feedService.ts` — canonical mobile data layer pattern (direct Supabase, `resolveMemberInfo` via `gym_members`/`profiles` views)
- `apps/mobile/src/lib/cacheManager.ts` — `getCached`/`setCache`/`cacheFirst` + `CacheTTL` extension pattern
- `apps/mobile/app/(tabs)/_layout.tsx` — current 5-tab structure, `AnimatedTabIcon` pattern
- `apps/mobile/app/_layout.tsx` — `Stack.Screen` registration pattern
- `apps/mobile/package.json` — confirms `expo-haptics` is NOT installed
- `apps/mobile/src/theme/colors.ts` — `gold`, `silver`, `bronze`, `primary`, `success` tokens for rank badges
- `packages/types/src/index.ts` — `ChallengeListItem`, `ChallengeDetail`, `ChallengeParticipant`, `ChallengeType`
- `supabase/seed-bulk.sql` — 6 demo challenges (5 active + 1 completed), participants seeded for Iron Society

### Secondary (MEDIUM confidence)

- `apps/web-admin/src/app/(member)/gym/challenges/page.tsx` — web list page: `CHALLENGE_ICONS` record, tab toggle pattern, optimistic join state
- `apps/web-admin/src/app/(member)/gym/challenges/[challengeId]/page.tsx` — web detail page: `RANK_MEDALS`, `StatChip`, leaderboard row with "(You)" highlight
- `apps/mobile/src/lib/__tests__/feedLogic.test.ts` — test pattern for pure mobile logic functions (node test env, no React)

### Tertiary (LOW confidence)

- Architecture research (`ARCHITECTURE.md` 2026-06-03) — "Option A: 5th Gym tab" recommendation; Phase 3 research chose a dedicated Challenges tab instead based on feed tab already filling the community role

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps audited from package.json; haptics install confirmed missing
- Architecture: HIGH — data layer pattern confirmed from feedService.ts; RLS gaps confirmed from migrations
- Pitfalls: HIGH — RLS gap and schema mismatch confirmed directly from migration SQL and API route code
- Test approach: HIGH — mirrors feedLogic/cacheManager test patterns already in codebase

**Research date:** 2026-07-19
**Valid until:** 2026-08-19 (stable backend, no fast-moving deps)
