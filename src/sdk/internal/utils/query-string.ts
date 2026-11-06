// File generated from our OpenAPI spec by Scalar. See README.md for details.

/**
 * How an array is written to the query string:
 * - `comma`: one pair, values joined with `,` (`a=1%2C2`)
 * - `repeat`: one pair per value under the same key (`a=1&a=2`)
 * - `indices`: one pair per value, keyed by position (`a%5B0%5D=1&a%5B1%5D=2`)
 * - `brackets`: one pair per value, keyed with empty brackets (`a%5B%5D=1&a%5B%5D=2`)
 */
export type QueryArrayFormat = 'comma' | 'repeat' | 'indices' | 'brackets';

/** How `encodeQueryString` lays out arrays and nested objects; both are fixed per SDK by its config. */
export type QueryStringOptions = {
  /** How an array becomes pairs; see {@link QueryArrayFormat}. */
  readonly arrayFormat: QueryArrayFormat;
  /** Writes nested object keys as `a.b` instead of `a[b]`. Array positions keep their brackets. */
  readonly allowDots: boolean;
};

/**
 * Encodes the own enumerable properties of `query` as `key=value` pairs joined with `&`, recursing
 * into nested objects and arrays. Anything that is not an object encodes to an empty string.
 */
export function encodeQueryString(query: unknown, options: QueryStringOptions): string {
  if (query === null || typeof query !== 'object') return '';
  const pairs: string[] = [];
  const ancestors = new Set<object>([query]);
  for (const key of Object.keys(query)) {
    appendPairs(pairs, key, (query as Record<string, unknown>)[key], options, ancestors);
  }
  return pairs.join('&');
}

/**
 * Appends the pairs for one value under its full key path.
 *
 * `undefined` and functions are left out, while `null` keeps its key with an empty value, so a caller
 * can still send `key=` on purpose. Empty arrays and objects contribute no pairs at all.
 */
function appendPairs(
  pairs: string[],
  key: string,
  value: unknown,
  options: QueryStringOptions,
  ancestors: Set<object>,
): void {
  if (value === undefined || typeof value === 'function') return;
  if (value === null) {
    pairs.push(`${encodeComponent(key)}=`);
    return;
  }
  if (value instanceof Date) {
    pairs.push(`${encodeComponent(key)}=${encodeComponent(isoString(value))}`);
    return;
  }
  if (Array.isArray(value)) {
    enter(ancestors, value, key);
    appendArrayPairs(pairs, key, value, options, ancestors);
    ancestors.delete(value);
    return;
  }
  if (isNodeBuffer(value)) {
    // A Node `Buffer` is written as its UTF-8 text, the way it reads when interpolated, rather than
    // walked byte by byte like the plain object it otherwise is. A bare `Uint8Array` is still walked.
    pairs.push(`${encodeComponent(key)}=${encodeComponent(String(value))}`);
    return;
  }
  if (typeof value === 'object') {
    enter(ancestors, value, key);
    for (const childKey of Object.keys(value)) {
      const childPath = options.allowDots ? `${key}.${childKey}` : `${key}[${childKey}]`;
      appendPairs(pairs, childPath, (value as Record<string, unknown>)[childKey], options, ancestors);
    }
    ancestors.delete(value);
    return;
  }
  pairs.push(`${encodeComponent(key)}=${encodeComponent(String(value))}`);
}

/** Appends the pairs for one array, laid out by `options.arrayFormat`. */
function appendArrayPairs(
  pairs: string[],
  key: string,
  values: readonly unknown[],
  options: QueryStringOptions,
  ancestors: Set<object>,
): void {
  if (values.length === 0) return;
  if (options.arrayFormat === 'comma') {
    // A single pair whose value is the plain `Array#join` of the elements: top-level dates become ISO
    // strings first, `null`/`undefined` become empty slots, and anything nested is joined by `join`'s
    // own string conversion rather than encoded as a further level.
    const joined = values.map((item) => (item instanceof Date ? isoString(item) : item)).join(',');
    pairs.push(`${encodeComponent(key)}=${encodeComponent(joined)}`);
    return;
  }
  // Indexing by position, not by a running count, keeps `a[2]` for the third element even when an
  // earlier `undefined` element was left out. `forEach` skips the holes of a sparse array, which
  // leaves them out the same way.
  values.forEach((item, index) => {
    appendPairs(pairs, arrayItemPath(key, index, options.arrayFormat), item, options, ancestors);
  });
}

/**
 * Returns whether `value` is a Node `Buffer`. The global is looked up rather than imported so the
 * runtime still loads where there is no `Buffer`, and then nothing is one.
 */
function isNodeBuffer(value: unknown): boolean {
  const buffer = (globalThis as unknown as { Buffer?: { isBuffer?: (candidate: unknown) => boolean } })
    .Buffer;
  return typeof buffer?.isBuffer === 'function' && buffer.isBuffer(value);
}

/**
 * Returns the ISO 8601 form of `date` through `Date.prototype`, so a `Date` whose own
 * `toISOString` was replaced still encodes as the instant it holds.
 */
function isoString(date: Date): string {
  return Date.prototype.toISOString.call(date);
}

/**
 * Marks `value` as being encoded under `key`, or throws when it already is further up the same path.
 *
 * Only the objects on the current path are held, and each is released once its children are done,
 * so the same object appearing twice side by side still encodes. Without this, an object that
 * contains itself (an ORM entity with a back-reference, say) would recurse until the stack overflows.
 */
function enter(ancestors: Set<object>, value: object, key: string): void {
  if (ancestors.has(value)) {
    throw new RangeError(`Cyclic object value at "${key}": a query value cannot contain itself`);
  }
  ancestors.add(value);
}

/** Returns the key path one array element is written under, before percent-encoding. */
function arrayItemPath(key: string, index: number, arrayFormat: QueryArrayFormat): string {
  if (arrayFormat === 'indices') return `${key}[${index}]`;
  if (arrayFormat === 'brackets') return `${key}[]`;
  return key;
}

/** Matches a well-formed surrogate pair first, so the second alternative only sees a lone surrogate. */
const surrogatePattern = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g;

/**
 * Percent-encodes a key path or value as UTF-8, leaving only `A-Z a-z 0-9 - . _ ~` as they are, so
 * `[`, `]`, `,`, `&`, `=`, `+` and also `! ' ( ) *` are always escaped.
 *
 * `encodeURIComponent` throws on a lone surrogate, so one is replaced with U+FFFD first, the
 * replacement character `TextEncoder` writes for it too, and a malformed string still encodes.
 */
function encodeComponent(text: string): string {
  const wellFormed = text.replace(surrogatePattern, (match) => (match.length === 2 ? match : '\uFFFD'));
  return encodeURIComponent(wellFormed).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
