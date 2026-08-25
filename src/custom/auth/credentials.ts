/**
 * Credential selection and protected storage for the Dedalus command-line interface.
 *
 * This module selects exactly one workload key or stored OAuth 2.0 session.
 * It also owns the operating-system keyring and private-file storage adapters.
 */

import { randomUUID } from 'node:crypto'
import { constants, type Stats } from 'node:fs'
import { type FileHandle, lstat, mkdir, open, rename, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import lockfile from 'proper-lockfile'

import {
  CredentialStorageError,
  decodeOAuthSession,
  isMissing,
  maxCredentialFileBytes,
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

const withLifecycleLock = async <T>(path: string, operation: () => Promise<T>): Promise<T> => {
  let release: () => Promise<void>
  try {
    release = await lockfile.lock(path, lifecycleLockOptions)
  } catch (error) {
    throw storageError(error)
  }

  try {
    return await operation()
  } finally {
    try {
      await release()
    } catch (error) {
      throw storageError(error)
    }
  }
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

export const defaultCredentialStore = (
  options: DefaultCredentialStoreOptions = {},
): CredentialStore => {
  const environment = options.environment ?? process.env
  const platform = options.platform ?? process.platform
  const backend = platformCredentialBackend(platform, environment)

  if (backend === 'keyring') return keyringCredentialStore()
  if (platform === 'win32') throw new CredentialStorageError('invalid_configuration')
  return fileCredentialStore(options.credentialPath ?? defaultCredentialPath(environment))
}

export const keyringCredentialStore = (
  entryFactory: KeyringEntryFactory = nativeKeyringEntry,
): CredentialStore => {
  const readState = async (): Promise<OAuthSession | null> => {
    try {
      const stored = await (await entryFactory()).getPassword()
      return stored === undefined || stored === null ? null : decodeOAuthSession(stored)
    } catch (error) {
      throw storageError(error)
    }
  }
  const writeState = async (session: OAuthSession): Promise<void> => {
    try {
      await (await entryFactory()).setPassword(serializeOAuthSession(session))
    } catch (error) {
      throw storageError(error)
    }
  }
  return {
    backend: 'keyring',
    read: readState,
    write: writeState,
    remove: async () => {
      try {
        return await (await entryFactory()).deleteCredential()
      } catch (error) {
        throw storageError(error)
      }
    },
    withLifecycleLock: (operation) => withLifecycleLock(keyringLifecycleLockPath(), operation),
  }
}

export const fileCredentialStore = (credentialPath: string): CredentialStore => {
  if (!isAbsolute(credentialPath)) throw new CredentialStorageError('invalid_configuration')
  const directory = dirname(credentialPath)

  return {
    backend: 'file',
    read: async () => readCredentialFile(directory, credentialPath),
    write: async (session) => writeCredentialFile(directory, credentialPath, session),
    remove: async () => removeCredentialFile(directory, credentialPath),
    withLifecycleLock: async (operation) => {
      await requirePrivateDirectory(directory, true)
      return withLifecycleLock(credentialPath, operation)
    },
  }
}

const keyringLifecycleLockPath = (): string => join(homedir(), '.dedalus-cli-credentials')

const readCredentialFile = async (directory: string, credentialPath: string): Promise<OAuthSession | null> => {
  try {
    await requirePrivateDirectory(directory, false)
    // O_NONBLOCK prevents a same-user FIFO replacement from hanging before
    // descriptor metadata can reject the non-regular path.
    const handle = await open(credentialPath, constants.O_RDONLY | constants.O_NONBLOCK | noFollowFlag())
    try {
      const metadata = await handle.stat()
      requirePrivateFile(metadata)
      if (metadata.size > maxCredentialFileBytes) {
        throw new CredentialStorageError('invalid_credential')
      }
      return decodeOAuthSession(await readCredential(handle))
    } finally {
      await handle.close()
    }
  } catch (error) {
    if (isMissing(error)) return null
    throw storageError(error)
  }
}

const readCredential = async (handle: FileHandle): Promise<string> => {
  const buffer = Buffer.allocUnsafe(maxCredentialFileBytes + 1)
  let offset = 0
  while (offset < buffer.byteLength) {
    const { bytesRead } = await handle.read(buffer, offset, buffer.byteLength - offset, null)
    if (bytesRead === 0) break
    offset += bytesRead
  }
  if (offset > maxCredentialFileBytes) throw new CredentialStorageError('invalid_credential')
  return buffer.subarray(0, offset).toString('utf8')
}

const writeCredentialFile = async (
  directory: string,
  credentialPath: string,
  session: OAuthSession,
): Promise<void> => {
  const temporaryPath = `${credentialPath}.${process.pid}.${randomUUID()}.tmp`
  try {
    await requirePrivateDirectory(directory, true)
    const temporary = await open(temporaryPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600)
    try {
      await temporary.writeFile(serializeOAuthSession(session), 'utf8')
      await temporary.sync()
    } finally {
      await temporary.close()
    }
    await rename(temporaryPath, credentialPath)
    await syncDirectory(directory)
  } catch (error) {
    await removeTemporaryFile(temporaryPath)
    throw storageError(error)
  }
}

const removeCredentialFile = async (directory: string, credentialPath: string): Promise<boolean> => {
  try {
    await requirePrivateDirectory(directory, false)
    const metadata = await lstat(credentialPath)
    requireOwnedRegularFile(metadata)
    await unlink(credentialPath)
    await syncDirectory(directory)
    return true
  } catch (error) {
    if (isMissing(error)) return false
    throw storageError(error)
  }
}

const requirePrivateDirectory = async (directory: string, create: boolean): Promise<void> => {
  if (create) await mkdir(directory, { recursive: true, mode: 0o700 })
  const metadata = await lstat(directory)
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || metadata.mode & 0o077) {
    throw new CredentialStorageError('insecure_permissions')
  }
  requireCurrentUser(metadata.uid)
}

const requirePrivateFile = (metadata: Stats): void => {
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.mode & 0o077) {
    throw new CredentialStorageError('insecure_permissions')
  }
  requireCurrentUser(metadata.uid)
}

const requireOwnedRegularFile = (metadata: Stats): void => {
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new CredentialStorageError('insecure_permissions')
  }
  requireCurrentUser(metadata.uid)
}

