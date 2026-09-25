// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { spawn } from 'node:child_process';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { stderr as processStderr, stdin as processStdin } from 'node:process';

import {
  type CredentialStoreLocation,
  type StoredOAuth,
  type StoredProfile,
  clearAll,
  deleteProfile,
  profileKey,
  readProfile,
  refreshProfile,
  storeDescription,
  writeProfile,
} from './credentials';
import { windowsPowerShell } from './keychain';

/** One way `login` can obtain a credential. Mirrors the emitter's `CliAuthMethodDefinition`. */
export type CliAuthMethodDefinition = {
  readonly name: string;
  readonly label: string;
} & (
  | { readonly kind: 'token'; readonly clientKey: string; readonly prompt: string }
  | { readonly kind: 'basic'; readonly usernameKey: string; readonly passwordKey: string }
  | {
      readonly kind: 'oauth';
      readonly grant: 'authorizationCode';
      readonly resource?: string;
      readonly issuer?: string;
      readonly clientKey: string;
      readonly tokenUrl: string;
      readonly refreshUrl: string;
      readonly authorizationUrl: string;
      readonly scopes: readonly string[];
      readonly clientId: string;
      readonly redirectPort: number;
    }
  | {
      readonly kind: 'oauth';
      readonly grant: 'clientCredentials' | 'password';
      readonly clientKey: string;
      readonly tokenUrl: string;
      readonly refreshUrl: string;
      readonly scopes: readonly string[];
      readonly clientId?: string;
    }
  | {
      readonly kind: 'oauth';
      readonly grant: 'deviceAuthorization';
      readonly clientKey: string;
      readonly deviceAuthorizationUrl: string;
      readonly tokenUrl: string;
      readonly refreshUrl: string;
      readonly scopes: readonly string[];
      readonly clientId?: string;
    }
  | {
      readonly kind: 'oauth';
      readonly grant: 'openIdConnect';
      readonly clientKey: string;
      readonly discoveryUrl: string;
      readonly scopes: readonly string[];
      readonly clientId: string;
      readonly redirectPort: number;
    }
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
  readonly requirements: readonly (readonly string[])[];
  readonly envByKey: Readonly<Record<string, string>>;
  readonly methods: readonly CliAuthMethodDefinition[];
};

/** How long the browser flow waits for the redirect before giving the terminal back. */
const BROWSER_FLOW_TIMEOUT_MS = 300000;

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
 */
const outstandingRequirement = (
  auth: CliAuthDefinition,
  location: CredentialStoreLocation,
  key: string,
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
  const commands = runnable.map((method) => auth.loginCommand + ' --flow ' + method.name);
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
 */
export const runLogin = async (
  auth: CliAuthDefinition,
  baseUrl: string,
  flow: string | undefined,
): Promise<string> => {
  const method = await chooseMethod(auth, flow);
  const location = storeLocation(auth);
  const key = profileKey(baseUrl);
  const captured = await captureCredentials(method, baseUrl);
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
  const outstanding = outstandingRequirement(auth, location, key);
  return outstanding ? line + '\n' + outstanding : line;
};

/** Forgets stored credentials, returning the line to print. */
export const runLogout = (auth: CliAuthDefinition, baseUrl: string, all: boolean): string => {
  const location = storeLocation(auth);
  if (all) {
    clearAll(location);
    return 'Signed out everywhere.';
  }
  const key = profileKey(baseUrl);
  const outcome = deleteProfile(location, key);
  if (outcome === 'removed') return 'Signed out of ' + safeText(baseUrl || 'the API') + '.';
  return 'No stored credentials for ' + safeText(baseUrl || 'the API') + '.';
};

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
    try {
      const token = await exchangeToken(
        refreshUrl,
        baseUrl,
        {
          grant_type: 'refresh_token',
          refresh_token: meta.refreshToken,
          ...(meta.clientId ? { client_id: meta.clientId } : {}),
        },
        SILENT_REFRESH_TIMEOUT_MS,
      );
      credentials[clientKey] = token.accessToken;
      // Conditional, not `writeProfile`: a `logout` that landed while the exchange was in flight
      // must not be undone by the token it produced. See `refreshProfile`.
      refreshProfile(location, key, {
        credentials: { [clientKey]: token.accessToken },
        oauth: { [clientKey]: oauthMetadata(token, refreshUrl, meta.clientId, meta.refreshToken) },
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
  const { token, clientId, refreshUrl } = await runOauthFlow(method, baseUrl);
  return {
    credentials: { [method.clientKey]: token.accessToken },
    oauth: { [method.clientKey]: oauthMetadata(token, refreshUrl, clientId, undefined) },
  };
};

const oauthMetadata = (
  token: TokenResponse,
  refreshUrl: string,
  clientId: string | undefined,
  previousRefreshToken: string | undefined,
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
  };
};

/** The access token an OAuth grant produced, plus what is needed to renew it. */
type TokenResponse = {
  readonly accessToken: string;
  readonly refreshToken?: string;
  /** Lifetime in seconds, as the token endpoint reported it. */
  readonly expiresIn?: number;
};

const runOauthFlow = async (
  method: Extract<CliAuthMethodDefinition, { kind: 'oauth' }>,
  baseUrl: string,
): Promise<OAuthFlowResult> => {
  if (method.grant === 'authorizationCode') {
    const result = await authorizationCodeFlow(method, baseUrl);
    return { ...result, refreshUrl: method.refreshUrl };
  }
  if (method.grant === 'openIdConnect') return openIdConnectFlow(method, baseUrl);
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
  });
  // Persisted so the refresh exchange can send the same client id the grant was made with; a blank
  // answer stores nothing, which is what an absent one already did.
  return { token, clientId: clientId || undefined, refreshUrl: method.refreshUrl };
};

