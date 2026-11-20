// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { spawn } from 'node:child_process';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { stderr as processStderr, stdin as processStdin } from 'node:process';

import {
  type CredentialStoreLocation,
  type HeldProfile,
  type StoredOAuth,
  type StoredProfile,
  clearAll,
  deleteProfile,
  profileKey,
  readProfile,
  refreshProfile,
  storeDescription,
  warn,
  writeProfile,
} from './credentials';
import { resolveOnPath, windowsPowerShell } from './keychain';
import { clip, listRow } from './list';

/** Which API an OAuth token is for. Mirrors the emitter's `CliOauthTargetDefinition`. */
export type CliOauthTargetDefinition = {
  readonly resource?: readonly string[];
  readonly audience?: string;
};

/** One way `login` can obtain a credential. Mirrors the emitter's `CliAuthMethodDefinition`. */
export type CliAuthMethodDefinition = {
  readonly name: string;
  readonly label: string;
} & (
  | { readonly kind: 'token'; readonly clientKey: string; readonly prompt: string }
  | { readonly kind: 'basic'; readonly usernameKey: string; readonly passwordKey: string }
  | (CliOauthTargetDefinition & {
      readonly kind: 'oauth';
      readonly grant: 'authorizationCode';
      readonly clientKey: string;
      readonly tokenUrl: string;
      readonly refreshUrl: string;
      readonly authorizationUrl: string;
      readonly scopes: readonly string[];
      readonly clientId: string;
      readonly redirectPort: number;
      readonly revocationUrl?: string;
      /** RFC 8414 metadata read after sign-in for its `revocation_endpoint`; see {@link metadataRevocation}. */
      readonly revocationMetadataUrl?: string;
      /** Issuer the redirect's `iss` must name (RFC 9207); absent means an `iss` is not checked. */
      readonly issuer?: string;
    })
  | (CliOauthTargetDefinition & {
      readonly kind: 'oauth';
      readonly grant: 'clientCredentials' | 'password';
      readonly clientKey: string;
      readonly tokenUrl: string;
      readonly refreshUrl: string;
      readonly scopes: readonly string[];
      readonly clientId?: string;
      readonly revocationUrl?: string;
      readonly revocationMetadataUrl?: string;
      /** Configured issuer the revocation metadata's `issuer` must match. */
      readonly issuer?: string;
    })
  | (CliOauthTargetDefinition & {
      readonly kind: 'oauth';
      readonly grant: 'deviceAuthorization';
      readonly clientKey: string;
      readonly scopes: readonly string[];
      readonly clientId?: string;
      readonly revocationUrl?: string;
    } & (
        | {
            readonly deviceAuthorizationUrl: string;
            readonly tokenUrl: string;
            readonly refreshUrl: string;
            readonly revocationMetadataUrl?: string;
            readonly issuer?: string;
          }
        | {
            /** RFC 8414 metadata the endpoints are read from at sign-in, for a flow that names none. */
            readonly metadataUrl: string;
            /** Configured issuer the metadata's `issuer` must match; absent trusts the one its URL names. */
            readonly issuer?: string;
          }
      ))
  | (CliOauthTargetDefinition & {
      readonly kind: 'oauth';
      readonly grant: 'openIdConnect';
      readonly clientKey: string;
      readonly discoveryUrl: string;
      readonly scopes: readonly string[];
      readonly clientId: string;
      readonly redirectPort: number;
      readonly revocationUrl?: string;
      /** Configured issuer the discovered one must match; absent trusts the one discovery verifies. */
      readonly issuer?: string;
    })
);

/** Everything `login` and `logout` need. Mirrors the emitter's `CliAuthDefinition`. */
export type CliAuthDefinition = {
  readonly loginPath: readonly string[];
  readonly logoutPath: readonly string[];
  readonly loginCommand: string;
  readonly storeName: string;
  readonly storeEnv: string;
  readonly baseUrlEnv: string;
  readonly backend: 'auto' | 'keychain' | 'file';
  readonly defaultBaseUrl: string;
  /** Named environments and the URL each sends requests to; absent when there is no `--environment`. */
  readonly environments?: readonly { readonly name: string; readonly url: string }[];
  readonly requirements: readonly (readonly string[])[];
  readonly envByKey: Readonly<Record<string, string>>;
  readonly methods: readonly CliAuthMethodDefinition[];
  /** Publisher logo for the browser sign-in page; absent means the page shows none. */
  readonly logo?: string;
};

/** How long the browser flow waits for the redirect before giving the terminal back. */
const BROWSER_FLOW_TIMEOUT_MS = 300000;

/**
 * How long the browser flow waits for its answered pages to finish sending before closing the
 * listener. Loopback delivers a page in milliseconds; this only bounds a browser that stops reading.
 */
const RESPONSE_FLUSH_TIMEOUT_MS = 2000;

/** The one path the loopback listener answers as a redirect; it is what `redirect_uri` registers. */
const REDIRECT_PATH = '/callback';

/**
 * Ceiling on how long the device grant polls, whatever `expires_in` claims.
 *
 * RFC 8628 leaves the lifetime to the server, and the server is named by the OpenAPI document. This
 * is the same bound the browser grant has, so neither interactive sign-in can be made to wait
 * indefinitely by an endpoint that answers `authorization_pending` and a very large expiry.
 */
const DEVICE_FLOW_TIMEOUT_MS = 300000;

/**
 * How long a token request may take, and how much of its answer is read.
 *
 * Both bounds exist because the endpoint comes from the OpenAPI document. `fetch` has no default
 * timeout, and a refresh runs before every command that has no flag or environment credential, so an
 * endpoint that accepts the connection and never answers would hang the whole CLI with nothing on
 * screen. The size cap keeps an endless body from being buffered into memory for a response whose
 * useful part is a few hundred bytes.
 */
const TOKEN_REQUEST_TIMEOUT_MS = 30000;
const TOKEN_RESPONSE_LIMIT = 65536;

/**
 * Deadline for each token revocation `logout` sends, and for the metadata read `login` makes only to
 * learn where those go.
 *
 * Short because the sign-out has already happened by then — the local copy is gone — so the user is
 * waiting only on a courtesy to the provider, and an endpoint that never answers must not hold the
 * terminal for the full token-request deadline, once per token. The sign-in read is optional in the
 * same way: its grant has succeeded, and the token is not saved until the read returns.
 */
const REVOCATION_TIMEOUT_MS = 5000;

/** Refresh this far ahead of expiry so a token cannot lapse between the check and the request. */
const REFRESH_LEEWAY_MS = 60000;

/**
 * Deadline for the refresh that runs ahead of an ordinary command, rather than the full one above.
 *
 * That refresh is not what the user asked for — it is preparation for a request they are waiting on
 * — and its failure is swallowed, so the whole of its cost is delay they cannot see a reason for. An
 * unreachable refresh endpoint would otherwise add `TOKEN_REQUEST_TIMEOUT_MS` to *every* invocation
 * for the life of the stored entry. Giving up sooner costs a refresh that a slow provider might
 * still have answered; the command then goes out with the credential it already had, and a 401 says
 * to sign in again. An interactive `login` keeps the full deadline, because there the exchange is
 * the thing the user is waiting for.
 */
const SILENT_REFRESH_TIMEOUT_MS = 5000;

/**
 * How far past its `exp` an ID token is still accepted, to absorb clock drift between this machine
 * and the provider.
 *
 * OpenID Connect Core leaves the allowance to the client. Five minutes is the customary figure: a
 * token the provider minted seconds ago is not refused because a laptop's clock runs slow, and a
 * token that genuinely expired is still refused long before it could be useful to a replay.
 */
const ID_TOKEN_CLOCK_SKEW_MS = 300000;

/** Lifetime assumed for a token whose endpoint did not state one. See {@link oauthMetadata}. */
const ASSUMED_TOKEN_LIFETIME_S = 3600;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Shortest device-code poll interval a server can ask for.
 *
 * Low enough that a local authorization server still feels immediate, high enough that one asking
 * for zero cannot turn the wait for authorization into a request flood.
 */
const DEVICE_POLL_FLOOR_MS = 200;

/** The grant type RFC 8628 registers, sent on each poll and looked for in server metadata. */
const DEVICE_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

const storeLocation = (auth: CliAuthDefinition): CredentialStoreLocation => ({
  storeName: auth.storeName,
  storeEnv: auth.storeEnv,
  backend: auth.backend,
});

/** The client option keys a method fills, which for HTTP Basic is the username and password pair. */
const methodKeys = (method: CliAuthMethodDefinition): readonly string[] =>
  method.kind === 'basic' ? [method.usernameKey, method.passwordKey] : [method.clientKey];

/**
 * Names what a request still needs when this sign-in cannot satisfy any alternative by itself.
 *
 * An OpenAPI `security` list is OR-of-ANDs, so an alternative can require two schemes at once — an
 * API key *and* a bearer token. `login` captures one credential per run, which leaves that document
 * signed in only halfway, and saying nothing would send the user off to collect a 401 whose hint
 * tells them to run the command they have just run.
 *
 * Read back from the store rather than from what was captured, so a credential an earlier `login`
 * already left behind counts towards the requirement instead of being asked for a second time.
 *
 * The alternative closest to complete is the one named: it is the cheapest way out for the user,
 * and listing every unmet alternative would describe choices the API treats as interchangeable.
 *
 * `loginCommand` names the environment this `login` selected, when it selected one. The credential
 * just saved is filed under that environment's URL, so a hint naming the bare command would file
 * the next one under the default environment instead, and the pair would never meet. A sign-in made
 * with `--base-url` selects no environment and gets the bare command, as the request hints do.
 */
const outstandingRequirement = (
  auth: CliAuthDefinition,
  location: CredentialStoreLocation,
  key: string,
  loginCommand: string,
): string | undefined => {
  if (auth.requirements.length === 0) return undefined;
  // The store *and* the environment, because that is what the request path counts. `applyStoredCredentials`
  // treats a non-blank environment variable as an explicit value and never consults the store for
  // that key, so a user who had exported one half of an AND alternative would otherwise be sent to
  // obtain a credential their very next command was going to send anyway.
  const held = new Set(Object.keys(readProfile(location, key).credentials ?? {}));
  for (const [clientKey, name] of Object.entries(auth.envByKey)) {
    if ((process.env[name] ?? '').trim()) held.add(clientKey);
  }
  if (auth.requirements.some((keys) => keys.every((candidate) => held.has(candidate)))) return undefined;
  const missing = auth.requirements
    .map((keys) => keys.filter((candidate) => !held.has(candidate)))
    .filter((keys) => keys.length > 0)
    .sort((left, right) => left.length - right.length)[0];
  if (!missing || missing.length === 0) return undefined;
  // A key with no method behind it cannot be asked for, so it is described rather than commanded.
  // Deduplicated by method, because HTTP Basic fills two keys in one sitting and would otherwise be
  // offered twice for the one sign-in that satisfies both.
  const names = new Set<string>();
  const runnable: CliAuthMethodDefinition[] = [];
  for (const candidate of missing) {
    const method = auth.methods.find((entry) => methodKeys(entry).includes(candidate));
    if (!method || names.has(method.name)) continue;
    names.add(method.name);
    runnable.push(method);
  }
  if (runnable.length === 0) return 'Requests here also need another credential this CLI cannot obtain.';
  const commands = runnable.map((method) => loginCommand + ' --flow ' + method.name);
  return (
    'Requests here also need ' +
    (runnable.length === 1 ? 'one more credential' : String(runnable.length) + ' more credentials') +
    '. Run ' +
    commands.join(', then ') +
    '.'
  );
};

/**
 * Runs an interactive sign-in and saves the result, returning the line to print.
 *
 * Every prompt is written to standard error, so the confirmation this returns is the only thing on
 * standard output and `login` stays usable in a pipeline.
 *
 * `loginCommand` is the sign-in command for the environment this one selected (the bare command
 * when none was); it names the next step when the API needs a further credential.
 */
export const runLogin = async (
  auth: CliAuthDefinition,
  baseUrl: string,
  flow: string | undefined,
  loginCommand: string,
): Promise<string> => {
  const method = await chooseMethod(auth, flow);
  const location = storeLocation(auth);
  const key = profileKey(baseUrl);
  const captured = await captureCredentials(method, baseUrl, auth.logo);
  // Where it landed is reported by the write itself rather than predicted, so under `auto` the
  // line a user reads names the store the credential actually went into. The write merges this
  // captured result inside its lock, because a browser grant can sit for minutes before it arrives.
  const backend = writeProfile(location, key, captured);
  const line =
    'Signed in to ' +
    // The base URL can be the document's own `servers[0].url` when no flag and no environment
    // variable named one, which makes it spec-derived text on its way to a terminal.
    safeText(baseUrl || 'the API') +
    '. Credentials saved to ' +
    storeDescription(location, backend) +
    '.';
  const outstanding = outstandingRequirement(auth, location, key, loginCommand);
  return outstanding ? line + '\n' + outstanding : line;
};

/**
 * Forgets stored credentials and revokes their OAuth tokens, returning the line to print.
 *
 * The local copy goes first, under the store lock, and only then is the provider asked to revoke.
 * That order is what makes an interrupted or offline `logout` safe: whatever happens on the
 * network, nothing is left on disk, and the refresh path's conditional write will not bring a
 * deleted profile back. Revocation is best effort — a failure is a warning, never a failed logout,
 * because the user asked to be signed out here and that part has already succeeded.
 */
