/**
 * Sign-out cleanup — clears every piece of user-scoped local state so the
 * next account on this device never sees (or replays) the previous user's
 * data. Called from the settings sign-out flow and the session-expired
 * redirect in the feed screen.
 *
 * User-scoped AsyncStorage inventory:
 * - `@nexera/cache/*`            — cacheManager (machines, program, challenges…)
 * - `@nexera/offline_queue`      — queued offline set writes (would replay
 *                                   into the wrong account!)
 * - `nexera_weight_unit`         — member weight-unit preference cache
 * - `nexera_feed_last_viewed_at` — feed unread-badge baseline
 * - `@nexera/unseen_prs`         — home-screen PR celebration queue
 * - `@nexera:training_profile`   — settings training-profile cache
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAllCaches } from './cacheManager';
import { clearQueue } from './offlineQueue';
import { clearWeightUnitCache } from './weightUnit';
import { clearFlagCache } from './featureFlags';
import { FEED_LAST_VIEWED_KEY } from '../hooks/useUnreadFeedCount';

/** Home-screen PR celebration queue (written pre-4b; read by app/(tabs)/index.tsx). */
export const UNSEEN_PRS_KEY = '@nexera/unseen_prs';

/** Settings training-profile cache (app/settings.tsx). */
export const TRAINING_PROFILE_CACHE_KEY = '@nexera:training_profile';

/**
 * Clear all user-scoped local state. Best-effort — individual failures never
 * block sign-out.
 */
export async function clearUserScopedStorage(): Promise<void> {
  const tasks: Array<Promise<unknown>> = [
    clearAllCaches().catch(() => {}),
    clearQueue().catch(() => {}),
    clearWeightUnitCache().catch(() => {}),
    AsyncStorage.multiRemove([
      FEED_LAST_VIEWED_KEY,
      UNSEEN_PRS_KEY,
      TRAINING_PROFILE_CACHE_KEY,
    ]).catch(() => {}),
  ];
  await Promise.all(tasks);
  // In-memory flag cache (synchronous)
  clearFlagCache();
}
