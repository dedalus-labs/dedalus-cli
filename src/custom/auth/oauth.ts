/**
 * Clerk OAuth 2.0 Authorization Code flow for the Dedalus command-line interface.
 *
 * The flow uses Proof Key for Code Exchange (PKCE) and a one-use loopback
 * callback. It returns a provider-neutral session for storage and refresh.
 */

import { createHash, randomBytes as nodeRandomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

import {
  clerkOAuthScopes,
  ClerkOAuthError,
  fetchUserInfo,
  oauthErrorCode,
  opaqueValue,
  requestTokenSet,
  type TokenSet,
  type UserInfo,
} from './oauth-http.js'
import { closeServer, deferred, equalSecret, listenOnLoopback, type Deferred } from './oauth-loopback.js'
import type { AuthProvider, OAuthSession } from './types.js'

export {
  ClerkOAuthError,
  type ClerkOAuthErrorCode,
  type ClerkOAuthErrorStage,
} from './oauth-http.js'

const defaultLoginTimeoutMs = 10 * 60 * 1000
const callbackPath = '/callback'
const maxAuthorizationCodeLength = 8 * 1024
const maxAuthorizationURLLength = 4 * 1024
const maxOAuthDisplayLength = 4 * 1024
const maxOAuthIdentifierLength = 1024
const requestTimeoutMs = 30 * 1000

export type ClerkOAuthOptions = {
  readonly issuer: string
  readonly clientId: string
  readonly signInURL?: string
  readonly timeoutMs?: number
}

export type ClerkOAuthDependencies = {
  readonly fetch?: typeof globalThis.fetch
  readonly now?: () => number
  readonly openBrowser?: (url: string) => Promise<void>
  readonly randomBytes?: (size: number) => Uint8Array
}

export type ClerkOAuthAttempt = {
  readonly authorizationURL: string
  readonly redirectURI: string
  readonly complete: () => Promise<OAuthSession>
  readonly cancel: () => Promise<void>
}

type OAuthConfiguration = {
  readonly clientId: string
  readonly issuer: URL
  readonly signInURL?: URL
  readonly timeoutMs: number
}

type CallbackState = {
  readonly result: Deferred<string>
  readonly issuer: string
  readonly state: string
  settled: boolean
  timer?: ReturnType<typeof setTimeout>
}

type OAuthCallbackListener = {
  readonly redirectURI: string
  readonly result: Promise<string>
  readonly cancel: () => Promise<void>
  readonly startTimeout: (timeoutMs: number) => void
}

export const clerkPKCEChallenge = (verifier: string): string =>
  createHash('sha256').update(verifier, 'ascii').digest('base64url')

export const createClerkAuthProvider = (
  options: ClerkOAuthOptions,
  dependencies: ClerkOAuthDependencies = {},
): AuthProvider => {
  const issuer = validIssuer(options.issuer).origin
  const clientId = validClientId(options.clientId)
  const request = dependencies.fetch ?? globalThis.fetch
  const now = dependencies.now ?? Date.now

  return {
    issuer,
    clientId,
    login: async () => {
      const attempt = await beginClerkOAuth({ ...options, issuer, clientId }, dependencies)
      try {
        const openBrowser = dependencies.openBrowser ?? defaultOpenBrowser
        await openBrowser(attempt.authorizationURL)
      } catch (error: unknown) {
        await attempt.cancel()
        throw new ClerkOAuthError('browser_open_failed', { cause: error })
      }
      return attempt.complete()
    },
    refresh: async (session) => {
      requireProviderSession(session, issuer, clientId)
      const tokens = await requestTokenSet({
        issuer: new URL(issuer),
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          refresh_token: session.refreshToken,
        }),
        request,
        now,
        previousRefreshToken: session.refreshToken,
        networkErrorCode: 'refresh_failed',
      })
      return {
        ...session,
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshToken: tokens.refreshToken,
        grantedScopes: tokens.grantedScopes,
      }
    },
    revoke: async (session) => {
      requireProviderSession(session, issuer, clientId)
      let response: Response
      try {
        response = await request(new URL('/oauth/token/revoke', issuer), {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            token: session.refreshToken,
            token_type_hint: 'refresh_token',
          }),
          redirect: 'manual',
          signal: AbortSignal.timeout(requestTimeoutMs),
        })
      } catch {
        return false
      }
      return response.ok
    },
  }
}