export const runLogout = async (auth: CliAuthDefinition, baseUrl: string, all: boolean): Promise<string> => {
  const location = storeLocation(auth);
  // Only an OAuth sign-in stores anything revocable, so a CLI without one skips reading what a
  // profile held and signs out exactly as it did before revocation existed.
  const revocable = auth.methods.some((method) => method.kind === 'oauth');
  if (all) {
    const { removed, failure } = clearAll(location, revocable);
    // Every profile's revocation runs at once, so a host that never answers costs its own timeout
    // rather than one per host. Warnings are raised afterwards, in store order, so the output does
    // not depend on which server answered first.
    const outcomes = await Promise.all(
      removed.map(({ key, held }) => {
        const base = profileBase(auth, key);
        return revokeHeld(auth, base, base, held);
      }),
    );
    for (const message of outcomes.flat()) warn(message);
    if (failure) throw new Error(failure);
    return 'Signed out everywhere.';
  }
  const key = profileKey(baseUrl);
  const { outcome, held } = deleteProfile(location, key, revocable);
  // Named without any `user:password@` it carries, in the warnings and the result line alike, so
  // the two still name the host the same way.
  const shown = withoutCredentials(baseUrl);
  for (const message of await revokeHeld(auth, baseUrl, shown, held)) warn(message);
  if (outcome === 'removed') return 'Signed out of ' + safeText(shown || 'the API') + '.';
  return 'No stored credentials for ' + safeText(shown || 'the API') + '.';
};

/**
 * The base URL a profile key stands for, for `logout --all`, which knows a profile only by its key.
 *
 * A profile with no stored revocation endpoint falls back to the configured one, resolved against
 * the base URL as sign-in resolves its endpoints. The key drops a trailing slash, which moves where
 * a path-relative endpoint lands (`oauth/revoke` beside `https://api.example.com/v1/` is under
 * `/v1/`, beside the key it is not), so a base URL this run knows that files under this key is
 * used when there is one: the base-URL environment variable if it is still set, the configured
 * default, or an environment URL. The variable comes first because sign-in prefers it to the
 * default, which matters when the two differ only in a trailing slash and so share a key. Only a
 * sign-in under a `--base-url` or a variable since unset falls back to the key.
 *
 * Credentials in the base URL are dropped, as `profileKey` drops them: the result is printed in
 * warnings, and an endpoint resolved against it would carry them into a request `fetch` refuses.
 */
const profileBase = (auth: CliAuthDefinition, key: string): string => {
  if (key === 'default') return '';
  const known = [
    (auth.baseUrlEnv ? process.env[auth.baseUrlEnv] : undefined)?.trim(),
    auth.defaultBaseUrl,
    ...(auth.environments ?? []).map((environment) => environment.url),
  ];
  const base = known.find((url) => url && profileKey(url) === key);
  return base ? withoutCredentials(base) : key;
};

/** A URL with any `user:password@` removed, or the value unchanged when it does not parse. */
const withoutCredentials = (raw: string): string => {
  try {
    const url = new URL(raw);
    // Rewritten only when there is something to drop: serializing adds a trailing slash to a bare
    // origin, which would change how every warning names the host.
    if (!url.username && !url.password) return raw;
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return raw;
  }
};

/**
 * The revocation endpoint to keep for a token, or `undefined` for a local-only sign-out.
 *
 * Each candidate is resolved against `base` exactly as the token endpoint is, and the first one on
 * the same origin as the endpoint that issued the token wins. `revocationUrl` is one value for
 * every OAuth scheme in the CLI, so without that check a token from one provider would be posted
 * to another's revocation endpoint. The discovered endpoint is held to the same rule: every
 * provider that advertises one serves it beside its token endpoint, and a sign-out that stays
 * local is a smaller loss than a token sent somewhere that did not issue it.
 */
const revocationEndpoint = (
  candidates: readonly (string | undefined)[],
  tokenUrl: string | undefined,
  base: string,
): string | undefined => {
  const issuer = tokenUrl ? urlOrigin(tokenUrl, base) : undefined;
  if (!issuer) return undefined;
  for (const candidate of candidates) {
    const resolved = storedEndpoint(candidate, base);
    if (resolved && urlOrigin(resolved, '') === issuer) return resolved;
  }
  return undefined;
};

/** A URL's origin, or `undefined` when it cannot be parsed or has none (an opaque `null` origin). */
const urlOrigin = (raw: string, base: string): string | undefined => {
  try {
    const origin = new URL(raw, base || undefined).origin;
    return origin === 'null' ? undefined : origin;
  } catch {
    return undefined;
  }
};

/**
 * Revokes what one removed profile held, returning the warnings to raise.
 *
 * Each warning names the base URL, because under `logout --all` that is the only way to tell which
 * sign-in may still be live at its provider. `label` is the one the success line prints for a
 * single `logout`, so the two lines name the host the same way. `base` is what a fallback
 * endpoint resolves against: the base URL a single `logout` was given, or {@link profileBase}.
 */
const revokeHeld = async (
  auth: CliAuthDefinition,
  base: string,
  label: string,
  held: HeldProfile,
): Promise<readonly string[]> => {
  const where = 'Signed out of ' + safeText(label || 'the API') + ' locally, but ';
  if (held.unreadable) {
    // Said only where this build could have revoked something: a configured endpoint, or a
    // provider whose published metadata (OpenID Connect discovery or RFC 8414) may name one.
    // Anywhere else revocation never happens, and the keyring warning the removal already raised
    // covers what is left to say.
    const couldRevoke = auth.methods.some(
      (method) =>
        method.kind === 'oauth' &&
        (method.revocationUrl !== undefined ||
          method.grant === 'openIdConnect' ||
          'metadataUrl' in method ||
          ('revocationMetadataUrl' in method && method.revocationMetadataUrl !== undefined)),
    );
    if (!couldRevoke) return [];
    return [
      where +
        'the saved credentials could not be read back, so no OAuth token in them was revoked at the provider.',
    ];
  }
  return revokeProfile(auth, base, held.profile, where);
};

/**
 * Revokes every OAuth token one removed profile held (RFC 7009), returning the warnings to raise.
 *
 * API keys and Basic credentials have nothing to revoke, so only entries with OAuth metadata are
 * considered. The endpoint is the one stored at sign-in; a profile that stored none falls back to
 * the one this build is configured with (see {@link fallbackRevocation}). With neither, the
 * sign-out stays local, as it always was. `where` opens every warning.
 */
const revokeProfile = async (
  auth: CliAuthDefinition,
  base: string,
  profile: StoredProfile,
  where: string,
): Promise<readonly string[]> => {
  const messages: string[] = [];
  for (const [clientKey, meta] of Object.entries(profile.oauth ?? {})) {
    // Same guard as `storedCredentials`: the store is parsed without checking the shape beneath.
    if (!meta || typeof meta !== 'object') continue;
    const endpoint = meta.revocationUrl ?? fallbackRevocation(auth, clientKey, meta, base);
    if (!endpoint) continue;
    const accessToken = profile.credentials?.[clientKey];
    // Refresh token first: on most servers revoking it ends the whole grant, access tokens included,
    // so it is the one that matters if only one call gets through.
    const tokens = [
      ...(meta.refreshToken ? [{ token: meta.refreshToken, hint: 'refresh_token' as const }] : []),
      ...(accessToken ? [{ token: accessToken, hint: 'access_token' as const }] : []),
    ];
    if (tokens.length === 0) continue;
    let url: URL;
    try {
      // Checked here rather than at sign-in: this is the request that carries a token, and failing
      // a login over an endpoint only `logout` uses would cost the user the sign-in itself.
      url = requireSecureUrl(endpoint, base, 'revocation endpoint');
    } catch (error) {
      messages.push(where + 'the token was not revoked. ' + errorMessage(error));
      continue;
    }
    try {
      let refreshRevoked = false;
      for (const { token, hint } of tokens) {
        await revokeToken(url, token, hint, meta.clientId, refreshRevoked);
        if (hint === 'refresh_token') refreshRevoked = true;
      }
    } catch (error) {
      // One failure ends this profile's revocation rather than trying the next token: an endpoint
      // that has just timed out or refused is unlikely to do otherwise a second later, and each try
      // costs the user up to `REVOCATION_TIMEOUT_MS`.
      messages.push(where + safeText(url.host) + ' could not revoke the token. ' + errorMessage(error));
    }
  }
  return messages;
};

/**
 * The configured revocation endpoint for a profile that stored none, or `undefined` to stay local.
 *
 * Reached by every profile that stored none: one saved before revocation existed, one whose
 * sign-in had nothing configured — so a `revocationUrl` a later build adds still reaches it — and
 * one whose sign-in rejected the configured endpoint. That last needs no mark of its own: the
 * checks below are sign-in's rule, so the endpoint it rejected is rejected here too, and only a
 * build whose configuration was since corrected revokes it.
 *
 * The endpoint, resolved against `base`, has to pass two origin checks. One is against the
 * profile's saved refresh endpoint, the only endpoint an older profile recorded. The other is
 * sign-in's own rule against the token endpoint, so a build never revokes an old sign-in somewhere
 * it would refuse for a new one — a provider can serve refresh from another host than the one
 * that issues tokens. A profile does not record which grant produced it, and every grant of one
 * scheme shares its key, so the token endpoint of each of those grants has to pass. An OpenID
 * Connect grant, or a device grant reading RFC 8414 metadata, learns its token endpoint at sign-in
 * and saved that same URL as the refresh endpoint, so the first check covers it.
 */
const fallbackRevocation = (
  auth: CliAuthDefinition,
  clientKey: string,
  meta: StoredOAuth,
  base: string,
): string | undefined => {
  const grants = auth.methods.filter(
    (method): method is Extract<CliAuthMethodDefinition, { kind: 'oauth' }> =>
      method.kind === 'oauth' && method.clientKey === clientKey,
  );
  // One configured value covers every OAuth method, so any grant that carries it names it.
  const configured = grants.find((method) => method.revocationUrl)?.revocationUrl;
  const endpoint = revocationEndpoint([configured], meta.refreshUrl ?? meta.tokenUrl, base);
  if (!endpoint) return undefined;
  // OpenID Connect and device sign-in from metadata learn their token endpoint at sign-in and saved
  // it as the refresh endpoint, which the check above already covers.
  const issuedHere = grants.every(
    (method) =>
      !('tokenUrl' in method) || revocationEndpoint([configured], method.tokenUrl, base) !== undefined,
  );
  return issuedHere ? endpoint : undefined;
};

/**
 * Sends one RFC 7009 revocation request, throwing a printable reason when it did not succeed.
 *
 * Only the client id goes with the token: the CLI keeps no client secret, so a provider that
 * requires confidential-client authentication here — typical for tokens from the client-credentials
 * grant — refuses, and that surfaces as the warning rather than as anything the CLI could fix.
 */
const revokeToken = async (
  url: URL,
  token: string,
  hint: 'refresh_token' | 'access_token',
  clientId: string | undefined,
  refreshRevoked: boolean,
): Promise<void> => {
  const { response, text } = await postForToken(
    url,
    { token, token_type_hint: hint, ...(clientId ? { client_id: clientId } : {}) },
    REVOCATION_TIMEOUT_MS,
    'revocation endpoint',
  );
  // Section 2.2: a 200 is the answer for an invalid or already-revoked token too, so success says
  // nothing about the token's prior state and needs nothing checked beyond the status.
  if (response.ok) return;
  const payload = parseJson(text);
  // Section 2.2.1 lets a server that only revokes refresh tokens answer this for an access token.
  // When this call already revoked the refresh token, that ended the grant and there is nothing to
  // report. With no refresh token (a client-credentials grant never gets one) the access token is
  // the whole grant and is still live, so the refusal is a failure like any other.
  if (hint === 'access_token' && refreshRevoked && payload?.['error'] === 'unsupported_token_type') return;
  throw new Error(
    'The revocation endpoint rejected the request' + tokenErrorDetail(payload, response.status),
  );
};

/** The message of a caught value, which every throw in this module makes an `Error` with safe text. */
const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Stored credentials for one base URL, keyed by client-option name.
 *
 * An OAuth access token at or near its expiry is refreshed in place first, so a CLI left alone
 * overnight keeps working without a second `login`. A refresh that fails is swallowed: the stale
 * token still goes out, and the 401 that follows carries the runtime's own sign-in hint, which
 * says more than a refresh error would.
 *
 * Refresh exchanges may overlap, but their results merge into the current profile under the same
 * lock as interactive sign-in. A server that rotates refresh tokens can still reject one of two
 * simultaneous exchanges; that is recoverable with one `login` and never loses another flow's key.
 */
