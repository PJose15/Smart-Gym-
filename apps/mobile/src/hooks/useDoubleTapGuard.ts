import { useCallback, useRef } from 'react';

const DEFAULT_COOLDOWN_MS = 1000;

/**
 * Returns a guarded version of the given handler that ignores
 * rapid re-invocations within the cooldown period.
 *
 * Usage:
 *   const guardedLog = useDoubleTapGuard(handleLogSet);
 *   <Button onPress={guardedLog} />
 */
export function useDoubleTapGuard<T extends (...args: unknown[]) => unknown>(
  handler: T,
  cooldownMs = DEFAULT_COOLDOWN_MS,
): T {
  const lastCall = useRef(0);

  return useCallback(
    ((...args: unknown[]) => {
      const now = Date.now();
      if (now - lastCall.current < cooldownMs) return;
      lastCall.current = now;
      return handler(...args);
    }) as T,
    [handler, cooldownMs],
  );
}
