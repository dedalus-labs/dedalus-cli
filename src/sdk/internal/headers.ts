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
  if (headers instanceof Headers) {
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
 * Reads one header, matching its name case-insensitively, from any headers shape a request handler
 * hands over. A repeated header yields its first value.
 */
export const getHeader = (headers: HeadersLike | HeadersProtocol, header: string): string | undefined => {
  if (!headers) return undefined;

  const lowerCasedHeader = header.toLowerCase();
  if (isHeadersProtocol(headers)) {
    // A fetch `Headers` matches any casing, but a look-alike `get` may be case-sensitive, so the common
    // spellings are tried in turn (`Webhook-Id` covers a header stored in title case).
    const intercapsHeader =
      header.charAt(0).toUpperCase() +
      header.substring(1).replace(/([^\w])(\w)/g, (_m, g1: string, g2: string) => g1 + g2.toUpperCase());
    for (const key of [header, lowerCasedHeader, header.toUpperCase(), intercapsHeader]) {
      const value = headers.get(key);
      if (value) return value;
    }
    if (headers instanceof Headers) return undefined;
  }

  for (const [name, value] of iterateHeaders(headers as HeadersLike)) {
    if (value !== null && name.toLowerCase() === lowerCasedHeader) return value;
  }
  return undefined;
};

/** Reads one header like {@link getHeader}, throwing when the headers do not carry it. */
export const getRequiredHeader = (headers: HeadersLike | HeadersProtocol, header: string): string => {
  const value = getHeader(headers, header);
  if (value === undefined) {
    throw new Error(`Could not find ${header} header`);
  }
  return value;
};
