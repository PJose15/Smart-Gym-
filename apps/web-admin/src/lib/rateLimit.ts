import { NextResponse } from 'next/server';

/**
 * Simple in-memory sliding window rate limiter.
 * Tracks requests per key (e.g., member_id) within a window.
 *
 * LIMITATION: State resets on server restart and is not shared across
 * serverless instances. Production should use Redis or DB-backed rate limiting.
 */
const windows = new Map<string, number[]>();

// Clean up stale entries every 60 seconds
setInterval(() => {
  const cutoff = Date.now() - 120_000;
  for (const [key, timestamps] of windows) {
    const fresh = timestamps.filter(t => t > cutoff);
    if (fresh.length === 0) windows.delete(key);
    else windows.set(key, fresh);
  }
}, 60_000);

/**
 * Check rate limit for a given key.
 * @param key - Unique identifier (e.g., `feed-react:${memberId}`)
 * @param maxRequests - Max requests allowed in window
 * @param windowMs - Window size in milliseconds
 * @returns NextResponse with 429 if rate limited, or null if allowed
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): NextResponse | null {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = (windows.get(key) ?? []).filter(t => t > cutoff);

  if (timestamps.length >= maxRequests) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }

  timestamps.push(now);
  windows.set(key, timestamps);
  return null;
}
