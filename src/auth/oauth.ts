// @custom start
/**
 * Dedalus OAuth 2.0 Authorization Code flow for the command-line interface.
 *
 * The flow uses Proof Key for Code Exchange (PKCE) and a one-use loopback
 * callback. It returns a provider-neutral session for storage and refresh.
 */

import { createHash, randomBytes as nodeRandomBytes } from 'node:crypto'

import {
  dedalusOAuthScopes,
  DedalusOAuthError,
  fetchUserInfo,
  opaqueValue,
  requestTokenSet,
  type TokenSet,
  type UserInfo,
} from './oauth-http.js'
import { listenForOAuthCallback, type OAuthCallbackListener } from './oauth-callback.js'
import { validIssuer, validSignInURL } from './oauth-configuration.js'
import type { AuthProvider, OAuthSession } from './types.js'

export {
  DedalusOAuthError,
  type DedalusOAuthErrorCode,
  type DedalusOAuthErrorStage,
} from './oauth-http.js'

const defaultLoginTimeoutMs = 10 * 60 * 1000
const maxAuthorizationURLLength = 4 * 1024
const maxOAuthIdentifierLength = 1024
const requestTimeoutMs = 30 * 1000

export type DedalusOAuthOptions = {
  readonly issuer: string
  readonly clientId: string
  readonly resource: string
  readonly gatewayURL: string
  readonly signInURL?: string
  readonly timeoutMs?: number
}

export type DedalusOAuthDependencies = {
  readonly fetch?: typeof globalThis.fetch
  readonly now?: () => number
  readonly openBrowser?: (url: string) => Promise<void>
  readonly randomBytes?: (size: number) => Uint8Array
}

export type DedalusOAuthAttempt = {
  readonly authorizationURL: string
  readonly redirectURI: string
  readonly complete: () => Promise<OAuthSession>
  readonly cancel: () => Promise<void>
}

type OAuthConfiguration = {
  readonly clientId: string
  readonly issuer: URL
  readonly resource: string
  readonly gatewayURL: string
  readonly signInURL?: URL
  readonly timeoutMs: number
}

export const pkceChallenge = (verifier: string): string =>
  createHash('sha256').update(verifier, 'ascii').digest('base64url')

export const createDedalusAuthProvider = (
  options: DedalusOAuthOptions,
  dependencies: DedalusOAuthDependencies = {},
): AuthProvider => {
  const issuer = validIssuer(options.issuer).origin
  const clientId = validClientId(options.clientId)
  const resource = validIssuer(options.resource).origin
  const gatewayURL = validGatewayURL(options.gatewayURL)
  const request = dependencies.fetch ?? globalThis.fetch
  const now = dependencies.now ?? Date.now

  return {
    issuer,
    clientId,
    resource,
    gatewayURL,
    login: async () => {
      const attempt = await beginDedalusOAuth({ ...options, issuer, clientId }, dependencies)
      try {
        const openBrowser = dependencies.openBrowser ?? defaultOpenBrowser
        await openBrowser(attempt.authorizationURL)
      } catch (error: unknown) {
        const failure = new DedalusOAuthError('browser_open_failed', { cause: error })
        try {
          await attempt.cancel()
        } catch (cleanup) {
          throw new AggregateError([failure, cleanup], 'Browser launch and callback cleanup failed')
        }
        throw failure
      }
      return attempt.complete()
    },
    refresh: async (session) => {
      requireProviderSession(session, issuer, clientId, resource, gatewayURL)
      const tokens = await requestTokenSet({
        issuer: new URL(issuer),
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          refresh_token: session.refreshToken,
          resource,
        }),
        request,
        now,
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
      requireProviderSession(session, issuer, clientId, resource, gatewayURL)
      for (const [token, hint] of [
        [session.refreshToken, 'refresh_token'],
        [session.accessToken, 'access_token'],
      ] as const) {
        let response: Response
        try {
          response = await request(new URL('/oauth2/revoke', issuer), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              token,
              token_type_hint: hint,
            }),
            redirect: 'manual',
            signal: AbortSignal.timeout(requestTimeoutMs),
          })
        } catch (cause) {
          throw new DedalusOAuthError('revocation_failed', { cause, stage: 'network' })
        }
        const rejected = new DedalusOAuthError('revocation_failed', {
          stage: 'provider',
          status: response.status,
        })
        try {
          await response.body?.cancel()
        } catch (cause) {
          const cleanup = new DedalusOAuthError('response_cleanup_failed', { cause })
          if (response.status !== 200)
            throw new AggregateError([rejected, cleanup], 'Revocation and cleanup failed')
          throw cleanup
        }
        if (response.status !== 200) throw rejected
      }
      return true
    },
  }
}

