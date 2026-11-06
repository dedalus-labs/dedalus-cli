// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { hasOwn } from './values';
import { type Dedalus } from '../../client';
import { RequestOptions } from '../request-options';

type LogFn = (message: string, ...rest: unknown[]) => void;
export type Logger = {
  error: LogFn;
  warn: LogFn;
  info: LogFn;
  debug: LogFn;
};
export type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug';

const levelNumbers = {
  off: 0,
  error: 200,
  warn: 300,
  info: 400,
  debug: 500,
};

export const parseLogLevel = (
  maybeLevel: string | undefined,
  sourceName: string,
  client: Dedalus,
): LogLevel | undefined => {
  if (!maybeLevel) {
    return undefined;
  }
  if (hasOwn(levelNumbers, maybeLevel)) {
    return maybeLevel;
  }
  loggerFor(client).warn(
    `${sourceName} was set to ${JSON.stringify(maybeLevel)}, expected one of ${JSON.stringify(
      Object.keys(levelNumbers),
    )}`,
  );
  return undefined;
};

function noop() {}

function makeLogFn(fnLevel: keyof Logger, logger: Logger | undefined, logLevel: LogLevel) {
  if (!logger || levelNumbers[fnLevel] > levelNumbers[logLevel]) {
    return noop;
  } else {
    // Don't wrap logger functions, we want the stacktrace intact!
    return logger[fnLevel].bind(logger);
  }
}

const noopLogger = {
  error: noop,
  warn: noop,
  info: noop,
  debug: noop,
};

let cachedLoggers = /* @__PURE__ */ new WeakMap<Logger, [LogLevel, Logger]>();

export function loggerFor(client: Dedalus): Logger {
  const logger = client.logger;
  const logLevel = client.logLevel ?? 'off';
  if (!logger) {
    return noopLogger;
  }

  const cachedLogger = cachedLoggers.get(logger);
  if (cachedLogger && cachedLogger[0] === logLevel) {
    return cachedLogger[1];
  }

  const levelLogger = {
    error: makeLogFn('error', logger, logLevel),
    warn: makeLogFn('warn', logger, logLevel),
    info: makeLogFn('info', logger, logLevel),
    debug: makeLogFn('debug', logger, logLevel),
  };

  cachedLoggers.set(logger, [logLevel, levelLogger]);

  return levelLogger;
}

/** Value a credential is replaced with before it reaches a log line. */
const REDACTED = '***';

/**
 * Header names whose value is replaced before a request or response is logged.
 *
 * The fixed entries are the conventional credential headers, which is all a runtime shared by every
 * SDK could know on its own. The generated ones are the headers *this* SDK's auth schemes actually
 * send: an OpenAPI `apiKey` scheme names its own header, and `X-Auth-Token` or `PRIVATE-TOKEN` is no
 * less a credential for being spelled differently. Without them a `logLevel: "debug"` run prints the
 * credential in clear text, and the generated CLI turns that level on with `--debug`, so it reaches
 * terminals and CI logs alike.
 */
const REDACTED_HEADERS: ReadonlySet<string> = new Set([
  'authorization',
  'api-key',
  'x-api-key',
  'cookie',
  'set-cookie',
]);

/**
 * Query parameters this SDK sends a credential in, from its `apiKey` schemes with `in: query`.
 *
 * A credential in the query string is worse off than one in a header: the request URL is logged at
 * `info` as well as at `debug`, so it leaks a level below the one a reader would think of as
 * verbose.
 */
const REDACTED_QUERY_PARAMS: readonly string[] = [];

/**
 * A byte's percent-encoded spelling at any depth and in either hex case, as a pattern: `%3F`,
 * `%3f`, `%253F`. Each extra round of encoding turns the `%` into `%25` and leaves the hex alone,
 * and encoders disagree on which case they write the hex in.
 */
const encodedBytePattern = (byte: number): string =>
  '%(?:25)*' +
  [...byte.toString(16).padStart(2, '0')]
    .map((digit) => (/[a-f]/u.test(digit) ? `[${digit}${digit.toUpperCase()}]` : digit))
    .join('');