export const beginClerkOAuth = async (
  options: ClerkOAuthOptions,
  dependencies: ClerkOAuthDependencies = {},
): Promise<ClerkOAuthAttempt> => {
  const configuration = oauthConfigurationFrom(options)
  const randomBytes = dependencies.randomBytes ?? nodeRandomBytes
  const verifier = randomValue(randomBytes)
  const state = randomValue(randomBytes)
  const callback = await listenForOAuthCallback(configuration.issuer.origin, state)
  try {
    const browserURL = authorizationBrowserURL(configuration, callback.redirectURI, verifier, state)
    callback.startTimeout(configuration.timeoutMs)
    return clerkOAuthAttempt(browserURL, verifier, callback, configuration, dependencies)
  } catch (error: unknown) {
    await callback.cancel()
    throw error
  }
}

const oauthConfigurationFrom = (options: ClerkOAuthOptions): OAuthConfiguration => {
  const timeoutMs = options.timeoutMs ?? defaultLoginTimeoutMs
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new ClerkOAuthError('invalid_configuration')
  }
  return {
    issuer: validIssuer(options.issuer),
    clientId: validClientId(options.clientId),
    ...(options.signInURL === undefined ? {} : { signInURL: validSignInURL(options.signInURL) }),
    timeoutMs,
  }
}

const listenForOAuthCallback = async (
  issuer: string,
  expectedState: string,
): Promise<OAuthCallbackListener> => {
  const result = deferred<string>()
  // The browser may return before complete() observes the result.
  void result.promise.catch(() => undefined)
  const state: CallbackState = { result, issuer, state: expectedState, settled: false }
  const server = createServer()
  server.on('request', (request, response) => handleOAuthCallback(server, state, request, response))
  await listenOnLoopback(server)
  const address = server.address()
  if (!address || typeof address === 'string') {
    await closeServer(server)
    throw new ClerkOAuthError('callback_unavailable')
  }
  return {
    redirectURI: `http://127.0.0.1:${address.port}${callbackPath}`,
    result: result.promise,
    cancel: async () => {
      if (!state.settled) {
        state.settled = true
        result.reject(new ClerkOAuthError('login_cancelled'))
      }
      if (state.timer !== undefined) clearTimeout(state.timer)
      await closeServer(server)
    },
    startTimeout: (timeoutMs) => startLoginTimeout(server, state, timeoutMs),
  }
}

const handleOAuthCallback = (
  server: Server,
  state: CallbackState,
  request: IncomingMessage,
  response: ServerResponse,
): void => {
  const url = callbackURL(request, response)
  if (!url) return
  if (request.method !== 'GET' || url.pathname !== callbackPath) {
    writeCallbackResponse(response, 404, 'Not found')
    return
  }
  if (state.settled) {
    writeCallbackResponse(response, 410, 'Login attempt is already complete')
    return
  }
  const returnedStates = url.searchParams.getAll('state')
  if (returnedStates.length !== 1 || !equalSecret(returnedStates[0] ?? '', state.state)) {
    writeCallbackResponse(response, 400, 'Login response could not be verified')
    return
  }
  const returnedIssuers = url.searchParams.getAll('iss')
  if (returnedIssuers.length !== 1 || returnedIssuers[0] !== state.issuer) {
    settleCallback(state)
    finishOAuthCallback(server, state, response, 'Login response could not be verified', new ClerkOAuthError('issuer_mismatch'))
    return
  }
  settleCallback(state)
  const providerErrors = url.searchParams.getAll('error')
  const codes = url.searchParams.getAll('code')
  if (providerErrors.length > 0 && codes.length > 0) {
    finishOAuthCallback(server, state, response, 'Login response was incomplete', new ClerkOAuthError('invalid_callback'))
    return
  }
  if (providerErrors.length === 1) {
    const error = new ClerkOAuthError(oauthErrorCode(providerErrors[0] ?? ''), { stage: 'provider' })
    finishOAuthCallback(server, state, response, 'Login was not completed', error)
    return
  }
  const code = opaqueValue(codes[0], maxAuthorizationCodeLength)
  if (providerErrors.length > 1 || codes.length !== 1 || !code) {
    finishOAuthCallback(server, state, response, 'Login response was incomplete', new ClerkOAuthError('invalid_callback'))
    return
  }
  finishOAuthCallback(server, state, response, 'Dedalus CLI login received. You can close this window.', code)
}