export const beginDedalusOAuth = async (
  options: DedalusOAuthOptions,
  dependencies: DedalusOAuthDependencies = {},
): Promise<DedalusOAuthAttempt> => {
  const configuration = oauthConfigurationFrom(options)
  const randomBytes = dependencies.randomBytes ?? nodeRandomBytes
  const verifier = randomValue(randomBytes)
  const state = randomValue(randomBytes)
  const callback = await listenForOAuthCallback(configuration.issuer.origin, state)
  try {
    const browserURL = authorizationBrowserURL(configuration, callback.redirectURI, verifier, state)
    callback.startTimeout(configuration.timeoutMs)
    return dedalusOAuthAttempt(browserURL, verifier, callback, configuration, dependencies)
  } catch (error: unknown) {
    try {
      await callback.cancel()
    } catch (cleanup) {
      throw new AggregateError([error, cleanup], 'OAuth setup and callback cleanup failed')
    }
    throw error
  }
}

const oauthConfigurationFrom = (options: DedalusOAuthOptions): OAuthConfiguration => {
  const timeoutMs = options.timeoutMs ?? defaultLoginTimeoutMs
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new DedalusOAuthError('invalid_configuration')
  }
  return {
    issuer: validIssuer(options.issuer),
    clientId: validClientId(options.clientId),
    resource: validIssuer(options.resource).origin,
    gatewayURL: validGatewayURL(options.gatewayURL),
    ...(options.signInURL === undefined ? {} : { signInURL: validSignInURL(options.signInURL) }),
    timeoutMs,
  }
}

const authorizationBrowserURL = (
  configuration: OAuthConfiguration,
  redirectURI: string,
  verifier: string,
  state: string,
): URL => {
  const authorizationURL = new URL('/oauth2/auth', configuration.issuer)
  authorizationURL.search = new URLSearchParams({
    response_type: 'code',
    client_id: configuration.clientId,
    redirect_uri: redirectURI,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: 'S256',
    state,
    scope: dedalusOAuthScopes.join(' '),
    resource: configuration.resource,
  }).toString()
  if (authorizationURL.toString().length > maxAuthorizationURLLength) {
    throw new DedalusOAuthError('invalid_configuration')
  }
  return configuration.signInURL === undefined
    ? authorizationURL
    : wrappedAuthorizationURL(configuration.signInURL, authorizationURL)
}

const dedalusOAuthAttempt = (
  authorizationURL: URL,
  verifier: string,
  callback: OAuthCallbackListener,
  configuration: OAuthConfiguration,
  dependencies: DedalusOAuthDependencies,
): DedalusOAuthAttempt => {
  let completion: Promise<OAuthSession> | undefined
  return {
    authorizationURL: authorizationURL.toString(),
    redirectURI: callback.redirectURI,
    complete: () => {
      completion ??= callback.result.then((outcome) => {
        if ('error' in outcome) throw outcome.error
        return completeOAuth(
          outcome.code,
          callback.redirectURI,
          verifier,
          configuration,
          dependencies,
        )
      })
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
  dependencies: DedalusOAuthDependencies,
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
      resource: configuration.resource,
    }),
    request,
    now: dependencies.now ?? Date.now,
    networkErrorCode: 'token_exchange_failed',
  })
  const user = await fetchUserInfo(
    configuration.issuer,
    tokens.accessToken,
    request,
    configuration.clientId,
    configuration.resource,
    dependencies.now ?? Date.now,
  )
  return sessionFrom(configuration, tokens, user)
}

const sessionFrom = (
  configuration: OAuthConfiguration,
  tokens: TokenSet,
  user: UserInfo,
): OAuthSession => ({
  version: 1,
  issuer: configuration.issuer.origin,
  clientId: configuration.clientId,
  resource: configuration.resource,
  gatewayURL: configuration.gatewayURL,
  accessToken: tokens.accessToken,
  accessTokenExpiresAt: tokens.accessTokenExpiresAt,
  refreshToken: tokens.refreshToken,
  userId: user.userId,
  organizationId: user.organizationId,
  grantedScopes: tokens.grantedScopes,
})

const requireProviderSession = (
  session: OAuthSession,
  issuer: string,
  clientId: string,
  resource: string,
  gatewayURL: string,
): void => {
  if (
    session.issuer !== issuer ||
    session.clientId !== clientId ||
    session.resource !== resource ||
    session.gatewayURL !== gatewayURL
  ) {
    throw new DedalusOAuthError('session_provider_mismatch')
  }
}

const wrappedAuthorizationURL = (signInURL: URL, authorizationURL: URL): URL => {
  const browserURL = new URL(signInURL)
  // Fragments are not sent in HTTP requests, access logs, or Referer headers.
  browserURL.hash = new URLSearchParams({
    authorization_url: authorizationURL.toString(),
  }).toString()
  return browserURL
}

const validClientId = (raw: string): string => {
  if (!opaqueValue(raw, maxOAuthIdentifierLength))
    throw new DedalusOAuthError('invalid_configuration')
  return raw
}

const validGatewayURL = (raw: string): string => {
  const url = new URL(raw)
  validIssuer(url.origin)
  if (raw !== url.origin + '/dcs') throw new DedalusOAuthError('invalid_configuration')
  return raw
}

const randomValue = (randomBytes: (size: number) => Uint8Array): string => {
  const value = randomBytes(32)
  if (value.byteLength !== 32) throw new DedalusOAuthError('invalid_configuration')
  return Buffer.from(value).toString('base64url')
}

const defaultOpenBrowser = async (url: string): Promise<void> => {
  const { default: open } = await import('open')
  await open(url)
}
// @custom end