export const storedCredentials = async (
  auth: CliAuthDefinition,
  baseUrl: string,
): Promise<Readonly<Record<string, string>>> => {
  const location = storeLocation(auth);
  const key = profileKey(baseUrl);
  const profile = readProfile(location, key);
  const credentials: Record<string, string> = { ...(profile.credentials ?? {}) };
  for (const [clientKey, meta] of Object.entries(profile.oauth ?? {})) {
    // `readProfile` checks that the stored value parses and is an object, but not the shape beneath
    // it, so an entry this CLI did not write can still be `null` or a scalar. Reading `expiresAt` off
    // one would throw on the request path of *every* command — the exact failure the corrupt-store
    // handling exists to avoid, and worse than it, since a bad OAuth entry would also take out the
    // commands that need no credential at all. Skipping it falls back to `login`, as a missing
    // entry does.
    if (!meta || typeof meta !== 'object') continue;
    // Older generated CLIs stored this as `tokenUrl`; retaining that fallback makes their saved
    // credentials refreshable after an upgrade while new entries preserve a distinct refresh URL.
    const refreshUrl = meta.refreshUrl ?? meta.tokenUrl;
    if (!needsRefresh(meta) || !meta.refreshToken || !refreshUrl) continue;
    // The target API is read from this CLI's own definition for the key, not from the stored entry,
    // which never held it: it is configuration rather than something a sign-in produced, so the
    // refresh follows the CLI the user is running now. A key belongs to exactly one security scheme
    // (the emitter gives each scheme its own option name), and every OAuth method of that scheme
    // carries the scheme's one value, so the first is as good as any.
    const target = auth.methods.find((method) => method.kind === 'oauth' && method.clientKey === clientKey);
    try {
      const token = await exchangeToken(
        refreshUrl,
        baseUrl,
        {
          grant_type: 'refresh_token',
          refresh_token: meta.refreshToken,
          ...(meta.clientId ? { client_id: meta.clientId } : {}),
          ...(target?.kind === 'oauth' ? targetParams(target) : {}),
        },
        SILENT_REFRESH_TIMEOUT_MS,
      );
      credentials[clientKey] = token.accessToken;
      // Conditional, not `writeProfile`: a `logout` that landed while the exchange was in flight
      // must not be undone by the token it produced. See `refreshProfile`.
      refreshProfile(location, key, {
        credentials: { [clientKey]: token.accessToken },
        oauth: {
          [clientKey]: oauthMetadata(token, refreshUrl, meta.clientId, meta.refreshToken, meta.revocationUrl),
        },
      });
    } catch {
      // Deliberately silent; see this function's doc comment.
    }
  }
  return credentials;
};

const needsRefresh = (meta: StoredOAuth): boolean =>
  meta.expiresAt !== undefined && meta.expiresAt - Date.now() < REFRESH_LEEWAY_MS;

/**
 * Picks the sign-in method to run.
 *
 * A named flow is matched exactly; otherwise a single method runs unprompted and several are put to
 * the user. The picker needs a terminal, so a non-interactive shell is told to name a flow instead
 * of being left waiting on stdin that will never arrive.
 */
const chooseMethod = async (
  auth: CliAuthDefinition,
  flow: string | undefined,
): Promise<CliAuthMethodDefinition> => {
  const names = auth.methods.map((method) => method.name);
  if (flow !== undefined) {
    const chosen = auth.methods.find((method) => method.name === flow);
    if (!chosen)
      throw new UsageError("Unknown sign-in flow '" + flow + "'. Available: " + names.join(', ') + '.');
    return chosen;
  }
  const first = auth.methods[0];
  if (!first) throw new Error('This CLI has no sign-in flow.');
  if (auth.methods.length === 1) return first;
  const index = await promptChoice(
    'How would you like to sign in?',
    auth.methods.map((method) => ({ label: method.label, hint: method.name })),
  );
  // The picker only ever resolves an index it drew, so `first` stands in for a state that cannot
  // occur rather than an error message describing one.
  return auth.methods[index] ?? first;
};

const captureCredentials = async (
  method: CliAuthMethodDefinition,
  baseUrl: string,
  logo: string | undefined,
): Promise<StoredProfile> => {
  if (method.kind === 'token') {
    const value = await promptSecret(method.prompt);
    if (!value) throw new UsageError('No value entered; nothing was saved.');
    return { credentials: { [method.clientKey]: value } };
  }
  if (method.kind === 'basic') {
    const username = await promptLine('Username: ');
    if (!username) throw new UsageError('No username entered; nothing was saved.');
    const password = await promptSecret('Password: ');
    if (!password) throw new UsageError('No password entered; nothing was saved.');
    return { credentials: { [method.usernameKey]: username, [method.passwordKey]: password } };
  }
  const { token, clientId, refreshUrl, revocationUrl } = await runOauthFlow(method, baseUrl, logo);
  return {
    credentials: { [method.clientKey]: token.accessToken },
    oauth: { [method.clientKey]: oauthMetadata(token, refreshUrl, clientId, undefined, revocationUrl) },
  };
};

const oauthMetadata = (
  token: TokenResponse,
  refreshUrl: string,
  clientId: string | undefined,
  previousRefreshToken: string | undefined,
  revocationUrl: string | undefined,
): StoredOAuth => {
  // A refresh response may legitimately omit `refresh_token`, which means "keep using the one you
  // have" rather than "you no longer have one"; dropping it would turn every refresh into the last.
  const refreshToken = token.refreshToken ?? previousRefreshToken;
  // `expires_in` is OPTIONAL in RFC 6749 §5.1, and an absent one used to mean no `expiresAt`, which
  // `needsRefresh` reads as "never expires" — so a provider that omits it left the refresh token
  // stored and never used, and the user re-ran the whole flow on every expiry. When there is
  // something to refresh with, an unstated lifetime is assumed to be the hour nearly every provider
  // issues; refreshing earlier than necessary costs one request, never refreshing costs the feature.
  const lifetime = token.expiresIn ?? (refreshToken ? ASSUMED_TOKEN_LIFETIME_S : undefined);
  return {
    ...(refreshToken ? { refreshToken } : {}),
    ...(lifetime === undefined ? {} : { expiresAt: Date.now() + lifetime * 1000 }),
    refreshUrl,
    ...(clientId ? { clientId } : {}),
    // Carried through every refresh too, so a token renewed in place is still revoked where it was issued.
    ...(revocationUrl ? { revocationUrl } : {}),
  };
};

/** The access token an OAuth grant produced, plus what is needed to renew it. */
type TokenResponse = {
  readonly accessToken: string;
  readonly refreshToken?: string;
  /** Lifetime in seconds, as the token endpoint reported it. */
  readonly expiresIn?: number;
  /** OpenID Connect ID token, when the endpoint returned one; checked by the OIDC flow, never stored. */
  readonly idToken?: string;
};

/**
 * Runs one OAuth grant and picks the revocation endpoint to store beside its token.
 *
 * OpenID Connect picks its own, since only discovery names its token endpoint; every other grant is
 * decided here, after the grant succeeded. The configured endpoint comes first, then whatever the
 * scheme's RFC 8414 metadata advertises — read during a device sign-in that took its endpoints from
 * there, otherwise read now by {@link metadataRevocation} — and both are held to the origin of the
 * token endpoint that issued the token.
 */
const runOauthFlow = async (
  method: Extract<CliAuthMethodDefinition, { kind: 'oauth' }>,
  baseUrl: string,
  logo: string | undefined,
): Promise<OAuthFlowResult> => {
  if (method.grant === 'openIdConnect') return openIdConnectFlow(method, baseUrl, logo);
  const result = await runTokenGrant(method, baseUrl, logo);
  // A device sign-in from metadata names no token endpoint up front; the one it discovered is the
  // refresh endpoint it returned.
  const tokenUrl = 'tokenUrl' in method ? method.tokenUrl : result.refreshUrl;
  const discovered = result.revocationUrl
    ? { revocationUrl: result.revocationUrl }
    : await metadataRevocation(method, tokenUrl, baseUrl);
  return {
    ...result,
    revocationUrl: signInRevocation(method.revocationUrl, discovered, tokenUrl, baseUrl),
  };
};

/**
 * The revocation endpoint a scheme's RFC 8414 metadata advertises, read once a grant has succeeded.
 *
 * Read only when the configured endpoint does not already qualify, so a sign-in the config covers
 * costs no round trip. It passes the same issuer checks as a device sign-in from that metadata.
 * Unlike that sign-in, nothing but revocation depends on it, so a failed read never fails the
 * sign-in: it warns, since `logout` will then only forget the token locally, and the user should
 * hear so at the one point they are watching — {@link signInRevocation} says so, with the reason
 * returned here, in the one warning it raises. For the same reason it gets the revocation request's
 * short deadline rather than a token request's: the grant has already succeeded, its token is not
 * saved until this returns, and a provider that never answers must not hold that up.
 */
const metadataRevocation = async (
  method: Exclude<Extract<CliAuthMethodDefinition, { kind: 'oauth' }>, { grant: 'openIdConnect' }>,
  tokenUrl: string,
  baseUrl: string,
): Promise<{ readonly revocationUrl?: string | undefined; readonly failure?: string }> => {
  if (!('revocationMetadataUrl' in method) || !method.revocationMetadataUrl) return {};
  if (revocationEndpoint([method.revocationUrl], tokenUrl, baseUrl) !== undefined) return {};
  try {
    const { payload, issuerUrl } = await readAuthorizationServerMetadata(
      { metadataUrl: method.revocationMetadataUrl, issuer: method.issuer },
      baseUrl,
      REVOCATION_TIMEOUT_MS,
    );
    return { revocationUrl: advertisedRevocation(payload, issuerUrl) };
  } catch (error) {
    return { failure: errorMessage(error) };
  }
};

/**
 * A metadata document's `revocation_endpoint` (RFC 8414 section 2), resolved against its verified
 * issuer, or `undefined` when it names none.
 *
 * Optional, and only `logout` uses it, so a missing or odd one is left out rather than failing the
 * sign-in, and its HTTPS check waits for the revocation itself.
 */
const advertisedRevocation = (
  payload: Readonly<Record<string, unknown>>,
  issuerUrl: URL,
): string | undefined => {
  const advertised = payload['revocation_endpoint'];
  return typeof advertised === 'string' && advertised
    ? storedEndpoint(advertised, issuerUrl.toString())
    : undefined;
};

/** Runs a grant whose token endpoint the document names, returning the token and how to refresh it. */
const runTokenGrant = async (
  method: Exclude<Extract<CliAuthMethodDefinition, { kind: 'oauth' }>, { grant: 'openIdConnect' }>,
  baseUrl: string,
  logo: string | undefined,
): Promise<OAuthFlowResult> => {
  if (method.grant === 'authorizationCode') {
    const result = await authorizationCodeFlow(method, baseUrl, logo);
    return { ...result, refreshUrl: method.refreshUrl };
  }
  if (method.grant === 'deviceAuthorization') return deviceAuthorizationFlow(method, baseUrl);
  if (method.grant === 'clientCredentials') {
    const clientId = method.clientId ?? (await promptLine('Client id: '));
    if (!clientId) throw new UsageError('No client id entered; nothing was saved.');
    const clientSecret = await promptSecret('Client secret: ');
    if (!clientSecret) throw new UsageError('No client secret entered; nothing was saved.');
    const token = await exchangeToken(method.tokenUrl, baseUrl, {
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      ...scopeParam(method.scopes),
      ...targetParams(method),
    });
    return { token, clientId, refreshUrl: method.refreshUrl };
  }
  // Asked for the same way the client-credentials grant above asks, so a provider that requires a
  // client id on this grant — which a public client's does — can be signed into without the value
  // having to be baked into the generated source. It stays optional, unlike there: RFC 6749 lets a
  // client that authenticates some other way leave it out, so a blank answer omits the parameter
  // rather than sending an empty one, and the prompt says which it is.
  const clientId = method.clientId ?? (await promptLine('Client id (optional): '));
  const username = await promptLine('Username: ');
  if (!username) throw new UsageError('No username entered; nothing was saved.');
  const password = await promptSecret('Password: ');
  if (!password) throw new UsageError('No password entered; nothing was saved.');
  const token = await exchangeToken(method.tokenUrl, baseUrl, {
    grant_type: 'password',
    username,
    password,
    ...(clientId ? { client_id: clientId } : {}),
    ...scopeParam(method.scopes),
    ...targetParams(method),
  });
  // Persisted so the refresh exchange can send the same client id the grant was made with; a blank
  // answer stores nothing, which is what an absent one already did.
  return { token, clientId: clientId || undefined, refreshUrl: method.refreshUrl };
};

/** OAuth result plus the endpoints needed later to refresh and to revoke a persisted token. */
type OAuthFlowResult = {
  readonly token: TokenResponse;
  readonly clientId: string | undefined;
  readonly refreshUrl: string;
  /**
   * Absolute revocation endpoint: the one decided for the token by {@link runOauthFlow}, or, from a
   * device sign-in that read RFC 8414 metadata, the one that metadata advertised for it to decide on.
   */
  readonly revocationUrl?: string | undefined;
};

/**
 * Resolves an endpoint against the base URL it applies to, for storing beside the token.
 *
 * Deliberately not `requireSecureUrl`: nothing is sent to a revocation endpoint at sign-in, so a
 * bad one must not cost the user the sign-in. `logout` checks it before a token goes out. An
 * unparseable value yields `undefined`, so it is never stored; a configured one is reported at
 * sign-in by {@link signInRevocation}, and a discovered one is optional and simply left out.
 */
const storedEndpoint = (raw: string | undefined, base: string): string | undefined => {
  if (!raw) return undefined;
  try {
    const url = new URL(raw, base || undefined);
    // A relative endpoint inherits credentials from a `https://user:pass@host/` base. Kept, they
    // would sit in the store beside the token and make `fetch` refuse every revocation request.
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return undefined;
  }
};