const requireCurrentUser = (owner: number): void => {
  const currentUser = process.getuid?.()
  if (currentUser !== undefined && owner !== currentUser) {
    throw new CredentialStorageError('insecure_permissions')
  }
}

const syncDirectory = async (directory: string): Promise<void> => {
  const handle = await open(directory, constants.O_RDONLY)
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

const removeTemporaryFile = async (path: string): Promise<void> => {
  try {
    await unlink(path)
  } catch (error) {
    if (!isMissing(error)) throw error
  }
}

const platformCredentialBackend = (
  platform: NodeJS.Platform,
  environment: Readonly<Record<string, string | undefined>>,
): CredentialStore['backend'] => {
  if (platform === 'darwin' || platform === 'win32') return 'keyring'
  if (platform === 'linux' && environment.DBUS_SESSION_BUS_ADDRESS) return 'keyring'
  return 'file'
}

const defaultCredentialPath = (
  environment: Readonly<Record<string, string | undefined>>,
): string => {
  const configHome = environment.XDG_CONFIG_HOME || join(homedir(), '.config')
  if (!isAbsolute(configHome)) throw new CredentialStorageError('invalid_configuration')
  return join(configHome, 'dedalus', 'credentials')
}

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
): ResolvedCredential | null => value === undefined
  ? null
  : { value: validCredentialToken(value), source, transport }

const oneCredential = (
  candidates: readonly (ResolvedCredential | null)[],
): ResolvedCredential | null => {
  const available = candidates.filter((value): value is ResolvedCredential => value !== null)
  if (available.length > 1) throw new CredentialStorageError('ambiguous_credential')
  return available[0] ?? null
}

const noFollowFlag = (): number => {
  const flag: unknown = constants.O_NOFOLLOW
  if (typeof flag !== 'number') throw new CredentialStorageError('storage_unavailable')
  return flag
}
