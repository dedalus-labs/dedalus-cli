/**
 * Stored OAuth 2.0 session lifecycle for command-line authentication.
 *
 * Login, refresh, status, and logout run through the credential-store lock.
 * Provider and organization identity cannot change during a stored session.
 */

import type { CredentialResolutionOptions, CredentialStore, ResolvedCredential } from './credentials.js'
import { CredentialStorageError, resolveCredential } from './credentials.js'
import type { AuthProvider, OAuthSession, OAuthSessionMetadata } from './types.js'
import { oauthSessionMetadata } from './types.js'

const refreshSkewMs = 60 * 1000

export class CLIAuthWorkflowError extends Error {
  readonly code:
    | 'cli_credential_store_failed'
    | 'cli_session_identity_changed'
    | 'cli_session_provider_mismatch'

  constructor(code: CLIAuthWorkflowError['code'], options?: ErrorOptions) {
    super(code, options)
    this.name = 'CLIAuthWorkflowError'
    this.code = code
  }
}

export type LoginDependencies = {
  readonly provider: AuthProvider
  readonly store: CredentialStore
  readonly now?: () => number
}

type AuthProviderFactory = () => AuthProvider

export type LoginResult =
  | { readonly status: 'already_signed_in'; readonly session: OAuthSessionMetadata }
  | { readonly status: 'logged_in'; readonly session: OAuthSessionMetadata }

export type AuthStatus =
  | { readonly source: 'none' }
  | { readonly source: 'environment' | 'flag' }
  | { readonly source: 'oauth_session'; readonly offline: boolean; readonly session: OAuthSessionMetadata }

export type LogoutResult =
  | { readonly status: 'not_logged_in'; readonly revocationConfirmed: false }
  | { readonly status: 'logged_out'; readonly revocationConfirmed: boolean }

export const login = async (dependencies: LoginDependencies): Promise<LoginResult> =>
  dependencies.store.withLifecycleLock(async () => {
    const existing = await dependencies.store.read()
    if (existing && existing.accessTokenExpiresAt > (dependencies.now ?? Date.now)() + refreshSkewMs) {
      requireProviderBinding(existing, dependencies.provider)
      return { status: 'already_signed_in', session: oauthSessionMetadata(existing) }
    }

    const session = await dependencies.provider.login()
    requireProviderBinding(session, dependencies.provider)
    try {
      await dependencies.store.write(session)
    } catch (error) {
      throw new CLIAuthWorkflowError('cli_credential_store_failed', { cause: error })
    }
    return { status: 'logged_in', session: oauthSessionMetadata(session) }
  })

export const status = async (
  resolution: Omit<CredentialResolutionOptions, 'storedAccessToken'>,
  store: () => CredentialStore,
  provider: AuthProviderFactory,
  offline: boolean,
  now: () => number = Date.now,
): Promise<AuthStatus> => {
  let configuredStore: CredentialStore | undefined
  const credentialStore = (): CredentialStore => configuredStore ??= store()
  const selected = await resolveCredential({
    ...resolution,
    storedAccessToken: async () => (await credentialStore().read())?.accessToken ?? null,
  })
  if (!selected) return { source: 'none' }
  if (selected.source !== 'oauth_session') return { source: selected.source }

  const session = offline
    ? await requireStoredSession(credentialStore())
    : await currentSession(credentialStore(), provider(), now)
  return { source: 'oauth_session', offline, session: oauthSessionMetadata(session) }
}

export const accessTokenForCommand = async (
  store: CredentialStore,
  provider: AuthProvider,
  now: () => number = Date.now,
): Promise<string> => (await currentSession(store, provider, now)).accessToken

export const logout = async (
  store: CredentialStore,
  provider: AuthProviderFactory,
): Promise<LogoutResult> => store.withLifecycleLock(async () => {
  let session: OAuthSession | null
  try {
    session = await store.read()
  } catch (error) {
    if (
      !(error instanceof CredentialStorageError) ||
      (error.code !== 'invalid_credential' && error.code !== 'insecure_permissions')
    ) {
      throw error
    }
    const removed = await store.remove()
    if (!removed) throw new CLIAuthWorkflowError('cli_credential_store_failed')
    return { status: 'logged_out', revocationConfirmed: false }
  }
  if (!session) return { status: 'not_logged_in', revocationConfirmed: false }

  let revocationConfirmed = false
  try {
    const configuredProvider = provider()
    requireProviderBinding(session, configuredProvider)
    revocationConfirmed = await configuredProvider.revoke(session)
  } catch {
    revocationConfirmed = false
  }

  const removed = await store.remove()
  if (!removed) throw new CLIAuthWorkflowError('cli_credential_store_failed')
  return { status: 'logged_out', revocationConfirmed }
})

const currentSession = async (
  store: CredentialStore,
  provider: AuthProvider,
  now: () => number,
): Promise<OAuthSession> => store.withLifecycleLock(async () => {
  const session = await requireStoredSession(store)
  requireProviderBinding(session, provider)
  if (session.accessTokenExpiresAt > now() + refreshSkewMs) return session

  const refreshed = await provider.refresh(session)
  requireProviderBinding(refreshed, provider)
  if (
    refreshed.userId !== session.userId ||
    refreshed.organizationId !== session.organizationId
  ) {
    throw new CLIAuthWorkflowError('cli_session_identity_changed')
  }
  try {
    await store.write(refreshed)
  } catch (error) {
    throw new CLIAuthWorkflowError('cli_credential_store_failed', { cause: error })
  }
  return refreshed
})

const requireStoredSession = async (
  store: CredentialStore,
): Promise<OAuthSession> => {
  const session = await store.read()
  if (!session) throw new CredentialStorageError('not_logged_in')
  return session
}

const requireProviderBinding = (session: OAuthSession, provider: AuthProvider): void => {
  if (session.issuer !== provider.issuer || session.clientId !== provider.clientId) {
    throw new CLIAuthWorkflowError('cli_session_provider_mismatch')
  }
}

export const selectedCredential = async (
  resolution: Omit<CredentialResolutionOptions, 'storedAccessToken'>,
  store: () => CredentialStore,
): Promise<ResolvedCredential | null> => resolveCredential({
  ...resolution,
  storedAccessToken: async () => (await store().read())?.accessToken ?? null,
})