/**
 * The revocation endpoint to store with a token that sign-in has just obtained.
 *
 * Runs only once the grant succeeded, because it can warn, and a failed `login` drains warnings
 * too. It warns when the configured endpoint cannot be used — unparseable, or off the token
 * endpoint's origin — and nothing else qualified either, since `logout` will then only forget
 * this sign-in locally, and the user should hear so while the configuration can still be fixed.
 *
 * It also warns when the provider's metadata could not be read for one, with nothing configured
 * or alongside the configured endpoint's own reason, so both causes reach the user in one warning:
 * each alone would point at only half of why `logout` will not revoke.
 *
 * Nothing stored means `logout` falls back to the configured endpoint under this same rule (see
 * {@link fallbackRevocation}), so a rejected endpoint stays rejected there.
 */
const signInRevocation = (
  configured: string | undefined,
  discovered: { readonly revocationUrl?: string | undefined; readonly failure?: string },
  tokenUrl: string,
  baseUrl: string,
): string | undefined => {
  const chosen = revocationEndpoint([configured, discovered.revocationUrl], tokenUrl, baseUrl);
  if (chosen !== undefined) return chosen;
  const metadataReason = discovered.failure ? ' ' + discovered.failure : '';
  if (!configured) {
    if (discovered.failure) warn('Logout will not revoke this sign-in at the provider.' + metadataReason);
    return undefined;
  }
  const revocationOrigin = urlOrigin(configured, baseUrl);
  const issuerOrigin = urlOrigin(tokenUrl, baseUrl);
  warn(
    (revocationOrigin === undefined || issuerOrigin === undefined
      ? 'The configured revocation endpoint is not a usable URL, so logout will not revoke this sign-in at the provider.'
      : 'The configured revocation endpoint ' +
        safeText(revocationOrigin) +
        " is not on the token endpoint's origin " +
        safeText(issuerOrigin) +
        ', so logout will not revoke this sign-in at the provider.') + metadataReason,
  );
  return undefined;
};

/**
 * Runs the Device Authorization Grant without needing a loopback listener or a local browser.
 *
 * The device code is never printed: it is the credential that the token endpoint accepts. The
 * user code, by contrast, is deliberately meant to be entered in a browser and is shown beside the
 * verification URL. Polling follows RFC 8628's ‘authorization_pending’ and ‘slow_down’ signals
 * instead of treating them as failed sign-ins.
 */
const deviceAuthorizationFlow = async (
  method: Extract<CliAuthMethodDefinition, { grant: 'deviceAuthorization' }>,
  baseUrl: string,
): Promise<OAuthFlowResult> => {
  // Discovered before the client id is asked for, so a provider that cannot run this grant fails
  // the sign-in before the user has been asked to type anything.
  const endpoints = 'metadataUrl' in method ? await discoverDeviceEndpoints(method, baseUrl) : method;
  const clientId = method.clientId ?? (await promptLine('Client id: '));
  if (!clientId) throw new UsageError('No client id entered; nothing was saved.');
  const device = await requestDeviceAuthorization(endpoints.deviceAuthorizationUrl, baseUrl, {
    client_id: clientId,
    ...scopeParam(method.scopes),
    ...targetParams(method),
  });
  processStderr.write(
    'To sign in, visit:\n\n  ' +
      device.verificationUrl +
      (device.userCode ? '\n\nThen enter code: ' + safeText(device.userCode) : '') +
      '\n\nWaiting for authorization...\n',
  );
  return {
    token: await pollDeviceToken(
      endpoints.tokenUrl,
      baseUrl,
      { client_id: clientId, ...targetParams(method) },
      device,
    ),
    clientId,
    refreshUrl: endpoints.refreshUrl,
    // From the metadata the endpoints came from, so revocation costs no second read of it.
    ...('revocationUrl' in endpoints && endpoints.revocationUrl
      ? { revocationUrl: endpoints.revocationUrl }
      : {}),
  };
};

/**
 * Reads the device grant's endpoints from the authorization server's RFC 8414 metadata.
 *
 * Both come back absolute, resolved against the verified issuer, so the polls and every later
 * refresh go to the provider that published them rather than to the API host.
 */
const discoverDeviceEndpoints = async (
  method: { readonly metadataUrl: string; readonly issuer?: string },
  baseUrl: string,
): Promise<{
  readonly deviceAuthorizationUrl: string;
  readonly tokenUrl: string;
  readonly refreshUrl: string;
  readonly revocationUrl?: string;
}> => {
  const label = AUTHORIZATION_SERVER_METADATA;
  const { payload, issuerUrl } = await readAuthorizationServerMetadata(method, baseUrl);
  // RFC 8414 defaults an omitted `grant_types_supported` to the code and implicit grants, but
  // providers that do run this grant routinely leave the list out, so only a list that is present
  // and leaves the grant out is taken as a refusal. The endpoint below is the signal that counts.
  const grants = payload['grant_types_supported'];
  if (Array.isArray(grants) && !grants.includes(DEVICE_CODE_GRANT)) {
    throw new Error('The ' + label + ' does not list the device authorization grant as supported.');
  }
  const deviceAuthorizationUrl = payload['device_authorization_endpoint'];
  const tokenUrl = payload['token_endpoint'];
  if (typeof deviceAuthorizationUrl !== 'string' || !deviceAuthorizationUrl) {
    throw new Error('The ' + label + ' names no device authorization endpoint.');
  }
  if (typeof tokenUrl !== 'string' || !tokenUrl)
    throw new Error('The ' + label + ' names no token endpoint.');
  const token = requireSecureUrl(tokenUrl, issuerUrl.toString(), 'token endpoint').toString();
  const revocationUrl = advertisedRevocation(payload, issuerUrl);
  return {
    deviceAuthorizationUrl: requireSecureUrl(
      deviceAuthorizationUrl,
      issuerUrl.toString(),
      'device authorization endpoint',
    ).toString(),
    tokenUrl: token,
    refreshUrl: token,
    ...(revocationUrl ? { revocationUrl } : {}),
  };
};

const AUTHORIZATION_SERVER_METADATA = 'authorization server metadata';

/**
 * Reads a scheme's RFC 8414 metadata and holds it to its issuer: the one its URL was built from
 * (section 3.3), and the configured issuer when there is one.
 *
 * Shared by device sign-in, which takes its endpoints from the document, and by revocation, which
 * takes only `revocation_endpoint`, so the two cannot disagree about which documents to trust.
 */
const readAuthorizationServerMetadata = async (
  method: { readonly metadataUrl: string; readonly issuer?: string | undefined },
  baseUrl: string,
  timeoutMs?: number,
): Promise<{ readonly payload: Record<string, unknown>; readonly issuerUrl: URL }> => {
  const label = AUTHORIZATION_SERVER_METADATA;
  const { payload, issuer, issuerUrl } = await readServerMetadata(
    method.metadataUrl,
    baseUrl,
    { document: label, issuer: 'authorization server issuer' },
    metadataIssuer,
    timeoutMs,
  );
  if (method.issuer !== undefined && !sameIssuer(issuer, method.issuer)) {
    throw new Error(
      'The ' +
        label +
        ' is issued by ' +
        safeText(issuer) +
        ', not the configured issuer ' +
        safeText(method.issuer) +
        '.',
    );
  }
  return { payload, issuerUrl };
};

/**
 * Discovers OpenID Connect endpoints, then uses the same PKCE flow as a declared authorization code
 * grant — holding the redirect's `iss` and the ID token to the issuer discovery verified.
 */
const openIdConnectFlow = async (
  method: Extract<CliAuthMethodDefinition, { grant: 'openIdConnect' }>,
  baseUrl: string,
  logo: string | undefined,
): Promise<OAuthFlowResult> => {
  const endpoints = await discoverOpenIdConnect(method.discoveryUrl, baseUrl);
  // A configured issuer is the publisher saying which provider this CLI signs in with. Discovery
  // only proves the document agrees with the URL it came from, and that URL is spec-derived, so a
  // document that points somewhere else is refused here rather than trusted for the rest of the flow.
  if (method.issuer !== undefined && !sameIssuer(endpoints.issuer, method.issuer)) {
    throw new Error(
      'The OpenID Connect discovery document is issued by ' +
        safeText(endpoints.issuer) +
        ', not the configured issuer ' +
        safeText(method.issuer) +
        '.',
    );
  }
  // Same randomness as `state`. `state` ties the redirect to this process; the nonce ties the ID
  // token to it, so a token minted for some other sign-in cannot be replayed into this one.
  const nonce = base64Url(randomBytes(16));
  const result = await authorizationCodeFlow(
    {
      ...method,
      grant: 'authorizationCode',
      authorizationUrl: endpoints.authorizationUrl,
      tokenUrl: endpoints.tokenUrl,
      refreshUrl: endpoints.tokenUrl,
      issuer: endpoints.issuer,
    },
    baseUrl,
    logo,
    {
      // Discovery always yields an issuer to compare a received `iss` with, but only a configured
      // issuer or the provider's own advertisement makes a *missing* one a failure: RFC 9207 lets a
      // server that never promised the parameter leave it out.
      issRequired: method.issuer !== undefined || endpoints.issParameterSupported,
      nonce,
      // Run inside the code flow, while the browser is still waiting on its page, so a refused ID
      // token is what the browser is told about too. It also runs before `login` writes anything:
      // a token that fails is not stored, and neither is the access token that arrived beside it.
      verify: (token) => {
        if (token.idToken !== undefined) {
          verifyIdToken(token.idToken, { issuer: endpoints.issuer, clientId: method.clientId, nonce });
        }
      },
    },
  );
  // A configured endpoint wins over the discovered one when it sits beside the token endpoint
  // discovery named; the discovered one was already resolved against the issuer.
  const revocationUrl = signInRevocation(
    method.revocationUrl,
    { revocationUrl: endpoints.revocationUrl },
    endpoints.tokenUrl,
    baseUrl,
  );
  return { ...result, refreshUrl: endpoints.tokenUrl, revocationUrl };
};

/**
 * Checks the claims of an ID token the token endpoint returned, per OpenID Connect Core 3.1.3.7.
 *
 * The signature is deliberately not verified. Section 3.1.3.7 lets TLS server validation stand in
 * for it when the token is received directly from the token endpoint — which is the only way this
 * flow receives one: `exchangeToken` refuses a plain-HTTP endpoint off loopback and follows no
 * redirects. Verifying it anyway would mean fetching and caching the provider's JWKS and
 * implementing each signing algorithm, in a runtime that ships with no dependencies. The claims are
 * what bind the token to this sign-in, and those are checked in full.
 */
const verifyIdToken = (
  idToken: string,
  expected: { readonly issuer: string; readonly clientId: string; readonly nonce: string },
): void => {
  const claims = idTokenClaims(idToken);
  const issuer = claims['iss'];
  if (typeof issuer !== 'string' || !sameIssuer(issuer, expected.issuer)) {
    throw new Error(
      'The ID token was issued by ' +
        (typeof issuer === 'string' ? safeText(issuer) || 'an empty issuer' : 'no issuer') +
        ', but this sign-in expected ' +
        safeText(expected.issuer) +
        '.',
    );
  }
  const audience = claims['aud'];
  const audiences = typeof audience === 'string' ? [audience] : Array.isArray(audience) ? audience : [];
  if (!audiences.includes(expected.clientId)) {
    throw new Error('The ID token is not addressed to this client (' + safeText(expected.clientId) + ').');
  }
  // With more than one audience, `azp` names the party the token was actually issued to; without
  // it, a token minted for another client that merely lists this one could be passed off as ours.
  // A present `azp` is held to the client id even for a single audience, as the spec recommends.
  const party = claims['azp'];
  if ((audiences.length > 1 || party !== undefined) && party !== expected.clientId) {
    throw new Error(
      party === undefined
        ? 'The ID token lists several audiences but names no authorized party (azp).'
        : 'The ID token was issued to another authorized party (azp) than this client.',
    );
  }
  const expiry = claims['exp'];
  if (typeof expiry !== 'number' || !Number.isFinite(expiry)) {
    throw new Error('The ID token has no usable expiry.');
  }
  if (expiry * 1000 + ID_TOKEN_CLOCK_SKEW_MS <= Date.now()) {
    throw new Error('The ID token has expired.');
  }
  const nonce = claims['nonce'];
  if (typeof nonce !== 'string' || !sameToken(nonce, expected.nonce)) {
    throw new Error(
      'The ID token does not carry the nonce this sign-in sent, so it may belong to another sign-in.',
    );
  }
};

/**
 * Decodes the payload of a compact-serialized JWT into its claims, refusing anything malformed.
 *
 * Strict about the alphabet because Node's base64url decoder is not: it skips characters it does
 * not recognise, so a mangled segment would otherwise decode into *something* rather than fail.
 */
const idTokenClaims = (idToken: string): Record<string, unknown> => {
  const malformed = new Error('The token endpoint returned a malformed ID token.');
  const segments = idToken.split('.');
  const payload = segments[1];
  if (segments.length !== 3 || !payload || !/^[A-Za-z0-9_-]+$/u.test(payload)) throw malformed;
  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw malformed;
  }
  if (!claims || typeof claims !== 'object' || Array.isArray(claims)) throw malformed;
  return claims as Record<string, unknown>;
};

