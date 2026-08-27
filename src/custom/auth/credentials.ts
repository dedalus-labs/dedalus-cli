import { randomUUID } from 'node:crypto'
import { constants, type Stats } from 'node:fs'
import { type FileHandle, lstat, mkdir, open, rename, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import lockfile from 'proper-lockfile'

import type { OAuthSession } from './types.js'

const credentialService = 'com.dedalus.cli'
const credentialAccount = 'default'
const maxCredentialFileBytes = 512 * 1024
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

export type CredentialStore = {
  readonly backend: 'file' | 'keyring'
  readonly read: () => Promise<OAuthSession | null>
  readonly write: (session: OAuthSession) => Promise<void>
  readonly remove: () => Promise<boolean>
  readonly withLifecycleLock: <T>(operation: () => Promise<T>) => Promise<T>
}

export type ResolvedCredential = {
  readonly value: string
  readonly source: 'environment' | 'flag' | 'oauth_session'
  readonly transport: 'bearer' | 'x-api-key'
}

export type CredentialResolutionOptions = {
  readonly flags: {
    readonly apiKey?: string
    readonly bearerAuth?: string
    readonly xApiKey?: string
  }
  readonly environment?: Readonly<Record<string, string | undefined>>
  readonly storedAccessToken: () => Promise<string | null>
}

export type DefaultCredentialStoreOptions = {
  readonly environment?: Readonly<Record<string, string | undefined>>
  readonly platform?: NodeJS.Platform
  readonly credentialPath?: string
}

type KeyringEntry = {
  readonly getPassword: () => Promise<string | null | undefined>
  readonly setPassword: (password: string) => Promise<void>
  readonly deleteCredential: () => Promise<boolean>
}

type KeyringEntryFactory = () => Promise<KeyringEntry>

const lifecycleLockOptions = {
  realpath: false,
  retries: { retries: 120, factor: 1, minTimeout: 250, maxTimeout: 250 },
  stale: 15 * 60 * 1000,
  update: 30 * 1000,
} as const
