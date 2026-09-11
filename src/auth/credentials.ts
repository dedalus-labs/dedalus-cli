// @custom start
/**
 * Credential selection and native keyring storage for the Dedalus CLI.
 * A lifecycle lock serializes token changes across CLI processes.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import lockfile from 'proper-lockfile'

import {
  CredentialStorageError,
  decodeOAuthSession,
  serializeOAuthSession,
  storageError,
  validCredentialToken,
} from './credential-contract.js'
import type { OAuthSession } from './types.js'

export { CredentialStorageError } from './credential-contract.js'
export type { CredentialStorageErrorCode } from './credential-contract.js'

const credentialService = 'com.dedalus.cli'
const credentialAccount = 'default'

export type CredentialStore = {
  readonly backend: 'keyring'
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

/** Serialize credential changes while preserving operation and cleanup failures. */
export const withLifecycleLock = async <T>(path: string, operation: () => Promise<T>): Promise<T> => {
  let release: () => Promise<void>
  try {
    release = await lockfile.lock(path, lifecycleLockOptions)
  } catch (error) {
    throw storageError(error)
  }

  let result: { value: T } | { error: unknown }
  try {
    result = { value: await operation() }
  } catch (error) {
    result = { error }
  }
  try {
    await release()
  } catch (error) {
    const failure = storageError(error)
    if ('error' in result) {
      throw new AggregateError([result.error, failure], 'Credential operation and lock release failed')
    }
    throw failure
  }
  if ('error' in result) throw result.error
  return result.value
}

export const resolveCredential = async (
  options: CredentialResolutionOptions,
): Promise<ResolvedCredential | null> => {
  const environment = options.environment ?? process.env
  if (hasCredentialCustomHeader(environment.DEDALUS_CUSTOM_HEADERS)) {
    throw new CredentialStorageError('unsupported_credential')
  }
  const flag = oneCredential([
    candidate(options.flags.apiKey, 'flag', 'bearer'),
    candidate(options.flags.xApiKey, 'flag', 'x-api-key'),
  ])
  if (flag && options.flags.bearerAuth !== undefined) {
    throw new CredentialStorageError('ambiguous_credential')
  }
  if (options.flags.bearerAuth !== undefined) {
    throw new CredentialStorageError('unsupported_credential')
  }
  if (flag) return flag

  const environmentCredential = oneCredential([
    candidate(environment.DEDALUS_API_KEY, 'environment', 'bearer'),
    candidate(environment.DEDALUS_X_API_KEY, 'environment', 'x-api-key'),
  ])
  if (environmentCredential && environment.DEDALUS_BEARER_AUTH !== undefined) {
    throw new CredentialStorageError('ambiguous_credential')
  }
  if (environment.DEDALUS_BEARER_AUTH !== undefined) {
    throw new CredentialStorageError('unsupported_credential')
  }
  if (environmentCredential) return environmentCredential

  const stored = await options.storedAccessToken()
  if (stored === null) return null
  return {
    value: validCredentialToken(stored),
    source: 'oauth_session',
    transport: 'bearer',
  }
}

export const hasCredentialCustomHeader = (value: string | undefined): boolean => {
  if (value === undefined) return false
  return value.split('\n').some((line) => {
    const separator = line.indexOf(':')
    if (separator < 0) return false
    const name = line.slice(0, separator).trim().toLowerCase()
    return name === 'authorization' || name === 'x-api-key'
  })
}

export const defaultCredentialStore = (): CredentialStore => keyringCredentialStore()

export const keyringCredentialStore = (
  entryFactory: KeyringEntryFactory = nativeKeyringEntry,
): CredentialStore => ({
  backend: 'keyring',
  read: async () => {
    try {
      const stored = await (await entryFactory()).getPassword()
      return stored === undefined || stored === null ? null : decodeOAuthSession(stored)
    } catch (error) {
      throw storageError(error)
    }
  },
  write: async (session) => {
    try {
      await (await entryFactory()).setPassword(serializeOAuthSession(session))
    } catch (error) {
      throw storageError(error)
    }
  },
  remove: async () => {
    try {
      return await (await entryFactory()).deleteCredential()
    } catch (error) {
      throw storageError(error)
    }
  },
  withLifecycleLock: (operation) => withLifecycleLock(join(homedir(), '.dedalus-cli-credentials'), operation),
})

const nativeKeyringEntry = async (): Promise<KeyringEntry> => {
  try {
    const { AsyncEntry } = await import('@napi-rs/keyring')
    return new AsyncEntry(credentialService, credentialAccount)
  } catch (error) {
    throw new CredentialStorageError('storage_unavailable', { cause: error })
  }
}

const candidate = (
  value: string | undefined,
  source: ResolvedCredential['source'],
  transport: ResolvedCredential['transport'],
): ResolvedCredential | null =>
  value === undefined ? null : { value: validCredentialToken(value), source, transport }

const oneCredential = (
  candidates: readonly (ResolvedCredential | null)[],
): ResolvedCredential | null => {
  const available = candidates.filter((value): value is ResolvedCredential => value !== null)
  if (available.length > 1) throw new CredentialStorageError('ambiguous_credential')
  return available[0] ?? null
}
// @custom end