/** OAuth result plus the endpoint needed later to refresh a persisted token. */
type OAuthFlowResult = {
  readonly token: TokenResponse;
  readonly clientId: string | undefined;
  readonly refreshUrl: string;
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
  const clientId = method.clientId ?? (await promptLine('Client id: '));
  if (!clientId) throw new UsageError('No client id entered; nothing was saved.');
  const device = await requestDeviceAuthorization(
    method.deviceAuthorizationUrl,
    baseUrl,
    clientId,
    method.scopes,
  );
  processStderr.write(
    'To sign in, visit:\n\n  ' +
      device.verificationUrl +
      (device.userCode ? '\n\nThen enter code: ' + safeText(device.userCode) : '') +
      '\n\nWaiting for authorization...\n',
  );
  return {
    token: await pollDeviceToken(method.tokenUrl, baseUrl, clientId, device),
    clientId,
    refreshUrl: method.refreshUrl,
  };
};

/** Discovers OpenID Connect endpoints, then uses the same PKCE flow as a declared authorization code grant. */
const openIdConnectFlow = async (
  method: Extract<CliAuthMethodDefinition, { grant: 'openIdConnect' }>,
  baseUrl: string,
): Promise<OAuthFlowResult> => {
  const endpoints = await discoverOpenIdConnect(method.discoveryUrl, baseUrl);
  const result = await authorizationCodeFlow(
    {
      ...method,
      grant: 'authorizationCode',
      authorizationUrl: endpoints.authorizationUrl,
      tokenUrl: endpoints.tokenUrl,
      refreshUrl: endpoints.tokenUrl,
    },
    baseUrl,
  );
  return { ...result, refreshUrl: endpoints.tokenUrl };
};

const scopeParam = (scopes: readonly string[]): Record<string, string> =>
  scopes.length > 0 ? { scope: scopes.join(' ') } : {};

type DeviceAuthorization = {
  readonly deviceCode: string;
  readonly verificationUrl: string;
  readonly userCode?: string;
  readonly expiresAt: number;
  readonly intervalMs: number;
};