const finishOAuthCallback = (
  server: Server,
  state: CallbackState,
  response: ServerResponse,
  message: string,
  result: string | ClerkOAuthError,
): void => {
  let complete = false
  const settleResponse = (aborted: boolean): void => {
    if (complete) return
    complete = true
    response.off('finish', onFinish)
    response.off('close', onClose)
    response.off('error', onError)
    if (aborted) state.result.reject(new ClerkOAuthError('callback_response_failed'))
    else if (result instanceof ClerkOAuthError) state.result.reject(result)
    else state.result.resolve(result)
    server.close()
  }
  const onFinish = (): void => settleResponse(false)
  const onClose = (): void => settleResponse(true)
  const onError = (): void => settleResponse(true)
  response.once('finish', onFinish)
  response.once('close', onClose)
  response.once('error', onError)
  writeCallbackResponse(response, result instanceof ClerkOAuthError ? 400 : 200, message)
}

const callbackURL = (request: IncomingMessage, response: ServerResponse): URL | undefined => {
  try {
    return new URL(request.url ?? '/', 'http://127.0.0.1')
  } catch {
    writeCallbackResponse(response, 400, 'Invalid request')
    return undefined
  }
}

const writeCallbackResponse = (response: ServerResponse, status: number, message: string): void => {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
  })
  response.end(message)
}

const settleCallback = (state: CallbackState): void => {
  state.settled = true
  if (state.timer !== undefined) clearTimeout(state.timer)
}

const startLoginTimeout = (server: Server, state: CallbackState, timeoutMs: number): void => {
  state.timer = setTimeout(() => {
    if (state.settled) return
    state.settled = true
    state.result.reject(new ClerkOAuthError('login_timeout'))
    void closeServer(server).catch(() => undefined)
  }, timeoutMs)
  state.timer.unref()
}

const authorizationBrowserURL = (
  configuration: OAuthConfiguration,
  redirectURI: string,
  verifier: string,
  state: string,
): URL => {
  const authorizationURL = new URL('/oauth/authorize', configuration.issuer)
  authorizationURL.search = new URLSearchParams({
    response_type: 'code',
    client_id: configuration.clientId,
    redirect_uri: redirectURI,
    code_challenge: clerkPKCEChallenge(verifier),
    code_challenge_method: 'S256',
    state,
    scope: clerkOAuthScopes.join(' '),
  }).toString()
  if (authorizationURL.toString().length > maxAuthorizationURLLength) {
    throw new ClerkOAuthError('invalid_configuration')
  }
  return configuration.signInURL === undefined
    ? authorizationURL
    : wrappedAuthorizationURL(configuration.signInURL, authorizationURL)
}

const clerkOAuthAttempt = (
  authorizationURL: URL,
  verifier: string,
  callback: OAuthCallbackListener,
  configuration: OAuthConfiguration,
  dependencies: ClerkOAuthDependencies,
): ClerkOAuthAttempt => {
  let completion: Promise<OAuthSession> | undefined
  return {
    authorizationURL: authorizationURL.toString(),
    redirectURI: callback.redirectURI,
    complete: () => {
      completion ??= callback.result.then((code) => completeOAuth(
        code,
        callback.redirectURI,
        verifier,
        configuration,
        dependencies,
      ))
      return completion
    },
    cancel: callback.cancel,
  }
}

