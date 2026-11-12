import { decodeUTF8, encodeUTF8 } from '../utils/bytes';
import { MAX_STREAM_PENDING_BYTES, sizeLimitError } from '../utils/body';

export type Bytes = string | ArrayBuffer | Uint8Array | null | undefined;

/**
 * A re-implementation of httpx's `LineDecoder` in Python that handles incrementally
 * reading lines from text.
 *
 * https://github.com/encode/httpx/blob/920333ea98118e9cf617f246905d7b202510941c/httpx/_decoders.py#L258
 */
export class LineDecoder {
  // prettier-ignore
  static NEWLINE_CHARS = new Set(['\n', '\r']);
  static NEWLINE_REGEXP = /\r\n|[\n\r]/g;

  // The pending bytes are `#buffer[#start, #end)`. The buffer grows by doubling and a consumed line
  // only moves `#start`, so a long line arriving in many small chunks costs linear time rather than
  // re-copying everything received so far on every chunk.
  #buffer: Uint8Array;
  #start: number;
  #end: number;
  // Where the next newline search starts, relative to `#start`: bytes before it were already
  // searched and held none, so a long line is scanned once rather than once per chunk.
  #scanFrom: number;
  #carriageReturnIndex: number | null;

  constructor() {
    this.#buffer = new Uint8Array();
    this.#start = 0;
    this.#end = 0;
    this.#scanFrom = 0;
    this.#carriageReturnIndex = null;
  }

  decode(chunk: Bytes): string[] {
    if (chunk == null) {
      return [];
    }

    const binaryChunk =
      chunk instanceof ArrayBuffer
        ? new Uint8Array(chunk)
        : typeof chunk === 'string'
          ? encodeUTF8(chunk)
          : chunk;

    this.#append(binaryChunk);

    const lines: string[] = [];
    let patternIndex;
    while (
      (patternIndex = findNewlineIndex(
        this.#pending(),
        Math.max(this.#scanFrom, this.#carriageReturnIndex ?? 0),
      )) != null
    ) {
      if (patternIndex.carriage && this.#carriageReturnIndex == null) {
        // skip until we either get a corresponding `\n`, a new `\r` or nothing
        this.#carriageReturnIndex = patternIndex.index;
        continue;
      }

      // we got double \r or \rtext\n
      if (
        this.#carriageReturnIndex != null &&
        (patternIndex.index !== this.#carriageReturnIndex + 1 || patternIndex.carriage)
      ) {
        lines.push(decodeUTF8(this.#pending().subarray(0, this.#carriageReturnIndex - 1)));
        this.#consume(this.#carriageReturnIndex);
        continue;
      }

      const endIndex =
        this.#carriageReturnIndex !== null ? patternIndex.preceding - 1 : patternIndex.preceding;

      const line = decodeUTF8(this.#pending().subarray(0, endIndex));
      lines.push(line);

      this.#consume(patternIndex.index);
    }

    this.#scanFrom = this.#end - this.#start;
    // A server that never ends its line would otherwise make this buffer grow without bound.
    if (this.#scanFrom > MAX_STREAM_PENDING_BYTES) {
      throw sizeLimitError('stream line', MAX_STREAM_PENDING_BYTES);
    }

    return lines;
  }

  flush(): string[] {
    if (this.#end === this.#start) {
      return [];
    }
    return this.decode('\n');
  }

  /** The bytes received but not yet returned as a line. */
  #pending(): Uint8Array {
    return this.#buffer.subarray(this.#start, this.#end);
  }

  /** Drops the first `count` pending bytes, which a returned line used up. */
  #consume(count: number): void {
    this.#start += count;
    if (this.#start === this.#end) this.#start = this.#end = 0;
    this.#scanFrom = 0;
    this.#carriageReturnIndex = null;
  }

  /** Appends `bytes` to the pending bytes, compacting or doubling the buffer when it is full. */
  #append(bytes: Uint8Array): void {
    if (this.#end + bytes.length > this.#buffer.length) {
      const pending = this.#end - this.#start;
      const needed = pending + bytes.length;
      const next =
        needed <= this.#buffer.length
          ? this.#buffer
          : new Uint8Array(Math.max(needed, this.#buffer.length * 2));
      next.set(this.#buffer.subarray(this.#start, this.#end));
      this.#buffer = next;
      this.#start = 0;
      this.#end = pending;
    }
    this.#buffer.set(bytes, this.#end);
    this.#end += bytes.length;
  }
}

/**
 * This function searches the buffer for the end patterns, (\r or \n)
 * and returns an object with the index preceding the matched newline and the
 * index after the newline char. `null` is returned if no new line is found.
 *
 * ```ts
 * findNewLineIndex('abc\ndef') -> { preceding: 2, index: 3 }
 * ```
 */
function findNewlineIndex(
  buffer: Uint8Array,
  startIndex: number | null,
): { preceding: number; index: number; carriage: boolean } | null {
  const newline = 0x0a; // \n
  const carriage = 0x0d; // \r

  for (let i = startIndex ?? 0; i < buffer.length; i++) {
    if (buffer[i] === newline) {
      return { preceding: i, index: i + 1, carriage: false };
    }

    if (buffer[i] === carriage) {
      return { preceding: i, index: i + 1, carriage: true };
    }
  }

  return null;
}

export function findDoubleNewlineIndex(buffer: Uint8Array, startIndex = 0): number {
  // This function searches the buffer for the end patterns (\r\r, \n\n, \r\n\r\n)
  // and returns the index right after the first occurrence of any pattern,
  // or -1 if none of the patterns are found. `startIndex` skips bytes an earlier search
  // already ruled out.
  const newline = 0x0a; // \n
  const carriage = 0x0d; // \r

  for (let i = startIndex; i < buffer.length - 1; i++) {
    if (buffer[i] === newline && buffer[i + 1] === newline) {
      // \n\n
      return i + 2;
    }
    if (buffer[i] === carriage && buffer[i + 1] === carriage) {
      // \r\r
      return i + 2;
    }
    if (
      buffer[i] === carriage &&
      buffer[i + 1] === newline &&
      i + 3 < buffer.length &&
      buffer[i + 2] === carriage &&
      buffer[i + 3] === newline
    ) {
      // \r\n\r\n
      return i + 4;
    }
  }

  return -1;
}