/**
 * The UTF-8 bytes of one code point, worked out from `encodeURIComponent` rather than a
 * `TextEncoder`: this runs while the module loads, and a runtime without `TextEncoder` (older React
 * Native engines) must still be able to import the client. A lone surrogate, which has no UTF-8
 * spelling, yields no bytes, and `namePattern` then matches that character only as written.
 */
const utf8Bytes = (char: string): number[] => {
  const code = char.charCodeAt(0);
  if (char.length === 1 && code < 0x80) return [code];
  try {
    return encodeURIComponent(char)
      .split('%')
      .slice(1)
      .map((hex) => parseInt(hex, 16));
  } catch {
    return [];
  }
};

/**
 * A pattern matching one credential query name in every spelling a URL can carry it in: each
 * character as written or percent-encoded (its UTF-8 bytes, at any depth and in either hex case),
 * and a space also as `+`. `redactUrl` decodes a top-level name before it compares, so this keeps
 * a nested name, which nothing decodes, from slipping past with one of its bytes escaped
 * (`api%5Fkey`). Only the hex ignores case, not the name.
 */
const namePattern = (name: string): string =>
  [...name]
    .map((char) => {
      // Only syntax characters: the pattern is compiled with the `u` flag, under which escaping
      // anything else (`\-`) is a syntax error rather than a no-op.
      const escaped = char.replace(/[.*+?^${}()|[\]\\/]/gu, '\\$&');
      const encoded = utf8Bytes(char).map(encodedBytePattern).join('');
      // A lone surrogate has no bytes to encode; an empty alternative would make it optional.
      if (encoded === '') return `(?:${escaped})`;
      return `(?:${escaped}|${encoded}${char === ' ' ? '|\\+' : ''})`;
    })
    .join('');

/**
 * Matches a credential query parameter wherever text carries one, nested or not, with the name,
 * separator and `=` in group 1 and the value after it. `undefined` when this SDK places no
 * credential in the query.
 *
 * A name counts after a separator, `?`, `&` or `;`, either literal or percent-encoded any number of
 * times over (`%3F`, `%253F`): a server can echo a whole URL encoded inside another parameter's
 * value, as a login redirect's `return_to` does, and splitting the outer query on `&` never looks
 * inside it. `;` also counts because an HTML-escaped `&` reads `&amp;`. The `=` after the name can
 * be encoded the same way. The value then runs to the next literal `&`, `#` or whitespace: an
 * encoded `%26` may end a nested value, but stopping there would leak the rest of one a sloppy
 * encoder left half-encoded, and masking too much is harmless. `<`, `>` and `"` end it too, since
 * no valid URL carries them unencoded, so a `Link` header's `<url>` or a quoted URL keeps its
 * closing delimiter. `'` does not: a query value can hold it raw. No quantifier nests inside
 * another, so matching stays linear on hostile input.
 */
const QUERY_CREDENTIAL: RegExp | undefined = (() => {
  // An empty name would build a pattern that masks every `?=`.
  const names = REDACTED_QUERY_PARAMS.filter((name) => name !== '').map(namePattern);
  if (names.length === 0) return undefined;
  // `\u0026` is `&` as a JSON string escapes it, which Go's `encoding/json` does by default, so a
  // URL quoted in JSON text (a header value, a non-JSON error body quoting one) carries its
  // separators that way.
  const separator = `(?:[?&;]|\\\\u0026|${[0x3f, 0x26, 0x3b].map(encodedBytePattern).join('|')})`;
  const equals = `(?:=|${encodedBytePattern(0x3d)})`;
  return new RegExp(`(${separator}(?:${names.join('|')})${equals})[^&#\\s<>"]*`, 'gu');
})();

/** Masks the value of every credential query parameter in `text`, nested and encoded ones included. */
const redactQueryCredentials = (text: string): string =>
  QUERY_CREDENTIAL === undefined ? text : text.replace(QUERY_CREDENTIAL, `$1${REDACTED}`);