/**
 * Fields for a grant request: a form body or an authorization URL's query.
 *
 * An array value repeats its key rather than being joined, because that is how RFC 8707 spells more
 * than one resource indicator — `resource=a&resource=b`, never `resource=a,b`.
 */
type GrantParams = Readonly<Record<string, string | readonly string[]>>;

/** The `scope` parameter, left off entirely when there is nothing to request. */
const scopeParam = (scopes: readonly string[]): Record<string, string> =>
  scopes.length > 0 ? { scope: scopes.join(' ') } : {};

/**
 * The parameters naming which API a token is for, spread into every request a grant makes.
 *
 * Every one — the authorization URL, the device authorization request, each token-endpoint call and
 * the refresh — because providers differ in where they read it: some bind it to the authorization
 * and check the token request against it, others look only at the token endpoint, and a request
 * without it can come back with a token for a different API. Kept in one place so no grant can be
 * written without it. Both are absent unless configured, which leaves an unconfigured CLI's
 * requests exactly as they were.
 */
const targetParams = (target: CliOauthTargetDefinition): GrantParams => ({
  ...(target.resource && target.resource.length > 0 ? { resource: target.resource } : {}),
  ...(target.audience ? { audience: target.audience } : {}),
});

/**
 * Writes grant fields into a query or form, one entry per value.
 *
 * Each key is cleared first, so a field replaces whatever the authorization URL already carried
 * under that name — the same outcome `searchParams.set` gives a single value — while a list still
 * repeats its key.
 */
const writeParams = (params: URLSearchParams, fields: GrantParams): URLSearchParams => {
  for (const [key, value] of Object.entries(fields)) {
    params.delete(key);
    for (const entry of typeof value === 'string' ? [value] : value) params.append(key, entry);
  }
  return params;
};

type DeviceAuthorization = {
  readonly deviceCode: string;
  readonly verificationUrl: string;
  readonly userCode?: string;
  readonly expiresAt: number;
  readonly intervalMs: number;
};

/**
 * Starts a device grant and validates the response before anything is printed to the terminal.
 *
 * `fields` is the whole request body — the client id, the scope and the target API — so the caller
 * that knows the method decides what the grant asks for.
 */
const requestDeviceAuthorization = async (
  endpoint: string,
  baseUrl: string,
  fields: GrantParams,
): Promise<DeviceAuthorization> => {
  const url = requireSecureUrl(endpoint, baseUrl, 'device authorization endpoint');
  const { response, text } = await postForToken(url, fields);
  const payload = parseJson(text);
  if (!response.ok) {
    throw new Error(
      'The device authorization endpoint rejected the request' + tokenErrorDetail(payload, response.status),
    );
  }
  const deviceCode = payload?.['device_code'];
  const verificationUri = payload?.['verification_uri_complete'] ?? payload?.['verification_uri'];
  const userCode = payload?.['user_code'];
  const expiresIn = payload?.['expires_in'];
  const interval = payload?.['interval'];
  if (
    typeof deviceCode !== 'string' ||
    !deviceCode ||
    typeof verificationUri !== 'string' ||
    !verificationUri
  ) {
    throw new Error('The device authorization endpoint returned an incomplete response.');
  }
  if (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error('The device authorization endpoint returned no usable expiry.');
  }
  const verificationUrl = requireSecureUrl(verificationUri, baseUrl, 'device verification URL').toString();
  return {
    deviceCode,
    verificationUrl,
    ...(typeof userCode === 'string' && userCode ? { userCode } : {}),
    // Capped at this CLI's own ceiling rather than taken as given. `expires_in` comes from a
    // spec-derived endpoint, so a hostile or simply wrong one answering `1e12` would make the only
    // loop guard in `pollDeviceToken` unreachable and leave `login` waiting with no way out but
    // Ctrl-C — the browser grant is bounded by `BROWSER_FLOW_TIMEOUT_MS` and this is its equal.
    expiresAt: Date.now() + Math.min(expiresIn * 1000, DEVICE_FLOW_TIMEOUT_MS),
    // RFC 8628 defaults to five seconds. A server may shorten it — a local authorization server
    // answering instantly is the case that matters — but never below `DEVICE_POLL_FLOOR_MS`, and a
    // negative or non-finite value never shortens it at all. Honouring a literal zero polled with no
    // delay for the whole of `expires_in`: a request flood against someone else's token endpoint and
    // a pinned core here, for a grant that answers `authorization_pending` until the user acts.
    intervalMs:
      typeof interval === 'number' && Number.isFinite(interval) && interval >= 0
        ? Math.max(interval * 1000, DEVICE_POLL_FLOOR_MS)
        : 5000,
  };
};

/**
 * Polls the token endpoint until the user authorizes, declines, or the device code expires.
 *
 * `fields` carries the client id and the target API, sent on every poll beside the device code.
 */
const pollDeviceToken = async (
  endpoint: string,
  baseUrl: string,
  fields: GrantParams,
  device: DeviceAuthorization,
): Promise<TokenResponse> => {
  const url = requireSecureUrl(endpoint, baseUrl, 'token endpoint');
  let intervalMs = device.intervalMs;
  while (Date.now() < device.expiresAt) {
    await waitFor(Math.min(intervalMs, Math.max(0, device.expiresAt - Date.now())));
    if (Date.now() >= device.expiresAt) break;
    const { response, text } = await postForToken(url, {
      grant_type: DEVICE_CODE_GRANT,
      device_code: device.deviceCode,
      ...fields,
    });
    const payload = parseJson(text);
    if (response.ok) return tokenResponse(payload);
    const error = payload?.['error'];
    if (error === 'authorization_pending') continue;
    if (error === 'slow_down') {
      intervalMs += 5000;
      continue;
    }
    if (error === 'expired_token') throw new Error('The device code expired before authorization completed.');
    if (error === 'access_denied') throw new Error('The device authorization request was denied.');
    throw new Error(
      'The token endpoint rejected the device code' + tokenErrorDetail(payload, response.status),
    );
  }
  throw new Error('The device code expired before authorization completed.');
};

/** Waits between device-code polls without blocking the event loop that owns terminal I/O. */
const waitFor = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/** The suffix OpenID Connect Discovery appends to an issuer to reach its configuration document. */
const OPENID_CONFIGURATION_PATH = '/.well-known/openid-configuration';

/**
 * The issuer a discovery URL was built from, per OpenID Connect Discovery section 4.
 *
 * The spec builds the URL by appending the well-known path to the issuer, so removing it again is
 * what the returned `issuer` has to match. A URL spelled any other way — a document naming a
 * configuration endpoint that is not derived from its issuer at all — yields nothing, and the
 * caller falls back to comparing origins, which still pins the answer to the host that was asked.
 */
const discoveryIssuer = (url: URL): string | undefined =>
  url.pathname.endsWith(OPENID_CONFIGURATION_PATH)
    ? url.origin + url.pathname.slice(0, -OPENID_CONFIGURATION_PATH.length)
    : undefined;

/** Compares two issuer spellings, where a trailing slash is the one difference that is not one. */
const sameIssuer = (left: string, right: string): boolean =>
  left.replace(/\/+$/u, '') === right.replace(/\/+$/u, '');

/** The well-known name RFC 8414 registers for an OAuth authorization server's metadata. */
const OAUTH_METADATA_PATH = '/.well-known/oauth-authorization-server';

/**
 * The issuer an RFC 8414 metadata URL was built from, or `undefined` when its spelling does not say.
 *
 * RFC 8414 section 3.1 *inserts* the well-known path between the host and the issuer's own path
 * (`https://as.example/.well-known/oauth-authorization-server/tenant` for the issuer
 * `https://as.example/tenant`), and section 5 uses the same insertion for an OpenID Connect
 * configuration. OpenID Connect Discovery appends instead, so that spelling is accepted as well.
 */
const metadataIssuer = (url: URL): string | undefined => {
  for (const wellKnown of [OAUTH_METADATA_PATH, OPENID_CONFIGURATION_PATH]) {
    if (url.pathname === wellKnown || url.pathname.startsWith(wellKnown + '/')) {
      return url.origin + url.pathname.slice(wellKnown.length);
    }
  }
  return discoveryIssuer(url);
};

/**
 * Fetches an authorization server's published metadata and verifies who published it.
 *
 * Both OpenID Connect Discovery (section 4.3) and RFC 8414 (section 3.3) require the document's
 * `issuer` to be the one its URL was built from. It is the check that keeps a provider from naming
 * somebody else's endpoints: without it the sign-in sends the user, and then the code or device
 * grant it obtains, wherever an untrusted document says. A URL whose spelling names no issuer is
 * held to its origin instead, which still pins the answer to the host that was asked.
 */
const readServerMetadata = async (
  metadataUrl: string,
  baseUrl: string,
  labels: { readonly document: string; readonly issuer: string },
  issuerFor: (url: URL) => string | undefined,
  timeoutMs?: number,
): Promise<{
  readonly payload: Record<string, unknown>;
  readonly issuer: string;
  readonly issuerUrl: URL;
}> => {
  const url = requireSecureUrl(metadataUrl, baseUrl, labels.document);
  const { response, text } = await getJson(url, labels.document, timeoutMs);
  const payload = parseJson(text);
  if (!response.ok) {
    throw new Error(
      'The ' + labels.document + ' could not be read' + tokenErrorDetail(payload, response.status),
    );
  }
  const issuer = payload?.['issuer'];
  if (!payload || typeof issuer !== 'string' || !issuer) {
    throw new Error('The ' + labels.document + ' named no issuer.');
  }
  const expected = issuerFor(url);
  const issuerUrl = requireSecureUrl(issuer, '', labels.issuer);
  const matches = expected === undefined ? issuerUrl.origin === url.origin : sameIssuer(issuer, expected);
  if (!matches) {
    throw new Error(
      'The ' +
        labels.document +
        ' is issued by ' +
        safeText(issuer) +
        ', which is not the provider it was fetched from.',
    );
  }
  return { payload, issuer, issuerUrl };
};

/**
 * Fetches the OpenID Provider configuration and keeps what the browser flow needs: the two
 * endpoints PKCE uses, the issuer the document was verified to come from, and whether the provider
 * promises RFC 9207's `iss` on its redirects — plus the revocation endpoint `logout` uses when
 * the provider advertises one.
 */
const discoverOpenIdConnect = async (
  discoveryUrl: string,
  baseUrl: string,
): Promise<{
  readonly authorizationUrl: string;
  readonly tokenUrl: string;
  readonly issuer: string;
  readonly issParameterSupported: boolean;
  readonly revocationUrl?: string;
}> => {
  // Held to the appended spelling alone, which is the derivation the compiler's
  // `Config/OidcIssuerMismatch` check mirrors at generation time.
  const { payload, issuer, issuerUrl } = await readServerMetadata(
    discoveryUrl,
    baseUrl,
    { document: 'OpenID Connect discovery document', issuer: 'OpenID Connect issuer' },
    discoveryIssuer,
  );
  const authorizationUrl = payload['authorization_endpoint'];
  const tokenUrl = payload['token_endpoint'];
  if (typeof authorizationUrl !== 'string' || typeof tokenUrl !== 'string') {
    throw new Error(
      'The OpenID Connect discovery document returned no usable authorization and token endpoints.',
    );
  }
  // Resolved against the issuer, never the API base URL: a relative `/authorize` belongs to the
  // provider that answered, and resolving it against the API would point the browser — and the code
  // exchange after it — at the API host instead.
  const revocationUrl = advertisedRevocation(payload, issuerUrl);
  return {
    authorizationUrl: requireSecureUrl(
      authorizationUrl,
      issuerUrl.toString(),
      'OpenID Connect authorization endpoint',
    ).toString(),
    tokenUrl: requireSecureUrl(tokenUrl, issuerUrl.toString(), 'OpenID Connect token endpoint').toString(),
    ...(revocationUrl ? { revocationUrl } : {}),
    issuer,
    issParameterSupported: payload?.['authorization_response_iss_parameter_supported'] === true,
  };
};

/**
 * The browser sign-in: PKCE authorization code against a loopback redirect (RFC 8252).
 *
 * The CLI is a public client, so it holds no secret; PKCE is what stops an intercepted code from
 * being redeemed by anything but this process. The redirect listens on 127.0.0.1 rather than a
 * public interface, and the authorization URL is printed before the browser is opened so a headless
 * or remote shell can still complete the flow by hand.
 *
 * `options.issRequired` makes an `iss`-less redirect a failure; it defaults to whether an issuer
 * is known at all, which for this grant means one was configured. `options.nonce` is sent on the
 * authorize request, and only OpenID Connect sends one, since only it returns an ID token to hold
 * the nonce to. `options.verify` checks the exchanged token and throws to refuse it.
 *
 * The browser's request for the redirect is answered only after the code exchange and `verify`,
 * so it never shows "Signed in" for a token this flow goes on to refuse. (Saving the credential
 * comes later, in `runLogin`; a store that then refuses the write is reported in the terminal.)
 * The wait is bounded by the token request's own timeout. Afterwards no redirect is held any more,
 * and the listener is closed only once every answered response has finished sending — or its
 * browser has gone — or `RESPONSE_FLUSH_TIMEOUT_MS` has passed.
 */
