// File generated from our OpenAPI spec by Scalar. See README.md for details.

/**
 * Waits `ms` milliseconds, or until `signal` aborts, whichever comes first.
 *
 * An abort resolves the wait early instead of rejecting it, so each caller turns a cancelled wait into
 * its own error. Without the signal a caller that cancels during a retry backoff would still sit out
 * the whole delay, however long the server asked for. The listener is removed once the wait ends, so
 * a long-lived signal shared across many requests does not collect one per retry.
 */
export const sleep = (ms: number, signal?: AbortSignal | null | undefined) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    /** Ends the wait once, from the timer or the abort, and releases whichever did not fire. */
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