/**
 * Blanks the userinfo of a URL, which is a credential wherever it appears.
 *
 * A `--base-url` carries whatever the caller typed, and this repo already treats userinfo as secret
 * where it handles a base URL elsewhere (`profileKey` blanks it before a URL becomes a keychain
 * account). Both halves go rather than the password alone: a token is as often the username
 * (`https://<token>@host`) as the password, so keeping either back still prints one shape in full.
 */
const redactUserinfo = (url: string): string => {
  const scheme = url.indexOf('://');
  if (scheme === -1) return url;
  const start = scheme + 3;
  // The authority ends at the first of these; an `@` past one of them belongs to a path or a query.
  let end = url.length;
  for (const delimiter of ['/', '?', '#']) {
    const at = url.indexOf(delimiter, start);
    if (at !== -1 && at < end) end = at;
  }
  const at = url.lastIndexOf('@', end);
  return at === -1 || at < start ? url : url.slice(0, start) + REDACTED + url.slice(at);
};

/**
 * Decodes one `application/x-www-form-urlencoded` parameter name, for comparison against the list.
 *
 * A name reaches the URL percent-encoded, so `api%5Fkey` has to match `api_key`. A malformed escape
 * comes back as written rather than throwing: a log line is no place to fail over one, and a name
 * that cannot be decoded cannot match the list anyway.
 */
const decodeQueryName = (name: string): string => {
  try {
    return decodeURIComponent(name.replace(/\+/gu, ' '));
  } catch {
    return name;
  }
};

/**
 * Replaces the value of every credential-bearing query parameter in a URL about to be logged.
 *
 * Rewritten on the query substring rather than through `new URL`, so a relative URL is handled the
 * same way an absolute one is and no parse can throw on the logging path.
 */
export const redactUrl = (url: string): string => {
  const url_ = redactUserinfo(url);
  if (REDACTED_QUERY_PARAMS.length === 0) return url_;
  const mark = url_.indexOf('?');
  // A path can nest an encoded URL too (`/proxy/https%3A%2F%2Fh%2Fv1%3Fapi_key%3D…`), and so can a
  // fragment, so the text outside the query is scanned for a nested credential as well.
  if (mark === -1) return redactQueryCredentials(url_);
  // A fragment is not part of the query, so splitting it off keeps it out of the rewrite.
  const fragment = url_.indexOf('#', mark);
  const end = fragment === -1 ? url_.length : fragment;
  // Each pair is rewritten where it stands rather than round-tripped through `URLSearchParams`,
  // whose serializer re-spells every *other* parameter in its own safe set -- a space comes back as
  // `+`, a `~` as `%7E` -- and a logged URL that is not the one the request used is a URL nobody can
  // paste back. Splitting and rejoining on `&` is lossless, so a URL carrying no credential comes
  // out of this exactly as it went in.
  const query = url_
    .slice(mark + 1, end)
    .split('&')
    .map((pair) => {
      const equals = pair.indexOf('=');
      // A parameter with no `=` carries no value of its own, but it can still be a whole encoded URL
      // (`?%2Fv1%3Fapi_key%3D…`), so it is scanned for a nested credential like any other value.
      if (equals === -1) return redactQueryCredentials(pair);
      const name = pair.slice(0, equals);
      // Any other value still goes through `redactQueryCredentials`: it can nest a whole encoded URL
      // that carries a credential, as a redirect target echoing the request in `return_to` does.
      return REDACTED_QUERY_PARAMS.includes(decodeQueryName(name))
        ? name + '=' + REDACTED
        : redactQueryCredentials(pair);
    })
    .join('&');
  return redactQueryCredentials(url_.slice(0, mark)) + '?' + query + redactQueryCredentials(url_.slice(end));
};

/**
 * Replaces credential values in a caller-supplied query object.
 *
 * The client merges its own auth query into the URL, but a caller may pass the same parameter here
 * and `buildURL` lets that value win — so it is as live a credential as the one in the URL.
 */