const completeOAuth = async (
  code: string,
  redirectURI: string,
  verifier: string,
  configuration: OAuthConfiguration,
  dependencies: ClerkOAuthDependencies,
): Promise<OAuthSession> => {
  const request = dependencies.fetch ?? globalThis.fetch
  const tokens = await requestTokenSet({
    issuer: configuration.issuer,
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: configuration.clientId,
      code,
      redirect_uri: redirectURI,
      code_verifier: verifier,
    }),
    request,
    now: dependencies.now ?? Date.now,
    networkErrorCode: 'token_exchange_failed',
  })
  const user = await fetchUserInfo(configuration.issuer, tokens.accessToken, request)
  return sessionFrom(configuration.issuer.origin, configuration.clientId, tokens, user)
}

const sessionFrom = (
  issuer: string,
  clientId: string,
  tokens: TokenSet,
  user: UserInfo,
  providerSessionId?: string,
): OAuthSession => ({
  version: 1,
  issuer,
  clientId,
  accessToken: tokens.accessToken,
  accessTokenExpiresAt: tokens.accessTokenExpiresAt,
  refreshToken: tokens.refreshToken,
  userId: user.userId,
  organizationId: user.organizationId,
  ...(user.organizationName === undefined ? {} : { organizationName: user.organizationName }),
  grantedScopes: tokens.grantedScopes,
  ...(providerSessionId === undefined ? {} : { providerSessionId }),
})

const requireProviderSession = (session: OAuthSession, issuer: string, clientId: string): void => {
  if (session.issuer !== issuer || session.clientId !== clientId) {
    throw new ClerkOAuthError('session_provider_mismatch')
  }
}

const validIssuer = (raw: string): URL => {
  try {
    if (raw.length > maxOAuthDisplayLength || raw !== raw.trim()) {
      throw new ClerkOAuthError('invalid_configuration')
    }
    const issuer = new URL(raw)
    if (
      issuer.protocol !== 'https:' ||
      issuer.username ||
      issuer.password ||
      issuer.search ||
      issuer.hash ||
      (issuer.pathname !== '/' && issuer.pathname !== '')
    ) {
      throw new ClerkOAuthError('invalid_configuration')
    }
    return issuer
  } catch (error: unknown) {
    if (error instanceof ClerkOAuthError) throw error
    throw new ClerkOAuthError('invalid_configuration', { cause: error })
  }
}

const validSignInURL = (raw: string): URL => {
  try {
    if (raw.length > maxOAuthDisplayLength || raw !== raw.trim()) {
      throw new ClerkOAuthError('invalid_configuration')
    }
    const signInURL = new URL(raw)
    const loopbackHTTP = signInURL.protocol === 'http:' &&
      (signInURL.hostname === '127.0.0.1' || signInURL.hostname === 'localhost')
    if (
      (signInURL.protocol !== 'https:' && !loopbackHTTP) ||
      signInURL.username ||
      signInURL.password ||
      signInURL.search ||
      signInURL.hash ||
      signInURL.pathname !== '/cli/sign-in'
    ) {
      throw new ClerkOAuthError('invalid_configuration')
    }
    return signInURL
  } catch (error: unknown) {
    if (error instanceof ClerkOAuthError) throw error
    throw new ClerkOAuthError('invalid_configuration', { cause: error })
  }
}

const wrappedAuthorizationURL = (signInURL: URL, authorizationURL: URL): URL => {
  const browserURL = new URL(signInURL)
  // Fragments are not sent in HTTP requests, access logs, or Referer headers.
  browserURL.hash = new URLSearchParams({ authorization_url: authorizationURL.toString() }).toString()
  return browserURL
}

const validClientId = (raw: string): string => {
  if (!opaqueValue(raw, maxOAuthIdentifierLength)) throw new ClerkOAuthError('invalid_configuration')
  return raw
}

const randomValue = (randomBytes: (size: number) => Uint8Array): string => {
  const value = randomBytes(32)
  if (value.byteLength !== 32) throw new ClerkOAuthError('invalid_configuration')
  return Buffer.from(value).toString('base64url')
}

const defaultOpenBrowser = async (url: string): Promise<void> => {
  const { default: open } = await import('open')
  await open(url)
}
