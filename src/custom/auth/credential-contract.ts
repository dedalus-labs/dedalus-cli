/**
 * Persistent OAuth session format and credential storage error contract.
 *
 * Storage adapters use this module to validate untrusted serialized sessions before
 * exposing them to the command workflow. The format is versioned so incompatible
 * changes fail closed instead of silently changing authentication behavior.
 */

import type { OAuthSession } from './types.js'

export const maxCredentialFileBytes = 512 * 1024

const maxCredentialMetadataLength = 4 * 1024
const maxCredentialScopeCount = 32
const maxCredentialScopeLength = 256
const maxCredentialTokenLength = 128 * 1024

export type CredentialStorageErrorCode =
  | 'ambiguous_credential'
  | 'insecure_permissions'
  | 'environment_mismatch'
  | 'invalid_configuration'
  | 'invalid_credential'
  | 'not_logged_in'
  | 'storage_unavailable'
  | 'unsupported_credential'

export class CredentialStorageError extends Error {
  readonly code: CredentialStorageErrorCode

  constructor(code: CredentialStorageErrorCode, options?: ErrorOptions) {
    super(code, options)
    this.name = 'CredentialStorageError'
    this.code = code
  }
}

export const serializeOAuthSession = (session: OAuthSession): string => JSON.stringify({
  version: 1,
  issuer: validStoredIssuer(session.issuer),
  client_id: validIdentifier(session.clientId),
  access_token: validCredentialToken(session.accessToken),
  access_token_expires_at: validExpiry(session.accessTokenExpiresAt),
  refresh_token: validCredentialToken(session.refreshToken),
  user_id: validIdentifier(session.userId),
  org_id: validIdentifier(session.organizationId),
  ...(session.organizationName === undefined
    ? {}
    : { org_display_name: validMetadata(session.organizationName) }),
  granted_scopes: validScopes(session.grantedScopes),
  ...(session.providerSessionId === undefined
    ? {}
    : { provider_session_id: validIdentifier(session.providerSessionId) }),
})

export const decodeOAuthSession = (raw: string): OAuthSession => {
  try {
    if (Buffer.byteLength(raw, 'utf8') > maxCredentialFileBytes) {
      throw new CredentialStorageError('invalid_credential')
    }
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new CredentialStorageError('invalid_credential')
    }
    const record = value as Record<string, unknown>
    if (
      record.version !== 1 ||
      typeof record.issuer !== 'string' ||
      typeof record.client_id !== 'string' ||
      typeof record.access_token !== 'string' ||
      typeof record.access_token_expires_at !== 'number' ||
      typeof record.refresh_token !== 'string' ||
      typeof record.user_id !== 'string' ||
      typeof record.org_id !== 'string' ||
      !Array.isArray(record.granted_scopes) ||
      (record.org_display_name !== undefined && typeof record.org_display_name !== 'string') ||
      (record.provider_session_id !== undefined && typeof record.provider_session_id !== 'string')
    ) {
      throw new CredentialStorageError('invalid_credential')
    }
    const organizationName = record.org_display_name as string | undefined
    const providerSessionId = record.provider_session_id as string | undefined
    return {
      version: 1,
      issuer: validStoredIssuer(record.issuer),
      clientId: validIdentifier(record.client_id),
      accessToken: validCredentialToken(record.access_token),
      accessTokenExpiresAt: validExpiry(record.access_token_expires_at),
      refreshToken: validCredentialToken(record.refresh_token),
      userId: validIdentifier(record.user_id),
      organizationId: validIdentifier(record.org_id),
      ...(organizationName === undefined ? {} : { organizationName: validMetadata(organizationName) }),
      grantedScopes: validScopes(record.granted_scopes),
      ...(providerSessionId === undefined ? {} : { providerSessionId: validIdentifier(providerSessionId) }),
    }
  } catch (error) {
    if (error instanceof CredentialStorageError) throw error
    throw new CredentialStorageError('invalid_credential', { cause: error })
  }
}

export const validCredentialToken = (value: string): string => {
  if (value.length > maxCredentialTokenLength || !isVisibleASCII(value)) {
    throw new CredentialStorageError('invalid_credential')
  }
  return value
}

export const storageError = (error: unknown): CredentialStorageError => error instanceof CredentialStorageError
  ? error
  : isSymlink(error)
    ? new CredentialStorageError('insecure_permissions', { cause: error })
    : new CredentialStorageError('storage_unavailable', { cause: error })

export const isMissing = (error: unknown): boolean => error instanceof Error
  && 'code' in error
  && error.code === 'ENOENT'

const isVisibleASCII = (value: string): boolean => {
  if (!value) return false
  for (const character of value) {
    const code = character.charCodeAt(0)
    if (code < 0x21 || code > 0x7e) return false
  }
  return true
}

const validStoredIssuer = (value: string): string => {
  try {
    if (value.length > maxCredentialMetadataLength) {
      throw new CredentialStorageError('invalid_credential')
    }
    const issuer = new URL(value)
    if (
      issuer.protocol !== 'https:' ||
      issuer.username ||
      issuer.password ||
      issuer.search ||
      issuer.hash ||
      (issuer.pathname !== '/' && issuer.pathname !== '')
    ) {
      throw new CredentialStorageError('invalid_credential')
    }
    return issuer.origin
  } catch (error) {
    if (error instanceof CredentialStorageError) throw error
    throw new CredentialStorageError('invalid_credential', { cause: error })
  }
}

const validIdentifier = (value: string): string => {
  if (value.length > maxCredentialMetadataLength) {
    throw new CredentialStorageError('invalid_credential')
  }
  return validCredentialToken(value)
}

const validExpiry = (value: number): number => {
  if (
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    Number.isNaN(new Date(value).getTime())
  ) {
    throw new CredentialStorageError('invalid_credential')
  }
  return value
}

const validMetadata = (value: string): string => {
  if (
    !value ||
    value.length > maxCredentialMetadataLength ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f-\u009f]/u.test(value)
  ) {
    throw new CredentialStorageError('invalid_credential')
  }
  return value
}

const validScopes = (value: readonly unknown[]): readonly string[] => {
  if (
    value.length === 0 ||
    value.length > maxCredentialScopeCount ||
    value.some((scope) => typeof scope !== 'string')
  ) {
    throw new CredentialStorageError('invalid_credential')
  }
  const scopes = value.map((scope) => {
    const candidate = scope as string
    if (candidate.length > maxCredentialScopeLength) {
      throw new CredentialStorageError('invalid_credential')
    }
    return validCredentialToken(candidate)
  })
  if (new Set(scopes).size !== scopes.length) throw new CredentialStorageError('invalid_credential')
  return scopes
}

const isSymlink = (error: unknown): boolean => error instanceof Error
  && 'code' in error
  && error.code === 'ELOOP'
