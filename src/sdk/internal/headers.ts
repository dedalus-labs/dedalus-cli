// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { isReadonlyArray } from './utils/values';

type HeaderValue = string | undefined | null;
export type HeadersLike =
  | Headers
  | readonly HeaderValue[][]
  | Record<string, HeaderValue | readonly HeaderValue[]>
  | undefined
  | null
  | NullableHeaders;

const brand_privateNullableHeaders = /* @__PURE__ */ Symbol('brand.privateNullableHeaders');

/**
 * @internal
 * Users can pass explicit nulls to unset default headers. When we parse them
 * into a standard headers type we need to preserve that information.
 */
export type NullableHeaders = {
  /** Brand check, prevent users from creating a NullableHeaders. */
  [brand_privateNullableHeaders]: true;
  /** Parsed headers. */
  values: Headers;
  /** Set of lowercase header names explicitly set to null. */
  nulls: Set<string>;
};

/**
 * Whether `value` is a fetch `Headers`. Checked through `typeof` first, so a runtime without the global
 * (a verifier imported on its own into an older Node, say) reads the value as some other shape instead
 * of throwing a `ReferenceError`.
 */
const isFetchHeaders = (value: unknown): value is Headers =>
  typeof Headers !== 'undefined' && value instanceof Headers;

function* iterateHeaders(headers: HeadersLike): IterableIterator<readonly [string, string | null]> {
  if (!headers) return;

  if (brand_privateNullableHeaders in headers) {
    const { values, nulls } = headers;
    yield* values.entries();
    for (const name of nulls) {
      yield [name, null];
    }
    return;
  }

  let shouldClear = false;
  let iter: Iterable<readonly (HeaderValue | readonly HeaderValue[])[]>;
  if (isFetchHeaders(headers)) {
    iter = headers.entries();
  } else if (isReadonlyArray(headers)) {
    iter = headers;
  } else {
    shouldClear = true;
    iter = Object.entries(headers ?? {});
  }
  for (let row of iter) {
    const name = row[0];
    if (typeof name !== 'string') throw new TypeError('expected header name to be a string');
    const values = isReadonlyArray(row[1]) ? row[1] : [row[1]];
    let didClear = false;
    for (const value of values) {
      if (value === undefined) continue;

      // Objects keys always overwrite older headers, they never append.
      // Yield a null to clear the header before adding the new values.
      if (shouldClear && !didClear) {
        didClear = true;
        yield [name, null];
      }
      yield [name, value];
    }
  }
}

export const buildHeaders = (newHeaders: HeadersLike[]): NullableHeaders => {
  const targetHeaders = new Headers();
  const nullHeaders = new Set<string>();
  for (const headers of newHeaders) {
    const seenHeaders = new Set<string>();
    for (const [name, value] of iterateHeaders(headers)) {
      const lowerName = name.toLowerCase();
      if (!seenHeaders.has(lowerName)) {
        targetHeaders.delete(name);
        seenHeaders.add(lowerName);
      }
      if (value === null) {
        targetHeaders.delete(name);
        nullHeaders.add(lowerName);
      } else {
        targetHeaders.append(name, value);
        nullHeaders.delete(lowerName);
      }
    }
  }
  return { [brand_privateNullableHeaders]: true, values: targetHeaders, nulls: nullHeaders };
};

export const isEmptyHeaders = (headers: HeadersLike) => {
  for (const _ of iterateHeaders(headers)) return false;
  return true;
};

/** A headers object read through a `get` method, like the fetch API's `Headers`. */
export interface HeadersProtocol {
  get: (header: string) => string | null | undefined;
}

export const isHeadersProtocol = (headers: unknown): headers is HeadersProtocol =>
  typeof (headers as { get?: unknown } | null | undefined)?.get === 'function';

/**
 * Lowercases ASCII letters only. HTTP header names are ASCII, and `toLowerCase` also folds characters
 * such as the Kelvin sign (U+212A) to `k`, which would let a header no client sends match one it does.
 */
const asciiLowerCase = (name: string): string => name.replace(/[A-Z]/g, (letter) => letter.toLowerCase());

/**
 * Reads every value of one header, matching its name case-insensitively, from any headers shape a
 * request handler hands over: each entry of an array value, and the value of every name that differs
 * only in case, in order. A fetch `Headers`, or any object read through `get`, has already folded
 * repeated lines into one comma-joined value, so it yields at most one.
 *
 * This is the one lookup the webhook verifier and its companions read headers through, so a delivery is
 * read the same way whichever method receives it. A value that is not a non-empty string is skipped
 * rather than coerced, since a JavaScript caller may hand over anything.
 */
export const getHeaderValues = (headers: HeadersLike | HeadersProtocol, header: string): string[] => {
  if (!headers) return [];

  const lowerCasedHeader = asciiLowerCase(header);
  if (isHeadersProtocol(headers)) {
    // A fetch `Headers` matches any casing, but a look-alike `get` may be case-sensitive, so the common
    // spellings are tried in turn (`Webhook-Id` covers a header stored in title case).
    const intercapsHeader =
      header.charAt(0).toUpperCase() +
      header.substring(1).replace(/([^\w])(\w)/g, (_m, g1: string, g2: string) => g1 + g2.toUpperCase());
    for (const key of [header, lowerCasedHeader, header.toUpperCase(), intercapsHeader]) {
      const value = headers.get(key);
      if (typeof value === 'string' && value) return [value];
    }
    if (isFetchHeaders(headers)) return [];
  }

  const values: string[] = [];
  for (const [name, value] of iterateHeaders(headers as HeadersLike)) {
    if (typeof value === 'string' && value && asciiLowerCase(name) === lowerCasedHeader) values.push(value);
  }
  return values;
};

/**
 * Reads one header like {@link getHeaderValues}, yielding its first value: the first entry of an array
 * value, or the first of two names that differ only in case.
 */
export const getHeader = (headers: HeadersLike | HeadersProtocol, header: string): string | undefined =>
  getHeaderValues(headers, header)[0];

/** Reads one header like {@link getHeader}, throwing when the headers do not carry it. */
export const getRequiredHeader = (headers: HeadersLike | HeadersProtocol, header: string): string => {
  const value = getHeader(headers, header);
  if (value === undefined) {
    throw new Error(`Could not find ${header} header`);
  }
  return value;
};
