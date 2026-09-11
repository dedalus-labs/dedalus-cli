// @custom start
/**
 * Validates OAuth token and session-identity responses from the Dedalus issuer.
 *
 * Remote payloads remain untrusted until this boundary verifies their shape,
 * size, required scopes, and expiry arithmetic.
 */

import { AuthProviderError, type AuthProviderErrorStage } from './types.js'

const maxOAuthIdentifierLength = 1024
const maxOAuthResponseBytes = 512 * 1024
const maxOAuthScopeCount = 32
const maxOAuthScopeLength = 256
const maxOAuthTokenLength = 128 * 1024
const requestTimeoutMs = 30 * 1000

export const dedalusOAuthScopes = ['offline_access', 'dedalus:cli'] as const

export type DedalusOAuthErrorCode = string
export type DedalusOAuthErrorStage = AuthProviderErrorStage

export class DedalusOAuthError extends AuthProviderError {
  constructor(
    code: DedalusOAuthErrorCode,
    options: ErrorOptions & {
      readonly stage?: DedalusOAuthErrorStage
      readonly status?: number
    } = {},
  ) {
    super(code, options)
    this.name = 'DedalusOAuthError'
  }
}

export type TokenSet = {
  readonly accessToken: string
  readonly accessTokenExpiresAt: number
  readonly refreshToken: string
  readonly grantedScopes: readonly string[]
}

export type UserInfo = {
  readonly userId: string
  readonly organizationId: string
}

type TokenRequest = {
  readonly issuer: URL
  readonly body: URLSearchParams
  readonly request: typeof globalThis.fetch
  readonly now: () => number
  readonly networkErrorCode: string
}

export const requestTokenSet = async ({
  issuer,
  body,
  request,
  now,
  networkErrorCode,
}: TokenRequest): Promise<TokenSet> => {
  let response: Response
  try {
    response = await request(new URL('/oauth2/token', issuer), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(requestTimeoutMs),
    })
  } catch (error: unknown) {
    throw new DedalusOAuthError(networkErrorCode, { cause: error, stage: 'network' })
  }

  const payload = await jsonObject(response)
  if (!response.ok) throw oauthHTTPError(response.status, payload)
  return tokenSetFrom(payload, response.status, now)
}

export const fetchUserInfo = async (
  issuer: URL,
  accessToken: string,
  request: typeof globalThis.fetch,
  clientId: string,
  resource: string,
  now: () => number,
): Promise<UserInfo> => {
  let response: Response
  try {
    response = await request(new URL('/oauth2/userinfo', issuer), {
      headers: { Authorization: `Bearer ${accessToken}` },
      redirect: 'manual',
      signal: AbortSignal.timeout(requestTimeoutMs),
    })
  } catch (error: unknown) {
    throw new DedalusOAuthError('userinfo_failed', { cause: error, stage: 'network' })
  }
  const payload = await jsonObject(response)
  if (!response.ok) throw oauthHTTPError(response.status, payload)

  const userId = opaqueValue(payload.sub, maxOAuthIdentifierLength)
  const organizationId = opaqueValue(payload.org_id, maxOAuthIdentifierLength)
  if (
    !userId ||
    !organizationId ||
    payload.iss !== issuer.origin ||
    payload.client_id !== clientId ||
    payload.aud !== resource ||
    typeof payload.exp !== 'number' ||
    !Number.isSafeInteger(payload.exp) ||
    payload.exp * 1000 <= now()
  ) {
    throw new DedalusOAuthError('invalid_userinfo_response', { status: response.status })
  }
  grantedScopesFrom(payload.scope, response.status)
  return {
    userId,
    organizationId,
  }
}

export const oauthErrorCode = (value: string): DedalusOAuthErrorCode => {
  if (!value || value.length > 256) return 'oauth_error'
  for (const character of value) {
    const code = character.charCodeAt(0)
    const allowed =
      (code >= 0x20 && code <= 0x21) ||
      (code >= 0x23 && code <= 0x5b) ||
      (code >= 0x5d && code <= 0x7e)
    if (!allowed) return 'oauth_error'
  }
  return value
}

export const opaqueValue = (value: unknown, maximumLength = maxOAuthTokenLength): string => {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximumLength) return ''
  for (const character of value) {
    const code = character.charCodeAt(0)
    if (code < 0x21 || code > 0x7e) return ''
  }
  return value
}

