/**
 * Validates OAuth token and user-info responses from the Clerk issuer.
 *
 * Remote payloads remain untrusted until this boundary verifies their shape,
 * size, required scopes, and expiry arithmetic.
 */

import { AuthProviderError, type AuthProviderErrorStage } from './types.js'

const maxOAuthDisplayLength = 4 * 1024
const maxOAuthIdentifierLength = 1024
const maxOAuthResponseBytes = 512 * 1024
const maxOAuthScopeCount = 32
const maxOAuthScopeLength = 256
const maxOAuthTokenLength = 128 * 1024
const requestTimeoutMs = 30 * 1000

export const clerkOAuthScopes = ['offline_access', 'user:org:read'] as const

export type ClerkOAuthErrorCode = string
export type ClerkOAuthErrorStage = AuthProviderErrorStage

export class ClerkOAuthError extends AuthProviderError {
  constructor(
    code: ClerkOAuthErrorCode,
    options: ErrorOptions & {
      readonly stage?: ClerkOAuthErrorStage
      readonly status?: number
    } = {},
  ) {
    super(code, options)
    this.name = 'ClerkOAuthError'
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
  readonly organizationName?: string
}

type TokenRequest = {
  readonly issuer: URL
  readonly body: URLSearchParams
  readonly request: typeof globalThis.fetch
  readonly now: () => number
  readonly previousRefreshToken?: string
  readonly networkErrorCode: string
}

export const requestTokenSet = async ({
  issuer,
  body,
  request,
  now,
  previousRefreshToken,
  networkErrorCode,
}: TokenRequest): Promise<TokenSet> => {
  let response: Response
  try {
    response = await request(new URL('/oauth/token', issuer), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(requestTimeoutMs),
    })
  } catch (error: unknown) {
    throw new ClerkOAuthError(networkErrorCode, { cause: error, stage: 'network' })
  }

  const payload = await jsonObject(response)
  if (!response.ok) throw oauthHTTPError(response.status, payload)
  return tokenSetFrom(payload, response.status, now, previousRefreshToken)
}

export const fetchUserInfo = async (
  issuer: URL,
  accessToken: string,
  request: typeof globalThis.fetch,
): Promise<UserInfo> => {
  let response: Response
  try {
    response = await request(new URL('/oauth/userinfo', issuer), {
      headers: { Authorization: `Bearer ${accessToken}` },
      redirect: 'manual',
      signal: AbortSignal.timeout(requestTimeoutMs),
    })
  } catch (error: unknown) {
    throw new ClerkOAuthError('userinfo_failed', { cause: error, stage: 'network' })
  }
  const payload = await jsonObject(response)
  if (!response.ok) throw oauthHTTPError(response.status, payload)

  const userId = opaqueValue(payload.sub, maxOAuthIdentifierLength)
  const organizationId = opaqueValue(payload.org_id, maxOAuthIdentifierLength)
  const organizationName = displayValue(payload.org_name)
  if (!userId || !organizationId) {
    throw new ClerkOAuthError('invalid_userinfo_response', { status: response.status })
  }
  return {
    userId,
    organizationId,
    ...(organizationName ? { organizationName } : {}),
  }
}

export const oauthErrorCode = (value: string): ClerkOAuthErrorCode => {
  if (!value || value.length > 256) return 'oauth_error'
  for (const character of value) {
    const code = character.charCodeAt(0)
    const allowed = (code >= 0x20 && code <= 0x21) ||
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
  previousRefreshToken: string | undefined,
): TokenSet => {
  const accessToken = opaqueValue(payload.access_token)
  const returnedRefreshToken = opaqueValue(payload.refresh_token)
  if (payload.refresh_token !== undefined && !returnedRefreshToken) {
    throw new ClerkOAuthError('invalid_token_response', { status: responseStatus })
  }
  const refreshToken = returnedRefreshToken || previousRefreshToken
  const tokenType = opaqueValue(payload.token_type, 32).toLowerCase()
  const expiresIn = payload.expires_in
  if (!accessToken || !refreshToken || !validTokenFields(tokenType, expiresIn)) {
    throw new ClerkOAuthError('invalid_token_response', { status: responseStatus })
  }

  const grantedScopes = grantedScopesFrom(payload.scope, responseStatus)
  const issuedAt = now()
  const accessTokenExpiresAt = issuedAt + expiresIn * 1000
  if (!validExpiry(issuedAt, accessTokenExpiresAt)) {
    throw new ClerkOAuthError('invalid_token_response', { status: responseStatus })
  }
  return { accessToken, accessTokenExpiresAt, refreshToken, grantedScopes }
}

const validTokenFields = (
  tokenType: string,
  expiresIn: unknown,
): expiresIn is number => tokenType === 'bearer' &&
  typeof expiresIn === 'number' &&
  Number.isSafeInteger(expiresIn) &&
  expiresIn > 0

const grantedScopesFrom = (value: unknown, responseStatus: number): readonly string[] => {
  if (value !== undefined && typeof value !== 'string') {
    throw new ClerkOAuthError('invalid_scope', { status: responseStatus })
  }
  const grantedScopes = value === undefined
    ? [...clerkOAuthScopes]
    : uniqueScopes(value, responseStatus)
  if (
    grantedScopes.length !== clerkOAuthScopes.length ||
    clerkOAuthScopes.some((scope) => !grantedScopes.includes(scope))
  ) {
    throw new ClerkOAuthError('invalid_scope', { status: responseStatus })
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
  try {
    const raw = await boundedResponseText(response, maxOAuthResponseBytes)
    if (raw === undefined) return {}
    const payload: unknown = JSON.parse(raw)
    return payload !== null && typeof payload === 'object' && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

const boundedResponseText = async (
  response: Response,
  maximumBytes: number,
): Promise<string | undefined> => {
  if (responseTooLarge(response, maximumBytes)) {
    await response.body?.cancel().catch(() => undefined)
    return undefined
  }
  if (!response.body) return ''

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maximumBytes) {
        await reader.cancel().catch(() => undefined)
        return undefined
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return decodeChunks(chunks, total)
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
): ClerkOAuthError => new ClerkOAuthError(
  typeof payload.error === 'string' ? oauthErrorCode(payload.error) : 'oauth_error',
  { stage: 'provider', status },
)

const displayValue = (value: unknown): string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= maxOAuthDisplayLength &&
  value === value.trim() &&
  !/[\u0000-\u001f\u007f-\u009f]/u.test(value)
    ? value
    : ''

const uniqueScopes = (value: string, responseStatus: number): readonly string[] => {
  if (value.length > maxOAuthScopeCount * (maxOAuthScopeLength + 1)) {
    throw new ClerkOAuthError('invalid_scope', { status: responseStatus })
  }
  const scopes = [...new Set(value.split(/\s+/).filter(Boolean))]
  if (
    scopes.length > maxOAuthScopeCount ||
    scopes.some((scope) => !opaqueValue(scope, maxOAuthScopeLength))
  ) {
    throw new ClerkOAuthError('invalid_scope', { status: responseStatus })
  }
  return scopes
}