/** Starts a device grant and validates the response before anything is printed to the terminal. */
const requestDeviceAuthorization = async (
  endpoint: string,
  baseUrl: string,
  clientId: string,
  scopes: readonly string[],
): Promise<DeviceAuthorization> => {
  const url = requireSecureUrl(endpoint, baseUrl, 'device authorization endpoint');
  const { response, text } = await postForToken(url, { client_id: clientId, ...scopeParam(scopes) });
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

/** Polls the token endpoint until the user authorizes, declines, or the device code expires. */
const pollDeviceToken = async (
  endpoint: string,
  baseUrl: string,
  clientId: string,
  device: DeviceAuthorization,
): Promise<TokenResponse> => {
  const url = requireSecureUrl(endpoint, baseUrl, 'token endpoint');
  let intervalMs = device.intervalMs;
  while (Date.now() < device.expiresAt) {
    await waitFor(Math.min(intervalMs, Math.max(0, device.expiresAt - Date.now())));
    if (Date.now() >= device.expiresAt) break;
    const { response, text } = await postForToken(url, {
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: device.deviceCode,
      client_id: clientId,
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

/** Fetches the OpenID Provider configuration and keeps only the two endpoints PKCE needs. */
const discoverOpenIdConnect = async (
  discoveryUrl: string,
  baseUrl: string,
): Promise<{ readonly authorizationUrl: string; readonly tokenUrl: string }> => {
  const url = requireSecureUrl(discoveryUrl, baseUrl, 'OpenID Connect discovery document');
  const { response, text } = await getJson(url, 'OpenID Connect discovery document');
  const payload = parseJson(text);
  if (!response.ok) {
    throw new Error(
      'The OpenID Connect discovery document could not be read' + tokenErrorDetail(payload, response.status),
    );
  }
  // Section 4.3 requires the returned issuer to be the one the URL was built from. It is the check
  // that keeps a provider from naming somebody else's endpoints: without it this grant sends the
  // user's browser, and then the authorization code, wherever an untrusted document says.
  const issuer = payload?.['issuer'];
  if (typeof issuer !== 'string' || !issuer) {
    throw new Error('The OpenID Connect discovery document named no issuer.');
  }
  const expected = discoveryIssuer(url);
  const issuerUrl = requireSecureUrl(issuer, '', 'OpenID Connect issuer');
  const matches = expected === undefined ? issuerUrl.origin === url.origin : sameIssuer(issuer, expected);
  if (!matches) {
    throw new Error(
      'The OpenID Connect discovery document is issued by ' +
        safeText(issuer) +
        ', which is not the provider it was fetched from.',
    );
  }
  const authorizationUrl = payload?.['authorization_endpoint'];
  const tokenUrl = payload?.['token_endpoint'];
  if (typeof authorizationUrl !== 'string' || typeof tokenUrl !== 'string') {
    throw new Error(
      'The OpenID Connect discovery document returned no usable authorization and token endpoints.',
    );
  }
  // Resolved against the issuer, never the API base URL: a relative `/authorize` belongs to the
  // provider that answered, and resolving it against the API would point the browser — and the code
  // exchange after it — at the API host instead.
  return {
    authorizationUrl: requireSecureUrl(
      authorizationUrl,
      issuerUrl.toString(),
      'OpenID Connect authorization endpoint',
    ).toString(),
    tokenUrl: requireSecureUrl(tokenUrl, issuerUrl.toString(), 'OpenID Connect token endpoint').toString(),
  };
};

/**
 * The browser sign-in: PKCE authorization code against a loopback redirect (RFC 8252).
 *
 * The CLI is a public client, so it holds no secret; PKCE is what stops an intercepted code from
 * being redeemed by anything but this process. The redirect listens on 127.0.0.1 rather than a
 * public interface, and the authorization URL is printed before the browser is opened so a headless
 * or remote shell can still complete the flow by hand.
 */
const authorizationCodeFlow = async (
  method: Extract<CliAuthMethodDefinition, { grant: 'authorizationCode' }>,
  baseUrl: string,
): Promise<{ readonly token: TokenResponse; readonly clientId: string | undefined }> => {
  const clientId = method.clientId;
  if (!clientId || !method.authorizationUrl) throw new Error('This flow needs a configured OAuth client id.');
  const authorizeUrl = requireSecureUrl(method.authorizationUrl, baseUrl, 'authorization endpoint');
  if (method.resource) {
    if (profileKey(baseUrl) !== profileKey(method.resource)) {
      throw new UsageError('Browser sign-in is unavailable for this API base URL.');
    }
    authorizeUrl.searchParams.set('resource', method.resource);
  }
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash('sha256').update(verifier).digest());
  const state = base64Url(randomBytes(32));

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
  const redirect = awaitRedirect(server, state, REDIRECT_PATH, method.issuer);
  const redirectUri = 'http://127.0.0.1:' + String(port) + REDIRECT_PATH;
  try {
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('code_challenge', challenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    if (method.scopes.length > 0) authorizeUrl.searchParams.set('scope', method.scopes.join(' '));
    const target = authorizeUrl.toString();
    processStderr.write(
      'Opening your browser to sign in. If it does not open, visit:\n\n  ' + target + '\n\n',
    );
    openBrowser(target);
    const code = await withTimeout(
      redirect,
      BROWSER_FLOW_TIMEOUT_MS,
      'Timed out waiting for the browser redirect.',
    );
    const token = await exchangeToken(method.tokenUrl, baseUrl, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    });
    return { token, clientId };
  } finally {
    server.close();
    // Belt and braces with the `connection: close` above: a connection opened but never used (a
    // browser preconnecting to the redirect host) is not covered by that header and would keep the
    // listener, and so the process, alive.
    server.closeAllConnections();
  }
};

/**
 * The style for the one page a generated CLI ever puts in front of a browser.
 *
 * Every colour is a token on `:root` so the palette can be restyled in one block, and each is
 * redefined under `prefers-color-scheme: dark` rather than being left to the browser.
 *
 * The font stack names Inter first and then falls back to the system UI face. Naming it is free
 * where it is already installed and costs nothing where it is not — what it must never do is
 * *fetch* it, for the same reason the rest of this page is inline.
 */
const PAGE_STYLE =
  // Values taken from the Scalar dashboard's own theme: `--scalar-background-1/2`,
  // `--scalar-color-1/2`, `--scalar-border-color` and the semantic green and red, per mode.
  //
  // `light-dark()` rather than a `prefers-color-scheme` block, so each token states its light and
  // dark value together and the palette can be read as pairs. It resolves against the
  // `color-scheme` declared on the same rule, which is why that comes first.
  //
  // Where the function is not understood (before Firefox 120, Chrome 123, Safari 17.5) every token
  // is invalid at computed-value time and the properties using them fall back to their initial
  // values — black on white, with an unstyled icon and no card border. Plain, still legible, and
  // still saying the sign-in worked, which is the page's whole job.
  ':root{color-scheme:light dark;' +
  '--bg:light-dark(#fff,#0f0f0f);' +
  '--card:light-dark(#f6f6f6,#1a1a1a);' +
  '--fg:light-dark(#1b1b1b,#e7e7e7);' +
  '--muted:light-dark(#757575,#a4a4a4);' +
  '--line:light-dark(#dfdfdf,#2d2d2d);' +
  '--ok:light-dark(#069061,#00b648);' +
  '--err:light-dark(#ef0006,#dc1b19)}' +
  '*{box-sizing:border-box}' +
  'body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--bg);color:var(--fg);' +
  // Mirrors `--scalar-font`, which also leads with Inter and falls back to the system UI face.
  'font:16px/1.6 Inter,ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}' +
  // `--scalar-radius` is 3px and `--scalar-radius-lg` doubles it; 6px is that, spelled literally
  // because the page carries no token indirection of its own.
  '.card{width:100%;max-width:23rem;padding:40px 32px;text-align:center;background:var(--card);' +
  'border:1px solid var(--line);border-radius:6px}' +
  'svg{width:38px;height:38px}' +
  // `--scalar-bold` is 600, which is what the dashboard's own headings use.
  'h1{margin:20px 0 8px;font-size:18px;font-weight:600;letter-spacing:-.01em}' +
  'p{margin:0;color:var(--muted);font-size:14px}';

/**
 * The tab icon, as the same mark the page shows.
 *
 * A data URI rather than a file, so the browser never requests `/favicon.ico` from the loopback
 * listener — which would otherwise answer a 404 to a request it only receives because the page
 * declared no icon.
 *
 * Deliberately a status mark and not a vendor logo: this page is served by every generated CLI, so
 * an icon identifying the SDK's *author* would put one company's branding on another's sign-in.
 *
 * The colours are the dark-mode pair, which read against a light and a dark tab strip alike;
 * `light-dark()` is no use here because the SVG is a separate document with no `color-scheme` of
 * its own. Only `#`, `<` and `>` are escaped, which is all a data URI in an attribute needs, and
 * the SVG quotes its attributes with apostrophes so the `href` can keep the double quotes.
 */
const favicon = (mark: string, ok: boolean): string => {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='" +
    (ok ? '#00b648' : '#dc1b19') +
    "' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'>" +
    "<circle cx='12' cy='12' r='9.25'/><path d='" +
    mark +
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
 * Inlined down to the icon, with nothing fetched: the listener answers on loopback, where the
 * machine may well have no route out at all, and a callback page that reached for a stylesheet or a
 * font would also tell whoever served it that a sign-in had just happened.
 *
 * Nothing the authorization server sent is interpolated here. The provider's own `error` goes to
 * the terminal through `safeText` instead, which keeps untrusted text out of markup entirely rather
 * than relying on this function to escape it.
 */
const redirectPage = (heading: string, detail: string, ok: boolean): string => {
  const mark = ok ? 'm8 12.5 2.5 2.5 5.5-6' : 'm9 9 6 6m0-6-6 6';
  return (
    '<!doctype html><html lang="en"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    favicon(mark, ok) +
    '<title>' +
    heading +
    '</title><style>' +
    PAGE_STYLE +
    '</style><div class="card">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="' +
    (ok ? 'var(--ok)' : 'var(--err)') +
    '" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="9.25"/><path d="' +
    mark +
    '"/></svg>' +
    '<h1>' +
    heading +
    '</h1><p>' +
    detail +
    '</p></div>'
  );
};

/**
 * Resolves with the authorization code the redirect carries.
 *
 * Anything that is not the redirect — a browser probing `/favicon.ico`, a stray request to the
 * port — is answered 404 and ignored, so it cannot resolve or reject the wait. The `state` is
 * compared in constant time and rejected on mismatch, which is what ties the redirect back to the
 * request this process started.
 */
const awaitRedirect = (
  server: ReturnType<typeof createServer>,
  state: string,
  path: string,
  issuer?: string,
): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    server.on('request', (request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const params = url.searchParams;
      const send = (status: number, type: string, body: string): void => {
        // `connection: close` rather than the default keep-alive: `server.close()` waits for open
        // connections, and a browser holding one would leave the CLI running after it had signed in.
        response.writeHead(status, { 'content-type': type + '; charset=utf-8', connection: 'close' });
        response.end(body);
      };
      const finish = (status: number, heading: string, detail: string, ok: boolean): void => {
        send(status, 'text/html', redirectPage(heading, detail, ok));
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
      if (params.getAll('state').length !== 1 || !sameToken(params.get('state') ?? '', state) ||
          (issuer !== undefined && (params.getAll('iss').length !== 1 || params.get('iss') !== issuer))) {
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
      finish(200, 'Signed in', 'You can close this window and return to your terminal.', true);
      resolve(code);
    });
    server.on('error', reject);
  });

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
  const [file, ...args] = windows
    ? [windowsPowerShell(), '-NoProfile', '-NonInteractive', '-Command', '-']
    : process.platform === 'darwin'
      ? ['open', url]
      : ['xdg-open', url];
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
  body: Readonly<Record<string, string>>,
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
  return {
    accessToken,
    ...(typeof refreshToken === 'string' && refreshToken ? { refreshToken } : {}),
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
): Promise<{ readonly response: Response; readonly text: string }> => {
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      // Same reasoning as `postForToken`, for the document that *names* the endpoints rather than
      // the exchange itself: only the URL handed to `fetch` was checked, so a spec-derived
      // discovery endpoint that redirects would have its answer — the authorization and token URLs
      // this whole grant is then pointed at — supplied by whichever origin it forwarded to.
      redirect: 'error',
      signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
    });
    return { response, text: await readBounded(response) };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    throw new Error(
      name === 'TimeoutError' || name === 'AbortError'
        ? 'The ' + label + ' did not answer within ' + String(TOKEN_REQUEST_TIMEOUT_MS / 1000) + ' seconds.'
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
 */
const postForToken = async (
  url: URL,
  body: Readonly<Record<string, string>>,
  timeoutMs: number = TOKEN_REQUEST_TIMEOUT_MS,
): Promise<{ readonly response: Response; readonly text: string }> => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams(body).toString(),
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
        ? 'The token endpoint did not answer within ' + String(timeoutMs / 1000) + ' seconds.'
        : 'Could not reach the token endpoint.',
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

/**
 * Cuts a line to the terminal's width.
 *
 * A row that wrapped would occupy two of them, and the redraw counts rows rather than measuring
 * them, so one wrapped label would put every following frame a line out of place.
 */
const clip = (text: string, width: number): string =>
  text.length <= width ? text : text.slice(0, Math.max(0, width - 3)) + '...';

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
