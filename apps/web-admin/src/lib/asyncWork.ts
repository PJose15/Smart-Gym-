/**
 * runAfterResponse — keep a fire-and-forget promise alive on Vercel.
 *
 * On Vercel, the serverless function can be frozen as soon as the response is
 * returned, silently killing un-awaited async work. `waitUntil` from
 * '@vercel/functions' tells the platform to keep the invocation alive until
 * the promise settles. Locally (or if waitUntil is unavailable), we fall back
 * to attaching a catch handler so rejections are logged instead of becoming
 * unhandled rejections.
 *
 * The promise's rejections are always swallowed after logging — callers should
 * attach their own .catch first if they want custom error handling.
 */
export function runAfterResponse(promise: Promise<unknown>): void {
  // Ensure a rejection never becomes an unhandled rejection, regardless of path.
  const guarded = promise.catch(err =>
    console.error(
      '[asyncWork] background task failed:',
      err instanceof Error ? err.message : err
    )
  );

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { waitUntil } = require('@vercel/functions') as {
      waitUntil?: (p: Promise<unknown>) => void;
    };
    if (typeof waitUntil === 'function') {
      waitUntil(guarded);
      return;
    }
  } catch {
    // '@vercel/functions' not available (local dev / non-Vercel runtime)
  }
  // Fallback: nothing else to do — guarded promise runs in the background
  // for as long as the process lives.
}
