// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIConnectionTimeoutError, DedalusError } from '../../core/error';
import { isAbortError } from '../errors';
import { concatBytes, decodeUTF8, encodeUTF8 } from './bytes';

/**
 * The most a buffered (non-streaming) response body may hold, counted after transparent
 * decompression. A body handed to the caller as a stream or a binary `Response` is not capped.
 */
export const MAX_RESPONSE_BODY_BYTES = 64 * 1024 * 1024;

/** The most of an error body the client reads for its message; anything after it is dropped. */
export const MAX_ERROR_BODY_BYTES = 64 * 1024;

/** The most a stream decoder holds for one pending line, event or frame before it gives up. */
export const MAX_STREAM_PENDING_BYTES = 64 * 1024 * 1024;

/** A byte count as the error messages state it: whole MiB or KiB where it divides evenly. */
const formatLimit = (bytes: number): string => {
  if (bytes % (1024 * 1024) === 0) return `${bytes / (1024 * 1024)} MiB`;
  if (bytes % 1024 === 0) return `${bytes / 1024} KiB`;
  return `${bytes} bytes`;
};

/** The error a decoder or body read throws when the server sends more than `limit` bytes for one value. */
export const sizeLimitError = (what: string, limit: number): DedalusError =>
  new DedalusError(`The ${what} is larger than the ${formatLimit(limit)} the SDK will buffer.`);

/** The part of a body stream reader {@link readBodyText} uses, typed without the DOM lib. */
type BodyReader = {
  read(): Promise<{ done: boolean; value?: Uint8Array | string | undefined }>;
  cancel(): Promise<void>;
};

/**
 * Reads a response body as UTF-8 text, never holding more than `limit` bytes of it.
 *
 * `response.text()` buffers whatever the server sends, so a hostile or broken server could make the
 * process hold gigabytes. Past `limit`, `'error'` throws (a success body cut short would only parse
 * wrong) and `'truncate'` keeps what was read (an error message is still useful in part).
 */
export async function readBodyText(
  response: Response,
  limit: number,
  overflow: 'error' | 'truncate' = 'error',
): Promise<string> {
  const body = response.body as unknown as
    | ({ getReader?: () => BodyReader } & Partial<AsyncIterable<Uint8Array | string>>)
    | null;
  const reader: BodyReader | undefined =
    body && typeof body.getReader === 'function'
      ? body.getReader()
      : body && typeof body[Symbol.asyncIterator] === 'function'
        ? iterableReader(body as AsyncIterable<Uint8Array | string>)
        : undefined;
  if (!reader) return readWholeText(response, limit, overflow);

  const chunks: Uint8Array[] = [];
  let total = 0;
  let finished = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        finished = true;
        break;
      }
      if (value == null) continue;
      const bytes = typeof value === 'string' ? encodeUTF8(value) : value;
      if (total + bytes.length > limit) {
        if (overflow === 'error') throw sizeLimitError('response body', limit);
        chunks.push(bytes.subarray(0, limit - total));
        break;
      }
      chunks.push(bytes);
      total += bytes.length;
    }
  } finally {
    // Stops the download of whatever is left, rather than leaving the connection to drain it.
    if (!finished) reader.cancel().catch(() => {});
  }
  return decodeUTF8(concatBytes(chunks));
}

/**
 * A {@link BodyReader} over an async-iterable body: a Node stream, which is what `node-fetch` passed
 * as `fetch` hands back in place of a web `ReadableStream`. Cancelling ends the iteration, which
 * destroys the stream.
 */
const iterableReader = (body: AsyncIterable<Uint8Array | string>): BodyReader => {
  const iterator = body[Symbol.asyncIterator]();
  return {
    read: async () => {
      const next = await iterator.next();
      return next.done ? { done: true } : { done: false, value: next.value };
    },
    cancel: async () => {
      await iterator.return?.();
    },
  };
};

/**
 * Reads a body that offers no stream (some React Native polyfills) in one piece. It cannot be cut
 * off part way, so a declared length over `limit` is refused before reading, and the text read is
 * held to `limit` afterwards, which at least keeps an oversized body from reaching the caller.
 */
const readWholeText = async (
  response: Response,
  limit: number,
  overflow: 'error' | 'truncate',
): Promise<string> => {
  const declared = Number(response.headers.get('content-length'));
  if (overflow === 'error' && Number.isFinite(declared) && declared > limit) {
    throw sizeLimitError('response body', limit);
  }
  const text = await response.text();
  const bytes = encodeUTF8(text);
  if (bytes.length <= limit) return text;
  if (overflow === 'error') throw sizeLimitError('response body', limit);
  return decodeUTF8(bytes.subarray(0, limit));
};

/** Deadlines left armed past the response headers, keyed by the request's abort controller. */
const pendingDeadlines = new WeakMap<AbortController, () => void>();

/**
 * Leaves a request's deadline armed until its buffered body has been read, so a server that sends
 * headers promptly and then trickles the body is still cut off at the timeout.
 */
export const holdDeadline = (controller: AbortController, release: () => void): void => {
  pendingDeadlines.set(controller, release);
};

/** Disarms the deadline {@link holdDeadline} left armed for this request, if any. */
export const releaseDeadline = (controller: AbortController): void => {
  const release = pendingDeadlines.get(controller);
  pendingDeadlines.delete(controller);
  release?.();
};

/**
 * Runs a buffered body read under the request deadline, disarming it once the read settles.
 *
 * A read the deadline aborted rejects with a bare `AbortError`; it is reported as the timeout it was.
 * One the caller's own signal aborted is left as it is.
 */
export async function readUnderDeadline<T>(
  props: { controller: AbortController; options: { signal?: AbortSignal | null | undefined } },
  read: () => Promise<T>,
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (isAbortError(error) && props.controller.signal.aborted && !props.options.signal?.aborted) {
      throw new APIConnectionTimeoutError();
    }
    throw error;
  } finally {
    releaseDeadline(props.controller);
  }
}