const redactQuery = (query: object): object => {
  const redacted: Record<string, unknown> = { ...(query as Record<string, unknown>) };
  for (const [name, value] of Object.entries(redacted)) {
    // Every other string value is cleaned as text: an operation parameter such as `return_to` can
    // hold a URL that carries the credential, and the URL logged beside this masks it there.
    if (typeof value === 'string') redacted[name] = redactText(value);
    else if (Array.isArray(value)) {
      redacted[name] = value.map((item: unknown) => (typeof item === 'string' ? redactText(item) : item));
    }
  }
  for (const name of REDACTED_QUERY_PARAMS) {
    if (hasOwn(redacted, name)) redacted[name] = REDACTED;
  }
  return redacted;
};

/**
 * Replaces the value of every credential-bearing header, for a `Headers` or a plain record alike.
 *
 * Every other value is cleaned as free text: a response can echo the request URL back, in a
 * `Location` or a `Link`, either as written or nested and encoded in a `return_to`, and a header's
 * name says nothing about whether its value quotes a credential.
 */
export const redactHeaders = (headers: Headers | Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    (headers instanceof Headers ? [...headers] : Object.entries(headers)).map(([name, value]) => [
      name,
      REDACTED_HEADERS.has(name.toLowerCase()) ? REDACTED : redactText(value),
    ]),
  );

/**
 * URL-shaped runs inside free text, for their userinfo. Whitespace, quotes, `<` and `>` end one, so
 * two quoted URLs side by side stay two matches, each with its own userinfo masked, and an `@`
 * further on in the text is not taken for one.
 */