const authorizationCodeFlow = async (
  method: Extract<CliAuthMethodDefinition, { grant: 'authorizationCode' }>,
  baseUrl: string,
  logo: string | undefined,
  options: {
    readonly issRequired?: boolean;
    readonly nonce?: string;
    readonly verify?: (token: TokenResponse) => void;
  } = {},
): Promise<{ readonly token: TokenResponse; readonly clientId: string | undefined }> => {
  const clientId = method.clientId;
  if (!clientId || !method.authorizationUrl) throw new Error('This flow needs a configured OAuth client id.');
  const authorizeUrl = requireSecureUrl(method.authorizationUrl, baseUrl, 'authorization endpoint');
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash('sha256').update(verifier).digest());
  const state = base64Url(randomBytes(16));

  const server = createServer();
  // Bound first, and only then given its request handler. Registering the handler earlier meant a
  // bind failure (a configured `redirectPort` already in use) rejected two promises while only
  // `listen`'s was ever awaited, and the orphan took the process down with an unhandled rejection —
  // losing the friendly message and the auth exit status. Nothing can reach the port in between:
  // the browser has not been opened yet.
  // A configured port that is already taken is the one bind failure a user can act on, and Node's
  // raw `EADDRINUSE` names neither the setting that chose it nor the alternative. Port 0 lets the
  // OS pick, so it cannot reach this.
  const port = await listen(server, method.redirectPort ?? 0).catch((error: unknown) => {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (code === 'EADDRINUSE' && method.redirectPort) {
      throw new Error(
        'Port ' +
          String(method.redirectPort) +
          ' is already in use, so the sign-in redirect could not be received. Free it, or remove the configured redirect port to let the operating system choose one.',
      );
    }
    throw error;
  });
  const listener: RedirectListener = { answered: [], closing: false };
  const redirect = awaitRedirect(
    server,
    state,
    REDIRECT_PATH,
    logo,
    { expected: method.issuer, required: options.issRequired ?? method.issuer !== undefined },
    listener,
  );
  const redirectUri = 'http://127.0.0.1:' + String(port) + REDIRECT_PATH;
  try {
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('code_challenge', challenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    if (options.nonce !== undefined) authorizeUrl.searchParams.set('nonce', options.nonce);
    if (method.scopes.length > 0) authorizeUrl.searchParams.set('scope', method.scopes.join(' '));
    writeParams(authorizeUrl.searchParams, targetParams(method));
    const target = authorizeUrl.toString();
    processStderr.write(
      'Opening your browser to sign in. If it does not open, visit:\n\n  ' + target + '\n\n',
    );
    openBrowser(target);
    const { code, respond } = await withTimeout(
      redirect,
      BROWSER_FLOW_TIMEOUT_MS,
      'Timed out waiting for the browser redirect.',
    );
    // `respond` answers the held browser request once and ignores later calls, so the `finally`
    // below can answer it with a failure on any path that got here without answering it.
    try {
      let token: TokenResponse;
      try {
        token = await exchangeToken(method.tokenUrl, baseUrl, {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          code_verifier: verifier,
          ...targetParams(method),
        });
      } catch (error) {
        respond(
          'Sign-in failed',
          'Your provider did not issue a credential. Return to your terminal for details.',
          false,
        );
        throw error;
      }
      options.verify?.(token);
      respond('Signed in', 'You can close this window and return to your terminal.', true);
      return { token, clientId };
    } finally {
      respond(
        'Sign-in could not be verified',
        'The credential your provider issued did not match this sign-in. Return to your terminal for details.',
        false,
      );
    }
  } finally {
    // From here on a redirect is answered at once with the neutral page and never held, so nothing
    // that arrives during the wait below is left for nobody to answer — a redirect landing after the
    // browser wait timed out included.
    listener.closing = true;
    // Answered pages are waited for before any socket is destroyed: `closeAllConnections` cancels
    // writes still queued on a socket, and a page carrying a large publisher logo takes more than one
    // write to send, so closing straight after `end()` could leave the browser a blank or truncated
    // page. Bounded, so a browser that stops reading cannot hold the terminal.
    //
    // `server.close()` comes after the wait, not before it: since Node 19 it also closes every
    // connection with no request in progress, and a connection whose response has been ended but not
    // yet flushed counts as one — so closing first cut off exactly the pages this wait protects.
    await drainAnswered(listener.answered, RESPONSE_FLUSH_TIMEOUT_MS);
    server.close();
    // Belt and braces with the `connection: close` above: a connection opened but never used (a
    // browser preconnecting to the redirect host) is not covered by that header and would keep the
    // listener, and so the process, alive.
    server.closeAllConnections();
  }
};

/** What the browser flow shares with its loopback request handler. */
type RedirectListener = {
  /** One entry per response written, settling once it has been sent or its browser has gone. */
  readonly answered: Promise<void>[];
  /** Set when the flow is finishing: every later redirect gets the neutral page at once. */
  closing: boolean;
};

/**
 * Waits, up to `ms` in all, for every answered response — including any answered while waiting.
 *
 * Re-reads the list after each batch because the listener keeps accepting until it is closed, and a
 * response written during the wait is just as liable to be cut off as one written before it.
 */
const drainAnswered = async (answered: readonly Promise<void>[], ms: number): Promise<void> => {
  const deadline = Date.now() + ms;
  let waited = 0;
  while (waited < answered.length && Date.now() < deadline) {
    const batch = answered.slice(waited);
    waited = answered.length;
    await settledWithin(Promise.all(batch), deadline - Date.now());
  }
};

/**
 * Resolves once `promise` settles or `ms` have passed, whichever is first, and never rejects.
 *
 * The timer is cleared when the promise wins, so a finished wait leaves nothing pending that would
 * keep the process alive.
 */
const settledWithin = (promise: Promise<unknown>, ms: number): Promise<void> =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    const done = (): void => {
      clearTimeout(timer);
      resolve();
    };
    promise.then(done, done);
  });

/**
 * The style for the one page a generated CLI ever puts in front of a browser.
 *
 * Laid out after the Scalar dashboard's own sign-in confirmation: the publisher's logo centred a
 * little above the fold, then a one-line heading with its icon, then a muted line of detail — no
 * card, no accent colour. Every colour is a token on `:root` so the palette can be restyled in one
 * block.
 *
 * The font stack names Inter first and then falls back to the system UI face. Naming it is free
 * where it is already installed and costs nothing where it is not — what it must never do is
 * *fetch* it, for the same reason the rest of this page is inline.
 */
const PAGE_STYLE =
  // Values taken from the Scalar dashboard's own theme: `--scalar-background-1` and
  // `--scalar-color-1/2`, per mode.
  //
  // `light-dark()` rather than a `prefers-color-scheme` block, so each token states its light and
  // dark value together and the palette can be read as pairs. It resolves against the
  // `color-scheme` declared on the same rule, which is why that comes first.
  //
  // Where the function is not understood (before Firefox 120, Chrome 123, Safari 17.5) every token
  // is invalid at computed-value time and the properties using them fall back to their initial
  // values — black on white. Plain, still legible, and still saying the sign-in worked, which is the
  // page's whole job.
  ':root{color-scheme:light dark;' +
  '--bg:light-dark(#fff,#0f0f0f);' +
  '--fg:light-dark(#1b1b1b,#e7e7e7);' +
  '--muted:light-dark(#757575,#a4a4a4)}' +
  '*{box-sizing:border-box}' +
  // The dashboard's auth layout: content starts 15% of the way down the viewport in a 380px column.
  'body{margin:0;padding:15vh 48px 48px;background:var(--bg);color:var(--fg);' +
  // Mirrors `--scalar-font`, which also leads with Inter and falls back to the system UI face.
  'font:14px/1.5 Inter,ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}' +
  'main{max-width:380px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}' +
  // 32px tall like the dashboard's mark, but width left to the image: a publisher's logo is as
  // often a wordmark as a square icon. The 16px margin plus the 8px gap is the dashboard's 24px.
  '.logo{display:block;height:32px;max-width:100%;margin-bottom:16px;object-fit:contain}' +
  // `text-lg` at regular weight, as the dashboard sets it, with a 20px icon beside it.
  'h1{margin:0;display:flex;align-items:center;justify-content:center;gap:8px;font-size:16px;font-weight:400;line-height:24px}' +
  'h1 svg{flex:none;width:20px;height:20px}' +
  // `text-sm` in `--scalar-color-2`.
  'p{margin:0;color:var(--muted);font-size:13px;line-height:20px}';

/**
 * The page's two marks, as Phosphor's light-weight `sign-in` and `warning` glyphs on a 256 grid —
 * the icons the dashboard's own confirmation and failure screens use.
 *
 * Phosphor Icons, Copyright (c) 2020 Phosphor Icons, MIT License (https://github.com/phosphor-icons/core).
 */
const SIGNED_IN_ICON =
  'M140.24,132.24l-40,40a6,6,0,0,1-8.48-8.48L121.51,134H24a6,6,0,0,1,0-12h97.51L91.76,92.24a6,6,0,0,1,8.48-8.48l40,40A6,6,0,0,1,140.24,132.24ZM200,34H136a6,6,0,0,0,0,12h58V210H136a6,6,0,0,0,0,12h64a6,6,0,0,0,6-6V40A6,6,0,0,0,200,34Z';
const WARNING_ICON =
  'M235.07,189.09,147.61,37.22h0a22.75,22.75,0,0,0-39.22,0L20.93,189.09a21.53,21.53,0,0,0,0,21.72A22.35,22.35,0,0,0,40.55,222h174.9a22.35,22.35,0,0,0,19.6-11.19A21.53,21.53,0,0,0,235.07,189.09ZM224.66,204.8a10.46,10.46,0,0,1-9.21,5.2H40.55a10.46,10.46,0,0,1-9.21-5.2,9.51,9.51,0,0,1,0-9.72L118.79,43.21a10.75,10.75,0,0,1,18.42,0l87.46,151.87A9.51,9.51,0,0,1,224.66,204.8ZM122,144V104a6,6,0,0,1,12,0v40a6,6,0,0,1-12,0Zm16,36a10,10,0,1,1-10-10A10,10,0,0,1,138,180Z';

/**
 * Escapes a value for a double-quoted HTML attribute.
 *
 * The logo arrives through the generator's own filter, which admits only an `https` URL or an image
 * `data:` URI, but an SVG `data:` URI can legally carry quotes and angle brackets. Escaping here is
 * lossless — the parser decodes the entities back before the URL is read — so the attribute cannot
 * be closed early whatever the filter let through.
 */
const escapeAttribute = (value: string): string =>
  value.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');

/**
 * The tab icon: the publisher's logo when one is configured, otherwise the page's own mark.
 *
 * Always declared, so the browser never requests `/favicon.ico` from the loopback listener — which
 * would otherwise answer a 404 to a request it only receives because the page declared no icon.
 *
 * The fallback is deliberately a status mark and not a vendor logo: this page is served by every
 * generated CLI, so a default icon identifying the SDK's *generator* would put one company's
 * branding on another's sign-in.
 *
 * The fallback's colours are a green and a red that read against a light and a dark tab strip
 * alike; `light-dark()` is no use here because the SVG is a separate document with no
 * `color-scheme` of its own. Only `#`, `<` and `>` are escaped, which is all a data URI in an
 * attribute needs, and the SVG quotes its attributes with apostrophes so the `href` can keep the
 * double quotes.
 */