const tokenSetFrom = (
  payload: Readonly<Record<string, unknown>>,
  responseStatus: number,
  now: () => number,
): TokenSet => {
  const accessToken = opaqueValue(payload.access_token)
  const refreshToken = opaqueValue(payload.refresh_token)
  const tokenType = opaqueValue(payload.token_type, 32).toLowerCase()
  const expiresIn = payload.expires_in
  if (!accessToken || !refreshToken || !validTokenFields(tokenType, expiresIn)) {
    throw new DedalusOAuthError('invalid_token_response', { status: responseStatus })
  }

  const grantedScopes = grantedScopesFrom(payload.scope, responseStatus)
  const issuedAt = now()
  const accessTokenExpiresAt = issuedAt + expiresIn * 1000
  if (!validExpiry(issuedAt, accessTokenExpiresAt)) {
    throw new DedalusOAuthError('invalid_token_response', { status: responseStatus })
  }
  return { accessToken, accessTokenExpiresAt, refreshToken, grantedScopes }
}

const validTokenFields = (tokenType: string, expiresIn: unknown): expiresIn is number =>
  tokenType === 'bearer' &&
  typeof expiresIn === 'number' &&
  Number.isSafeInteger(expiresIn) &&
  expiresIn > 0

const grantedScopesFrom = (value: unknown, responseStatus: number): readonly string[] => {
  if (typeof value !== 'string') {
    throw new DedalusOAuthError('invalid_scope', { status: responseStatus })
  }
  const grantedScopes = uniqueScopes(value, responseStatus)
  if (
    grantedScopes.length !== dedalusOAuthScopes.length ||
    dedalusOAuthScopes.some((scope) => !grantedScopes.includes(scope))
  ) {
    throw new DedalusOAuthError('invalid_scope', { status: responseStatus })
  }
  return grantedScopes
}

const validExpiry = (issuedAt: number, expiresAt: number): boolean =>
  Number.isSafeInteger(issuedAt) &&
  issuedAt >= 0 &&
  Number.isSafeInteger(expiresAt) &&
  expiresAt > issuedAt &&
  !Number.isNaN(new Date(expiresAt).getTime())

const jsonObject = async (response: Response): Promise<Record<string, unknown>> => {
  const raw = await boundedResponseText(response, maxOAuthResponseBytes)
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch (cause) {
    throw new DedalusOAuthError('invalid_json_response', { cause, status: response.status })
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    throw new DedalusOAuthError('invalid_json_response', { status: response.status })
  return payload as Record<string, unknown>
}

const boundedResponseText = async (response: Response, maximumBytes: number): Promise<string> => {
  if (responseTooLarge(response, maximumBytes)) {
    const error = new DedalusOAuthError('response_too_large', { status: response.status })
    try {
      await response.body?.cancel()
    } catch (cause) {
      throw new AggregateError(
        [error, new DedalusOAuthError('response_cleanup_failed', { cause })],
        'OAuth response rejected and cleanup failed',
      )
    }
    throw error
  }
  if (!response.body) return ''

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  const failures: unknown[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maximumBytes) {
        throw new DedalusOAuthError('response_too_large', { status: response.status })
      }
      chunks.push(value)
    }
  } catch (cause) {
    failures.push(
      cause instanceof DedalusOAuthError
        ? cause
        : new DedalusOAuthError('response_read_failed', { cause }),
    )
    try {
      await reader.cancel()
    } catch (cause) {
      failures.push(new DedalusOAuthError('response_cleanup_failed', { cause }))
    }
  }
  try {
    reader.releaseLock()
  } catch (cause) {
    failures.push(new DedalusOAuthError('response_cleanup_failed', { cause }))
  }
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1)
    throw new AggregateError(failures, 'OAuth response read and cleanup failed')
  try {
    return decodeChunks(chunks, total)
  } catch (cause) {
    throw new DedalusOAuthError('invalid_response_encoding', { cause, status: response.status })
  }
}

const responseTooLarge = (response: Response, maximumBytes: number): boolean => {
  const contentLength = response.headers.get('content-length')
  if (contentLength === null) return false
  const parsed = Number(contentLength)
  return Number.isFinite(parsed) && parsed > maximumBytes
}

const decodeChunks = (chunks: readonly Uint8Array[], total: number): string => {
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

const oauthHTTPError = (
  status: number,
  payload: Readonly<Record<string, unknown>>,
): DedalusOAuthError =>
  new DedalusOAuthError(
    typeof payload.error === 'string' ? oauthErrorCode(payload.error) : 'oauth_error',
    { stage: 'provider', status },
  )

const uniqueScopes = (value: string, responseStatus: number): readonly string[] => {
  if (value.length > maxOAuthScopeCount * (maxOAuthScopeLength + 1)) {
    throw new DedalusOAuthError('invalid_scope', { status: responseStatus })
  }
  const scopes = [...new Set(value.split(/\s+/).filter(Boolean))]
  if (
    scopes.length > maxOAuthScopeCount ||
    scopes.some((scope) => !opaqueValue(scope, maxOAuthScopeLength))
  ) {
    throw new DedalusOAuthError('invalid_scope', { status: responseStatus })
  }
  return scopes
}
// @custom end