const URL_IN_TEXT = /\bhttps?:\/\/[^\s"'<>]+/gu;

/**
 * Text that cannot hold a URL credential: no query separator (literal, encoded or JSON-escaped), no
 * `%` escape, no scheme.
 */
const NO_URL_CREDENTIAL = /^[^?&;%:\\]*$/u;

/**
 * Redacts free text that may quote a URL anywhere in it: the userinfo of every absolute URL, then
 * every credential query parameter anywhere in the text, which covers an absolute URL's own query,
 * a relative URL (a `Location` of `/login?api_key=…`) and one nested, encoded, inside another
 * parameter's value alike.
 *
 * Runs for every SDK, not only those with a query credential: Node's `fetch` rejects a URL carrying
 * userinfo with a message that quotes the whole URL back (`Request cannot be constructed from a URL
 * that includes credentials: …`), and that message is logged on the connection-failure path. Gating
 * this on the query list left the password in the log for every SDK whose document happens not to
 * put a credential in the query.
 *
 * Only the userinfo and the credential values are rewritten, never the whole string: a message is
 * not a query string, and handing one to `URLSearchParams` wholesale would swallow everything after
 * the first parameter and take the diagnostic with it. The query scan runs over the whole text in one
 * pass rather than URL by URL, because where a URL ends in prose is a guess and a credential value
 * can hold a raw `'` or end in punctuation: a masked value runs to the next whitespace, `&`, `#`,
 * `<`, `>` or `"`, so punctuation right after it (`(https://h/v1?api_key=***): error`) goes with it.
 * Text with none of the characters a credential needs is returned as is, since header values pass
 * through here on every request whether or not anything logs them.
 */
const redactText = (text: string): string =>
  NO_URL_CREDENTIAL.test(text) ? text : redactQueryCredentials(text.replace(URL_IN_TEXT, redactUserinfo));

/**
 * What a log line says about a request or response body: its kind and size, never its content.
 *
 * A body is the data an API exists to move — a token endpoint's answer, a customer's records — and
 * no list of field names can tell which parts of it are secret, while a debug log ends up in CI
 * output and support tickets. The response's `content-type` is logged with its headers beside this.
 */
const describeBody = (body: unknown): string => {
  if (body === null) return '[empty body]';
  if (typeof body === 'string') return `[text body: ${body.length} characters]`;
  if (body instanceof ArrayBuffer) return `[binary body: ${body.byteLength} bytes]`;
  if (ArrayBuffer.isView(body)) return `[binary body: ${body.byteLength} bytes]`;
  const BlobClass = (globalThis as { Blob?: new () => { size: number; type: string } }).Blob;
  if (BlobClass && body instanceof BlobClass) {
    return `[binary body: ${body.size} bytes${body.type ? `, ${body.type}` : ''}]`;
  }
  if (typeof body === 'object') {
    // Plain data first: a parsed JSON body is a plain object or array, and its own `constructor` key
    // is server text, so the class name is read only off an object that is neither.
    const proto = Object.getPrototypeOf(body);
    if (!Array.isArray(body) && proto !== Object.prototype && proto !== null) {
      const name = proto.constructor?.name;
      return typeof name === 'string' && name ? `[${name} body]` : '[object body]';
    }
    // Its shape rather than its serialized length: this runs on every parsed response whether or
    // not debug logging is on, and serializing a large body just to measure it would cost each call.
    if (Array.isArray(body)) return `[JSON body: array of ${body.length} items]`;
    return `[JSON body: object with ${Object.keys(body).length} keys]`;
  }
  return `[${typeof body} body]`;
};

export const formatRequestDetails = (details: {
  options?: RequestOptions | undefined;
  headers?: Headers | Record<string, string> | undefined;
  retryOfRequestLogID?: string | undefined;
  retryOf?: string | undefined;
  url?: string | undefined;
  status?: number | undefined;
  method?: string | undefined;
  durationMs?: number | undefined;
  message?: unknown;
  body?: unknown;
}) => {
  if (details.options) {
    // Swept through a record view rather than field by field: not every field below is declared on
    // `RequestOptions` in every profile (`serverURL` belongs to the Speakeasy compatibility one),
    // and the copy is what keeps the caller's own options object untouched.
    const options: Record<string, unknown> = { ...details.options };
    delete options['headers']; // redundant + leaks internals
    // The Speakeasy profile re-adds a header bag under `fetchOptions`, and the client reads it as
    // the request's headers whenever the flattened one is absent -- so it holds the credential a
    // migrated call site passes. Dropped for the same reason as the field above rather than
    // redacted, because `HeadersLike` also takes shapes (an array of pairs, `null`) that the header
    // redaction does not, and the sent headers are already reported beside this, redacted.
    const fetchOptions = options['fetchOptions'];
    if (fetchOptions && typeof fetchOptions === 'object') {
      const copy: Record<string, unknown> = { ...(fetchOptions as Record<string, unknown>) };
      delete copy['headers'];
      options['fetchOptions'] = copy;
    }
    const query = options['query'];
    if (query && typeof query === 'object') options['query'] = redactQuery(query);
    if (options['body'] !== undefined) options['body'] = describeBody(options['body']);
    // These three are URL strings, not route fragments: `buildURL` takes an absolute `path` whole --
    // userinfo, query string and all -- while `defaultBaseURL` and the Speakeasy profile's
    // `serverURL` each replace the base URL outright. The caller-supplied escape hatches therefore
    // carry a credential exactly as readily as the resolved URL beside them does. `serverURL` may
    // be a `URL`, whose `username` and `password` print as fields of their own, so the redacted
    // string goes back rather than the object.
    for (const field of ['path', 'defaultBaseURL', 'serverURL']) {
      const value = options[field];
      if (typeof value === 'string') options[field] = redactUrl(value);
      else if (value instanceof URL) options[field] = redactUrl(value.toString());
    }
    details.options = options as RequestOptions;
  }
  if (details.body !== undefined) {
    details.body = describeBody(details.body);
  }
  if (details.url) {
    details.url = redactUrl(details.url);
  }
  if (details.headers) {
    details.headers = redactHeaders(details.headers);
  }
  // The message is whatever the fetch implementation threw, and Deno's connection errors quote the
  // request URL inside their text (see the note at the `connection failed` call sites), so a query
  // credential rides along in a field none of the checks above look at.
  if (typeof details.message === 'string') {
    details.message = redactText(details.message);
  }
  if ('retryOfRequestLogID' in details) {
    if (details.retryOfRequestLogID) {
      details.retryOf = details.retryOfRequestLogID;
    }
    delete details.retryOfRequestLogID;
  }
  return details;
};
