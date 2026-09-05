/**
 * Shared web-admin API client.
 * All mutating workout traffic goes through the web-admin API routes
 * (EXPO_PUBLIC_API_URL) authenticated with the Supabase session JWT,
 * so points/PRs/achievements are awarded server-side.
 */
import { supabase } from './supabase';

export function getApiBase(): string | null {
  const apiBase = process.env.EXPO_PUBLIC_API_URL;
  if (!apiBase) {
    if (__DEV__) {
      console.warn(
        '[api] EXPO_PUBLIC_API_URL is not set — API-backed features are unavailable. ' +
          'Add it to your .env / EAS build profile.',
      );
    }
    return null;
  }
  return apiBase;
}

/**
 * Fetch against the web-admin API with the current session's Bearer token.
 * Returns null when the API base or session is unavailable (caller decides
 * whether that means "offline queue" or "feature unavailable").
 * Network errors propagate as thrown exceptions so callers can queue retries.
 */
export async function apiFetch(
  path: string,
  init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {},
): Promise<Response | null> {
  const apiBase = getApiBase();
  if (!apiBase) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  return fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...init.headers,
    },
  });
}