const favicon = (icon: string, ok: boolean, logo: string | undefined): string => {
  if (logo) return '<link rel="icon" href="' + escapeAttribute(logo) + '">';
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256' fill='" +
    (ok ? '#00b648' : '#dc1b19') +
    "'><path d='" +
    icon +
    "'/></svg>";
  return (
    '<link rel="icon" href="data:image/svg+xml,' +
    svg.replace(/#/gu, '%23').replace(/</gu, '%3C').replace(/>/gu, '%3E') +
    '">'
  );
};

/**
 * Renders the redirect page.
 *
 * Inlined down to the icon, with nothing fetched but a configured logo: the listener answers on
 * loopback, where the machine may well have no route out at all, and a callback page that reached
 * for a stylesheet or a font would also tell whoever served it that a sign-in had just happened.
 * The logo is the one exception, because it is the publisher's own and the publisher's provider has
 * just seen the sign-in anyway. It is sent with no referrer, so the host serving it never sees the
 * loopback URL, and a `data:` URI keeps even that request from happening. A logo that fails to
 * load has an empty `alt`, so it leaves nothing on the page rather than a broken-image box.
 *
 * Nothing the authorization server sent is interpolated here. The provider's own `error` goes to
 * the terminal through `safeText` instead, which keeps untrusted text out of markup entirely rather
 * than relying on this function to escape it.
 */
const redirectPage = (heading: string, detail: string, ok: boolean, logo: string | undefined): string => {
  const icon = ok ? SIGNED_IN_ICON : WARNING_ICON;
  return (
    '<!doctype html><html lang="en"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="referrer" content="no-referrer">' +
    favicon(icon, ok, logo) +
    '<title>' +
    heading +
    '</title><style>' +
    PAGE_STYLE +
    '</style><main>' +
    (logo ? '<img class="logo" src="' + escapeAttribute(logo) + '" alt="">' : '') +
    '<h1><svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="' +
    icon +
    '"/></svg>' +
    heading +
    '</h1><p>' +
    detail +
    '</p></main>'
  );
};

/** The code a redirect carried, and the one-shot answer to the browser request still waiting on it. */
type HeldRedirect = {
  readonly code: string;
  readonly respond: (heading: string, detail: string, ok: boolean) => void;
};

/**
 * Resolves with the authorization code the redirect carries, holding the browser's request open.
 *
 * A redirect that fails a check here is answered at once. One that passes is left waiting, and the
 * caller answers it through `respond` once the rest of the sign-in has succeeded or failed.
 *
 * Anything that is not the redirect — a browser probing `/favicon.ico`, a stray request to the
 * port — is answered 404 and ignored, so it cannot resolve or reject the wait. The `state` is
 * compared in constant time and rejected on mismatch, which is what ties the redirect back to the
 * request this process started; the `iss` is then held to `issuer` (see {@link redirectIssuerProblem}).
 */
const awaitRedirect = (
  server: ReturnType<typeof createServer>,
  state: string,
  path: string,
  logo: string | undefined,
  issuer: RedirectIssuer,
  listener: RedirectListener,
): Promise<HeldRedirect> =>
  new Promise<HeldRedirect>((resolve, reject) => {
    // Set once a redirect has resolved or rejected this wait. A later redirect — the user reloading
    // the tab while the first is still held — can change nothing, but it still deserves an answer:
    // left unanswered it would hang until the listener closed and then show an empty-response error.
    let settled = false;
    server.on('request', (request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const params = url.searchParams;
      // Listened for as soon as the request arrives, not when it is answered: a held redirect whose
      // browser gives up while the code is exchanged (a reload, a closed tab) has already fired its
      // `'close'` by the time it is answered, and a listener added then would never hear it —
      // leaving the flow to wait out `RESPONSE_FLUSH_TIMEOUT_MS` for a page nobody will read.
      const closed = new Promise<void>((done) => response.once('close', () => done()));
      const send = (status: number, type: string, body: string): void => {
        // `connection: close` rather than the default keep-alive: `server.close()` waits for open
        // connections, and a browser holding one would leave the CLI running after it had signed in.
        response.writeHead(status, { 'content-type': type + '; charset=utf-8', connection: 'close' });
        listener.answered.push(closed);
        response.end(body);
      };
      const finish = (status: number, heading: string, detail: string, ok: boolean): void => {
        send(status, 'text/html', redirectPage(heading, detail, ok, logo));
      };
      // The path is part of what was registered as `redirect_uri`, so anything else is not the
      // redirect however it is decorated. Checked alongside the parameters rather than instead of
      // them: both are cheap, and together they keep this handler from reading a request that was
      // never the provider's as though it were.
      if (url.pathname !== path || (!params.has('code') && !params.has('error'))) {
        // Plain text, and deliberately not the page above: this answers a probe rather than a
        // person — a browser asking for `/favicon.ico`, or anything else that finds the port.
        send(404, 'text/plain', 'Not found.\n');
        return;
      }
      if (settled || listener.closing) {
        finish(
          409,
          'Return to your terminal',
          'This sign-in has already been received. Your terminal shows how it ended.',
          false,
        );
        return;
      }
      settled = true;
      if (!sameToken(params.get('state') ?? '', state)) {
        // Ends the sign-in rather than waiting for a better redirect. A request that reaches here is
        // on the registered path and carries a `code` or an `error`, which makes it the provider's
        // redirect rather than a stray probe — the path check above is what turns those away — so a
        // `state` that does not match is tampering or a stale tab, and neither is worth leaving the
        // user watching a terminal for `BROWSER_FLOW_TIMEOUT_MS` on the chance that a second,
        // better redirect arrives.
        finish(
          400,
          'Sign-in could not be verified',
          'This page did not match the sign-in your terminal started. Return to your terminal and try again.',
          false,
        );
        reject(new Error('The browser redirect did not match this sign-in attempt.'));
        return;
      }
      // Checked before the `error` branch as well as the code: RFC 9207 puts `iss` on error
      // responses too, and an error page from a server that is not the expected one is no more its
      // provider's word than a code is.
      const issuerProblem = redirectIssuerProblem(params.get('iss'), issuer);
      if (issuerProblem) {
        finish(
          400,
          'Sign-in could not be verified',
          'This response did not come from the provider your terminal expected. Return to your terminal and try again.',
          false,
        );
        reject(new Error(issuerProblem));
        return;
      }
      const failure = params.get('error');
      if (failure) {
        finish(
          400,
          'Sign-in failed',
          'Your provider declined the request. Return to your terminal for details.',
          false,
        );
        reject(new Error('Authorization failed: ' + safeText(failure) + '.'));
        return;
      }
      const code = params.get('code');
      if (!code) {
        finish(
          400,
          'Sign-in failed',
          'The redirect carried no authorization code. Return to your terminal and try again.',
          false,
        );
        reject(new Error('The browser redirect carried no authorization code.'));
        return;
      }
      let responded = false;
      resolve({
        code,
        respond: (heading, detail, ok) => {
          if (responded) return;
          responded = true;
          finish(ok ? 200 : 400, heading, detail, ok);
        },
      });
    });
    server.on('error', reject);
  });

/** The issuer a browser redirect is held to, and whether it must name one at all. */
type RedirectIssuer = { readonly expected: string | undefined; readonly required: boolean };

/**
 * Why a redirect's `iss` parameter (RFC 9207) is unacceptable, or `undefined` when it is fine.
 *
 * This is the mix-up-attack defence. `state` proves the redirect answers this process's request,
 * but not which authorization server sent it: a CLI that trusts more than one provider can have its
 * browser steered through an attacker's, and would then redeem the code that server handed back at
 * the honest provider's token endpoint — or hand an honest code to the attacker's. Naming the issuer
 * on the redirect, and refusing one that is not the server this sign-in began with, closes that
 * before the code is exchanged anywhere.
 *
 * With no expected issuer — a plain OAuth scheme and none configured — a received `iss` is
 * ignored: there is nothing to compare it with, so it can neither confirm nor refute the sender,
 * and refusing it would break every provider that sends one to clients that never asked.
 */
const redirectIssuerProblem = (received: string | null, issuer: RedirectIssuer): string | undefined => {
  if (issuer.expected === undefined) return undefined;
  if (received === null) {
    return issuer.required
      ? 'The browser redirect did not say which provider sent it (no iss parameter), but this sign-in expected ' +
          safeText(issuer.expected) +
          '.'
      : undefined;
  }
  if (sameIssuer(received, issuer.expected)) return undefined;
  return (
    'The browser redirect was sent by ' +
    (safeText(received) || 'an empty issuer') +
    ', but this sign-in expected ' +
    safeText(issuer.expected) +
    '.'
  );
};

/** Starts the loopback listener, resolving with the port the OS actually bound. */
const listen = (server: ReturnType<typeof createServer>, port: number): Promise<number> =>
  new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    // 127.0.0.1 rather than every interface: the redirect is for this machine's browser alone.
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') resolve(address.port);
      else reject(new Error('Could not open a local port for the sign-in redirect.'));
    });
  });

/**
 * Opens a URL in the user's browser, best effort.
 *
 * A missing opener is not an error: the URL was printed first precisely so the flow still completes
 * when this does nothing.
 *
 * The URL never reaches a shell. On Unix that is automatic — `open` and `xdg-open` are spawned
 * directly. Windows is the trap: `cmd /c start` would make cmd itself the shell, and Node quotes an
 * argument only when it contains a space, tab or quote, so every `&` in an authorization URL would
 * arrive at cmd as a command separator. That breaks the flow even on a benign document (the browser
 * opens on the first query parameter alone, with no `state` or `code_challenge`) and runs arbitrary
 * programs on a hostile one, since `&` survives URL normalization inside the path. So Windows gets
 * PowerShell with the URL in the environment, where nothing parses it as a command line at all.
 */
const openBrowser = (url: string): void => {
  const windows = process.platform === 'win32';
  // Resolved through the absolute `PATH` entries only, as the keychain helper is, so a relative
  // entry cannot put a planted opener in front of the real one.
  const opener = windows ? undefined : resolveOnPath(process.platform === 'darwin' ? 'open' : 'xdg-open');
  if (!windows && !opener) return;
  const [file, ...args] = windows
    ? [windowsPowerShell(), '-NoProfile', '-NonInteractive', '-Command', '-']
    : [opener, url];
  try {
    const child = spawn(file as string, args, {
      stdio: windows ? ['pipe', 'ignore', 'ignore'] : 'ignore',
      detached: !windows,
      ...(windows ? { env: { ...process.env, SCALAR_BROWSER_URL: url } } : {}),
    });
    child.on('error', () => {});
    if (windows) {
      // `-FilePath` is explicit so a URL is never read as a PowerShell parameter, and the value comes
      // from the environment so it is not part of any command line.
      child.stdin?.end('Start-Process -FilePath $env:SCALAR_BROWSER_URL\n');
    }
    child.unref();
  } catch {
    // Ignored; see this function's doc comment.
  }
};

/**
 * Exchanges a grant for an access token.
 *
 * The endpoint comes from the OpenAPI document, which is untrusted input, so it is resolved against
 * the base URL and required to be HTTPS before a secret is put in the request body. Only the
 * standard `error`/`error_description` fields of a failure response are reported: a server that
 * echoed the submitted secret back would otherwise have it printed to stderr and into any CI log.
 */
const exchangeToken = async (
  tokenUrl: string,
  baseUrl: string,
  body: GrantParams,
  timeoutMs: number = TOKEN_REQUEST_TIMEOUT_MS,
): Promise<TokenResponse> => {
  const url = requireSecureUrl(tokenUrl, baseUrl, 'token endpoint');
  const { response, text } = await postForToken(url, body, timeoutMs);
  const payload = parseJson(text);
  if (!response.ok)
    throw new Error('The token endpoint rejected the request' + tokenErrorDetail(payload, response.status));
  return tokenResponse(payload);
};

/** Validates the standard OAuth token response fields before a token reaches the credential store. */
const tokenResponse = (payload: Record<string, unknown> | undefined): TokenResponse => {
  const accessToken = payload?.['access_token'];
  if (typeof accessToken !== 'string' || !accessToken) {
    throw new Error('The token endpoint returned no access token.');
  }
  const refreshToken = payload?.['refresh_token'];
  const expiresIn = payload?.['expires_in'];
  const idToken = payload?.['id_token'];
  return {
    accessToken,
    ...(typeof refreshToken === 'string' && refreshToken ? { refreshToken } : {}),
    // Kept as sent, even when empty or not a string, so the OIDC flow refuses a malformed one rather
    // than treating it as absent.
    ...(idToken === undefined || idToken === null ? {} : { idToken: String(idToken) }),
    // A lifetime at or below zero is not a lifetime. Stored as one it makes `needsRefresh` true
    // forever, so every command pays a full refresh round trip ahead of the request it wanted —
    // on a token that is in fact perfectly good. The device grant already applies this floor to
    // its own `expires_in`; treating an unusable value as unstated puts the two in step.
    ...(typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0 ? { expiresIn } : {}),
  };
};

/** Fetches a bounded JSON document under the same timeout policy used for token endpoints. */
const getJson = async (
  url: URL,
  label: string,
  timeoutMs: number = TOKEN_REQUEST_TIMEOUT_MS,
): Promise<{ readonly response: Response; readonly text: string }> => {
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      // Same reasoning as `postForToken`, for the document that *names* the endpoints rather than
      // the exchange itself: only the URL handed to `fetch` was checked, so a spec-derived
      // discovery endpoint that redirects would have its answer — the authorization and token URLs
      // this whole grant is then pointed at — supplied by whichever origin it forwarded to.
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { response, text: await readBounded(response) };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    throw new Error(
      name === 'TimeoutError' || name === 'AbortError'
        ? 'The ' + label + ' did not answer within ' + String(timeoutMs / 1000) + ' seconds.'
        : 'Could not reach the ' + label + '.',
    );
  }
};

/**
 * Posts the grant and reads the answer, both under one deadline.
 *
 * The read is inside the same `try` as the request because the deadline covers it too: a server
 * that answers its headers and then stalls aborts here, and without this the user would see a raw
 * `The operation was aborted due to timeout` instead of a sentence naming the endpoint.
 *
 * The endpoint is spec-derived, so its own error text is never repeated beyond whether the wait ran
 * out: a `fetch` failure can carry the request, and the request carries the secret.
 *
 * `label` names the endpoint in those two messages, so a revocation that times out does not
 * claim to have been a token request.
 */
const postForToken = async (
  url: URL,
  body: GrantParams,
  timeoutMs: number = TOKEN_REQUEST_TIMEOUT_MS,
  label = 'token endpoint',
): Promise<{ readonly response: Response; readonly text: string }> => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: writeParams(new URLSearchParams(), body).toString(),
      // A 307/308 preserves the POST body. Do not let a spec-derived endpoint forward a refresh
      // token, authorization code, or device code to a different (possibly insecure) origin.
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { response, text: await readBounded(response) };
  } catch (error) {
    // A deadline reached during the request is a `TimeoutError`; one reached while the body is
    // still arriving surfaces as the abort itself.
    const name = error instanceof Error ? error.name : '';
    throw new Error(
      name === 'TimeoutError' || name === 'AbortError'
        ? 'The ' + label + ' did not answer within ' + String(timeoutMs / 1000) + ' seconds.'
        : 'Could not reach the ' + label + '.',
    );
  }
};

/**
 * Reads at most {@link TOKEN_RESPONSE_LIMIT} characters of a response body.
 *
 * `response.text()` would buffer whatever the endpoint chooses to send before anything could cap
 * it, so the stream is read in pieces and cancelled once there is more than enough to parse.
 */
const readBounded = async (response: Response): Promise<string> => {
  const body = response.body;
  if (!body) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  try {
    while (text.length < TOKEN_RESPONSE_LIMIT) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    // Nothing is read after this point, and an abandoned body keeps the socket open.
    void reader.cancel().catch(() => {});
  }
  return text.slice(0, TOKEN_RESPONSE_LIMIT);
};

const parseJson = (text: string): Record<string, unknown> | undefined => {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
};

const tokenErrorDetail = (payload: Record<string, unknown> | undefined, status: number): string => {
  const code = payload?.['error'];
  const description = payload?.['error_description'];
  const parts = [
    typeof code === 'string' ? code : undefined,
    typeof description === 'string' ? description : undefined,
  ]
    .filter((part): part is string => !!part)
    .map(safeText);
  return parts.length > 0 ? ' (' + parts.join(': ') + ').' : ' with status ' + String(status) + '.';
};

/**
 * Resolves a spec-derived endpoint and refuses to send credentials to it in the clear.
 *
 * HTTPS is required, with the usual carve-out for loopback so a local development authorization
 * server still works. Without this, a document naming an `http://` token endpoint would have the
 * CLI post a client secret unencrypted to whatever host it named.
 */
const requireSecureUrl = (raw: string, baseUrl: string, label: string): URL => {
  let url: URL;
  try {
    url = new URL(raw, baseUrl || undefined);
  } catch {
    throw new Error('The ' + label + ' is not a usable URL.');
  }
  if (url.protocol === 'https:') return url;
  if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)) return url;
  throw new Error(
    'Refusing to send credentials to a non-HTTPS ' +
      label +
      ' (' +
      safeText(url.protocol + '//' + url.host) +
      ').',
  );
};

/**
 * Compares two opaque tokens without leaking their contents through timing.
 *
 * Lengths are compared first because `timingSafeEqual` throws on a mismatch; both values here are
 * fixed-length base64url, so an unequal length is already a mismatch.
 */
const sameToken = (received: string, expected: string): boolean => {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

const base64Url = (bytes: Buffer): string => bytes.toString('base64url');

/**
 * Strips anything from a network-supplied string that a terminal would act on.
 *
 * An OAuth error message reaches stderr verbatim, and both the redirect query and the token
 * endpoint's response body are written by whoever the document points at, so control characters
 * (escape sequences that reposition the cursor or recolour the line) are removed and the result is
 * capped rather than printed as received.
 */
const safeText = (value: string): string => {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point.
  const stripped = value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ').trim();
  return stripped.length > 200 ? stripped.slice(0, 200) + '...' : stripped;
};

const withTimeout = <T>(promise: Promise<T>, ms: number, message: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });

/**
 * A failure the user can fix by invoking the command differently, reported as a usage error.
 *
 * Distinguished from an authentication failure so a script can tell "you typed the wrong flow name"
 * (retrying will not help) from "the credential was rejected" (a fresh sign-in might).
 */
export class UsageError extends Error {}

const NO_TERMINAL =
  'Sign-in needs an interactive terminal. Run it from a terminal, pick a flow that needs no prompt with --flow <name> (see --help), or set the credential through its flag or environment variable instead.';

/** Puts the terminal cursor back, for the picker's own exit paths and for a signal that skips them. */
const restoreCursor = (): void => {
  processStderr.write('\u001b[?25h');
};

/** One row of the sign-in picker: what it reads as, and the `--flow` value that skips the prompt. */
type Choice = {
  readonly label: string;
  readonly hint: string;
};

/**
 * Puts a list of choices to the user and resolves the index of the one chosen.
 *
 * A highlight moved with the arrow keys rather than a number typed at a prompt, so the row being
 * chosen is the row being read. Only the highlighted row carries its `--flow` value, which is what
 * keeps a nine-line list from spelling out nine of them; the value is still on screen for whichever
 * flow the user is about to pick, which is the one they would want to write down.
 *
 * Raw mode is what delivers a keystroke without Enter behind it, and is required rather than fallen
 * back from, exactly as `promptSecret` requires it: a terminal Node reports as a TTY always offers
 * it, so the alternative was a branch that could not be reached to be tested. A digit still jumps to
 * its row, so the keys that answered the numbered prompt this replaces still answer this one.
 *
 * Drawn on stderr, like every other prompt, so stdout stays machine-readable.
 */
const promptChoice = async (heading: string, choices: readonly Choice[]): Promise<number> => {
  if (!processStdin.isTTY || typeof processStdin.setRawMode !== 'function') {
    throw new UsageError(NO_TERMINAL);
  }
  return new Promise<number>((resolve, reject) => {
    let active = 0;
    // How many rows the last draw wrote, which is how far back up the cursor has to go to redraw
    // over them. Without it every keystroke would leave another copy of the list in the scrollback.
    let drawn = 0;
    const width = (): number => Number(processStderr.columns) || 80;
    /**
     * The slice of choices to draw, keeping the highlight inside it.
     *
     * A list taller than the terminal would scroll the region the redraw is about to move back over,
     * putting every subsequent frame in the wrong place, so a long list is windowed instead.
     */
    const window = (): readonly Choice[] => {
      const room = Math.max(1, (Number(processStderr.rows) || 24) - 3);
      if (choices.length <= room) return choices;
      const start = Math.min(Math.max(0, active - (room >> 1)), choices.length - room);
      return choices.slice(start, start + room);
    };
    const render = (): void => {
      if (drawn > 0) processStderr.write('\u001b[' + String(drawn) + 'A');
      const columns = width();
      const shown = window();
      const lines = [clip(heading, columns)];
      for (const choice of shown) {
        const selected = choice === choices[active];
        const head = (selected ? '> ' : '  ') + choice.label;
        const tail = '  (--flow ' + choice.hint + ')';
        const plain = clip(head + tail, columns);
        // The flow name is kept on every row rather than only the highlighted one, because labels
        // are not unique: an API key in a header, in a query parameter and in a cookie all read as
        // `Enter your API key`, and the flow name is the only thing telling those rows apart. It is
        // dimmed so the labels still read as the list, and dropped entirely from a row too narrow
        // to hold it, where clipping has already eaten the closing bracket.
        const row = plain === head + tail ? head + '\u001b[2m' + tail + '\u001b[22m' : plain;
        lines.push(selected ? '\u001b[36m' + row + '\u001b[39m' : row);
      }
      const position =
        shown.length < choices.length ? String(active + 1) + '/' + String(choices.length) + ', ' : '';
      lines.push(clip('  ' + position + 'arrows to move, enter to choose', columns));
      // Each row is cleared to its end before being rewritten: a shorter line would otherwise leave
      // the tail of whatever longer one occupied that row in the frame before.
      processStderr.write(lines.map((line) => '\u001b[2K' + line).join('\n') + '\n');
      drawn = lines.length;
    };
    const move = (delta: number): void => {
      active = (active + delta + choices.length) % choices.length;
      render();
    };
    const jump = (index: number): void => {
      if (index < 0 || index >= choices.length) return;
      active = index;
      render();
    };
    const onData = (chunk: string): void => {
      let index = 0;
      while (index < chunk.length) {
        const character = chunk[index] ?? '';
        if (character === '\u001b') {
          // An arrow is ESC [ A or ESC O A. The sequence is scanned to its final byte so that no
          // part of it is read as a keystroke in its own right — the `[` of an Up arrow would
          // otherwise be an ordinary printable character arriving between two frames.
          let cursor = index + 1;
          if (chunk[cursor] === '[' || chunk[cursor] === 'O') {
            cursor += 1;
            // A CSI sequence ends at its final byte, anything in the range `@` to `~`.
            while (cursor < chunk.length) {
              const byte = chunk[cursor] ?? '';
              if (byte >= '@' && byte <= '~') break;
              cursor += 1;
            }
            const final = chunk[cursor] ?? '';
            if (final === 'A') move(-1);
            else if (final === 'B') move(1);
            else if (final === 'H') jump(0);
            else if (final === 'F') jump(choices.length - 1);
            index = cursor + 1;
            continue;
          }
          index = cursor;
          continue;
        }
        index += 1;
        if (character === '\r' || character === '\n') {
          finish();
          return;
        }
        // Ctrl-C and Ctrl-D: raw mode has taken the terminal's own handling away, so the cancel has
        // to be honoured here or the picker could never be escaped.
        if (character === '\u0003' || character === '\u0004') {
          finish(new UsageError('Cancelled.'));
          return;
        }
        // Ctrl-P and Ctrl-N beside the vim keys, so the three habits a terminal user might arrive
        // with all work without anything on screen having to offer them.
        if (character === 'k' || character === '\u0010') move(-1);
        else if (character === 'j' || character === '\u000e') move(1);
        else if (character >= '1' && character <= '9') jump(Number(character) - 1);
      }
    };
    const finish = (error?: Error): void => {
      processStdin.off('data', onData);
      processStdin.setRawMode(false);
      processStdin.pause();
      // The list is wound back over and replaced by the single line saying what was chosen: a menu
      // is worth reading while it is being answered and is clutter in the scrollback afterwards.
      if (drawn > 0) processStderr.write('\u001b[' + String(drawn) + 'A\u001b[0J');
      process.off('exit', restoreCursor);
      restoreCursor();
      if (error) {
        reject(error);
        return;
      }
      const chosen = choices[active];
      processStderr.write(
        heading + ' ' + (chosen?.label ?? '') + '  (--flow ' + (chosen?.hint ?? '') + ')\n',
      );
      resolve(active);
    };
    // Hidden for the duration: the cursor would otherwise sit at the end of the last row drawn,
    // blinking somewhere that has nothing to do with the highlight. Restoring it is registered with
    // the hide rather than left to `finish`, because a signal that ends the process while the menu
    // is up reaches neither the key handler nor the rejection paths, and an invisible cursor
    // outlives the CLI it belonged to — the user's next shell prompt is where they find out.
    process.on('exit', restoreCursor);
    processStderr.write('\u001b[?25l');
    processStdin.setRawMode(true);
    processStdin.resume();
    processStdin.setEncoding('utf8');
    processStdin.on('data', onData);
    render();
  });
};

/** Reads one visible line from the terminal. Prompts go to stderr so stdout stays machine-readable. */
const promptLine = (label: string): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    if (!processStdin.isTTY) {
      reject(new UsageError(NO_TERMINAL));
      return;
    }
    const rl = createInterface({ input: processStdin, output: processStderr });
    let answered = false;
    // Closing the interface emits 'close' synchronously, so the guard is what keeps the end-of-input
    // fallback from resolving ahead of the answer that was just typed.
    rl.on('close', () => {
      if (!answered) resolve('');
    });
    rl.question(label, (answer) => {
      answered = true;
      resolve(answer.trim());
      rl.close();
    });
  });

/**
 * Reads one secret from the terminal without echoing it.
 *
 * Raw mode is entered directly rather than muting a readline interface: readline exposes no
 * supported way to suppress its echo, and the credential would otherwise be left on screen and in
 * any recorded terminal session. Nothing typed here is written back, so there is no cursor to
 * manage — only the terminating newline is emitted.
 */
const promptSecret = (label: string): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    if (!processStdin.isTTY || typeof processStdin.setRawMode !== 'function') {
      reject(new UsageError(NO_TERMINAL));
      return;
    }
    processStderr.write(label);
    let value = '';
    // Where an escape sequence has got to: 0 outside one, 1 just after ESC, 2 inside CSI/SS3
    // parameters. Dropping the ESC alone is not enough — an Up arrow is ESC [ A, and the `[` and
    // `A` are ordinary printable bytes that would otherwise land in the middle of a credential the
    // user cannot see to correct.
    let escape = 0;
    const onData = (chunk: string): void => {
      for (const character of chunk) {
        if (escape === 1) {
          escape = character === '[' || character === 'O' ? 2 : 0;
          continue;
        }
        if (escape === 2) {
          // A CSI sequence ends at its final byte, anything in the range `@` to `~`.
          if (character >= '@' && character <= '~') escape = 0;
          continue;
        }
        if (character === '\u001b') {
          escape = 1;
          continue;
        }
        if (character === '\r' || character === '\n') {
          finish();
          return;
        }
        // Ctrl-C and Ctrl-D: raw mode has taken the terminal's own handling away, so the cancel has
        // to be honoured here or the prompt could never be escaped.
        if (character === '\u0003') {
          finish(new UsageError('Cancelled.'));
          return;
        }
        if (character === '\u0004') {
          if (value) finish();
          else finish(new UsageError('Cancelled.'));
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        // Any other control byte is dropped for the same reason.
        if (character < ' ') continue;
        value += character;
      }
    };
    const finish = (error?: Error): void => {
      processStdin.off('data', onData);
      processStdin.setRawMode(false);
      processStdin.pause();
      processStderr.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    processStdin.setRawMode(true);
    processStdin.resume();
    processStdin.setEncoding('utf8');
    processStdin.on('data', onData);
  });
