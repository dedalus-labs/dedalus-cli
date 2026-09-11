// @custom start
/**
 * Secret-safe output for command-line authentication and generated API errors.
 *
 * Auth commands and generated resource commands share this boundary. It keeps
 * provider details and credential plaintext out of terminal and JSON output.
 */

import { Command } from 'commander'

import { CredentialStorageError } from './credentials.js'
import { AuthProviderError } from './types.js'
import {
  type AuthStatus,
  CLIAuthWorkflowError,
  type LoginResult,
  type LogoutResult,
} from './workflow.js'

export type CredentialSource = 'environment' | 'flag' | 'none' | 'oauth_session'

export type SelectedCredential = {
  readonly source: CredentialSource
  readonly label?: 'DEDALUS_API_KEY' | 'DEDALUS_X_API_KEY'
}

type SafeAuthError = {
  readonly code: string
  readonly message: string
  readonly retryable: boolean
  readonly http_status?: number
  readonly credential_source?: CredentialSource
  readonly causes?: readonly SafeAuthError[]
}

type AuthErrorResponse = { readonly error: SafeAuthError }

const credentialSources = new WeakMap<Command, SelectedCredential>()

export const recordCredentialSource = (command: Command, selected: SelectedCredential): void => {
  credentialSources.set(command, selected)
}

export const formatDedalusError = (
  error: unknown,
  command: Command,
): AuthErrorResponse | undefined => {
  const selected = credentialSources.get(command)
  if (
    error instanceof AuthProviderError ||
    error instanceof CredentialStorageError ||
    error instanceof CLIAuthWorkflowError ||
    error instanceof AggregateError
  ) {
    const safe = safeAuthError(error, selected?.source ?? 'none')
    return { error: safe }
  }

  if (!selected || !isSDKError(error)) return undefined
  if (selected.source === 'none') {
    return authError({
      code: 'cli_no_credential',
      message: "Not logged in. Run 'dedalus auth login'.",
      retryable: false,
      source: 'none',
    })
  }

  const status = validHTTPStatus(error.status)
  if (status === undefined) {
    return authError({
      code: 'cli_network_error',
      message: 'Dedalus could not be reached. Check your connection and try again.',
      retryable: true,
      source: selected.source,
    })
  }

  const remoteCode = serverErrorCode(error.error)
  const code = remoteCode ?? defaultHTTPCode(status)
  const remoteRetryable = serverRetryable(error.error)
  return authError({
    code,
    message: remoteCode ? safeServerMessage(status) : defaultHTTPMessage(status, selected),
    retryable: remoteRetryable ?? (status === 408 || status === 429 || status >= 500),
    httpStatus: status,
    source: selected.source,
  })
}

const isSDKError = (
  error: unknown,
): error is { readonly status?: unknown; readonly error?: unknown } =>
  Boolean(error && typeof error === 'object' && 'status' in error && 'error' in error)

const validHTTPStatus = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : undefined

type AuthErrorOptions = {
  readonly code: string
  readonly message: string
  readonly retryable: boolean
  readonly httpStatus?: number
  readonly source?: CredentialSource
}

const authError = ({
  code,
  message,
  retryable,
  httpStatus,
  source,
}: AuthErrorOptions): AuthErrorResponse => ({
  error: {
    code,
    message,
    retryable,
    ...(httpStatus === undefined ? {} : { http_status: httpStatus }),
    ...(source === undefined ? {} : { credential_source: source }),
  },
})

const defaultHTTPCode = (status: number): string => {
  if (status === 401) return 'invalid_token'
  if (status === 403) return 'insufficient_scope'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'server_error'
  return 'http_error'
}

const defaultHTTPMessage = (status: number, selected: SelectedCredential): string => {
  if (status === 401) return rejectedCredentialMessage(selected)
  return safeServerMessage(status)
}

const safeServerMessage = (status: number): string => {
  if (status === 403) return 'This credential does not have permission for that operation.'
  if (status === 404) return 'The requested resource was not found.'
  if (status === 408) return 'The request timed out. Try again.'
  if (status === 429) return 'Too many requests. Try again later.'
  if (status >= 500) return 'Dedalus is temporarily unavailable. Try again.'
  return 'Dedalus rejected the request.'
}

const rejectedCredentialMessage = (selected: SelectedCredential): string => {
  switch (selected.source) {
    case 'flag':
      return 'API key supplied by command-line flag was rejected.'
    case 'environment':
      return `API key from ${selected.label ?? 'the environment'} was rejected.`
    case 'oauth_session':
      return "Stored OAuth session is no longer valid. Run 'dedalus auth logout', then 'dedalus auth login'."
    case 'none':
      return "Not logged in. Run 'dedalus auth login'."
  }
}

const serverErrorCode = (body: unknown): string | undefined => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined
  const record = body as Record<string, unknown>
  if (typeof record.error_code === 'string') return safeExternalErrorCode(record.error_code)
  if (typeof record.code === 'string') return safeExternalErrorCode(record.code)
  if (typeof record.error === 'string') return safeExternalErrorCode(record.error)
  if (!record.error || typeof record.error !== 'object' || Array.isArray(record.error))
    return undefined
  const nested = (record.error as Record<string, unknown>).code
  return typeof nested === 'string' ? safeExternalErrorCode(nested) : undefined
}

const safeExternalErrorCode = (value: string): string | undefined => {
  if (!value || value.length > 256) return undefined
  for (const character of value) {
    const code = character.charCodeAt(0)
    if (code < 0x20 || code > 0x7e) return undefined
  }
  return value
}

const serverRetryable = (body: unknown): boolean | undefined => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined
  const record = body as Record<string, unknown>
  if (typeof record.retryable === 'boolean') return record.retryable
  if (!record.error || typeof record.error !== 'object' || Array.isArray(record.error))
    return undefined
  const nested = (record.error as Record<string, unknown>).retryable
  return typeof nested === 'boolean' ? nested : undefined
}

type AuthOutput = {
  readonly message: string
  readonly value: Readonly<Record<string, unknown>>
}

export const loginOutput = (result: LoginResult): AuthOutput => ({
  message:
    result.status === 'logged_in'
      ? `Logged in to organization ${result.session.organizationId}.`
      : `Already signed in to organization ${result.session.organizationId}.`,
  value: {
    status: result.status,
    credential_source: 'oauth_session',
    ...sessionOutput(result.session),
  },
})

export const statusOutput = (result: AuthStatus): AuthOutput => {
  if (result.source === 'none') {
    return {
      message: "Not logged in. Run 'dedalus auth login'.",
      value: { status: 'not_logged_in', credential_source: 'none' },
    }
  }
  const loggedIn = result.source === 'oauth_session'
  return {
    message: loggedIn
      ? `Active credential source: oauth_session. Issuer: ${result.session.issuer}. User: ${result.session.userId}. Organization: ${result.session.organizationId}.`
      : `Credential configured from ${result.source}.`,
    value: {
      status: loggedIn ? 'logged_in' : 'configured',
      credential_source: result.source,
      ...(loggedIn ? { offline: result.offline, ...sessionOutput(result.session) } : {}),
    },
  }
}

const sessionOutput = (session: LoginResult['session']): Record<string, unknown> => ({
  issuer: session.issuer,
  user_id: session.userId,
  organization: {
    id: session.organizationId,
    ...(session.organizationName === undefined ? {} : { name: session.organizationName }),
  },
  access_token_expires_at: new Date(session.accessTokenExpiresAt).toISOString(),
})

export const logoutOutput = (result: LogoutResult): AuthOutput =>
  result.status === 'logged_out'
    ? {
        message: 'Logged out. Provider revocation and local credential removal were confirmed.',
        value: {
          status: 'logged_out',
          local_tokens_removed: true,
          revocation_confirmed: result.revocationConfirmed,
        },
      }
    : {
        message: 'No stored OAuth login found.',
        value: {
          status: 'not_logged_in',
          local_tokens_removed: false,
          revocation_confirmed: false,
        },
      }

type RunAuthActionOptions = {
  readonly action: () => Promise<AuthOutput>
  readonly source: CredentialSource
  readonly json: boolean
  readonly writeOutput: (value: string) => void
  readonly writeError: (value: string) => void
}

export const runAuthAction = async ({
  action,
  source,
  json,
  writeOutput,
  writeError,
}: RunAuthActionOptions): Promise<void> => {
  try {
    const output = await action()
    writeOutput(`${json ? JSON.stringify(output.value) : output.message}\n`)
  } catch (error) {
    const safe = safeAuthError(error, source)
    writeError(
      `${json ? JSON.stringify({ error: safe }) : `${String(safe.code)}: ${String(safe.message)}`}\n`,
    )
    process.exitCode = 1
  }
}

const safeAuthError = (error: unknown, source: CredentialSource = 'none'): SafeAuthError => {
  if (error instanceof AggregateError) {
    const causes = error.errors.map((cause: unknown) => safeAuthError(cause, source))
    return {
      code: 'cli_authentication_failed',
      message: `Authentication failed: ${causes.map((cause) => cause.message).join(' ')}`,
      retryable: causes.every((cause) => cause.retryable),
      credential_source: source,
      causes,
    }
  }
  if (error instanceof AuthProviderError) {
    const providerCode = safeExternalErrorCode(error.code) ?? 'oauth_error'
    const status = validHTTPStatus(error.status)
    const code =
      error.stage === 'provider'
        ? providerCode
        : error.stage === 'network'
          ? 'cli_network_error'
          : localProviderCode(providerCode)
    return {
      code,
      message: providerMessage(providerCode),
      retryable:
        error.stage === 'network' ||
        (error.stage === 'provider' && providerRetryable(providerCode)) ||
        (status !== undefined && status >= 500),
      ...(status === undefined ? {} : { http_status: status }),
      credential_source: 'oauth_session',
    }
  }
  if (error instanceof CredentialStorageError) {
    return {
      code: credentialStorageCode(error.code),
      message: credentialStorageMessage(error.code),
      retryable: false,
      credential_source: source,
    }
  }
  if (error instanceof CLIAuthWorkflowError) {
    return {
      code: error.code,
      message: workflowMessage(error.code),
      retryable: error.code === 'cli_credential_store_failed',
      credential_source: 'oauth_session',
    }
  }
  return {
    code: 'cli_authentication_failed',
    message: 'CLI authentication failed.',
    retryable: false,
    credential_source: source,
  }
}

const localProviderCode = (code: AuthProviderError['code']): string => {
  switch (code) {
    case 'token_exchange_failed':
    case 'refresh_failed':
    case 'userinfo_failed':
      return 'cli_network_error'
    case 'browser_open_failed':
    case 'callback_unavailable':
    case 'callback_response_failed':
    case 'invalid_callback':
    case 'invalid_configuration':
    case 'invalid_token_response':
    case 'invalid_userinfo_response':
    case 'issuer_mismatch':
    case 'login_cancelled':
    case 'login_timeout':
    case 'session_provider_mismatch':
    case 'state_mismatch':
    case 'userinfo_mismatch':
      return `cli_${code}`
    default:
      return `cli_${code}`
  }
}

const providerMessage = (code: AuthProviderError['code']): string => {
  switch (code) {
    case 'access_denied':
      return 'Login was canceled or denied.'
    case 'browser_open_failed':
      return 'Unable to open the browser for login.'
    case 'callback_unavailable':
      return 'Unable to start the local login callback.'
    case 'invalid_client':
    case 'invalid_configuration':
      return 'CLI authentication configuration is invalid.'
    case 'configuration_unavailable':
    case 'configuration_cleanup_failed':
      return 'The private authentication configuration could not be read or closed.'
    case 'revocation_failed':
      return 'Logout revocation was not confirmed. Credentials were retained. Retry logout.'
    case 'response_cleanup_failed':
    case 'callback_cleanup_failed':
      return 'Authentication cleanup failed. The operation did not complete.'
    case 'response_read_failed':
    case 'invalid_json_response':
    case 'invalid_response_encoding':
    case 'response_too_large':
      return 'The authentication service returned an unreadable or invalid response.'
    case 'invalid_grant':
      return "Login expired or could not be verified. Run 'dedalus auth logout', then 'dedalus auth login'."
    case 'invalid_scope':
      return 'CLI login requested unsupported permissions.'
    case 'issuer_mismatch':
    case 'state_mismatch':
    case 'userinfo_mismatch':
      return "Login response could not be verified. Run 'dedalus auth login' again."
    case 'login_timeout':
      return 'Login timed out. Run the command again.'
    case 'server_error':
    case 'temporarily_unavailable':
      return 'Authentication is temporarily unavailable. Try again.'
    case 'token_exchange_failed':
    case 'refresh_failed':
    case 'userinfo_failed':
      return 'Authentication service is temporarily unavailable. Try again.'
    default:
      return "Login could not be completed. Run 'dedalus auth login' again."
  }
}

const providerRetryable = (code: AuthProviderError['code']): boolean => {
  switch (code) {
    case 'refresh_failed':
    case 'server_error':
    case 'temporarily_unavailable':
    case 'token_exchange_failed':
    case 'userinfo_failed':
      return true
    default:
      return false
  }
}

const credentialStorageCode = (code: CredentialStorageError['code']): string => {
  switch (code) {
    case 'not_logged_in':
      return 'cli_no_credential'
    case 'ambiguous_credential':
      return 'cli_ambiguous_credential'
    case 'environment_mismatch':
      return 'cli_auth_environment_mismatch'
    case 'unsupported_credential':
      return 'cli_unsupported_credential'
    case 'insecure_permissions':
      return 'cli_insecure_credential_permissions'
    case 'storage_unavailable':
      return 'cli_credential_store_unavailable'
    case 'invalid_configuration':
      return 'cli_invalid_credential_configuration'
    case 'invalid_credential':
      return 'cli_invalid_stored_credential'
  }
}

const credentialStorageMessage = (code: CredentialStorageError['code']): string => {
  switch (code) {
    case 'not_logged_in':
      return "Not logged in. Run 'dedalus auth login'."
    case 'ambiguous_credential':
      return 'More than one credential was supplied at the same priority.'
    case 'environment_mismatch':
      return 'OAuth login requires a matching Admin API gateway URL ending in /dcs.'
    case 'unsupported_credential':
      return 'Direct Bearer-token overrides are not supported; use a workload API key or stored login.'
    case 'insecure_permissions':
      return 'Stored credential permissions are not private.'
    case 'invalid_configuration':
      return 'Credential storage configuration is invalid.'
    case 'invalid_credential':
      return "The stored OAuth session is invalid. Run 'dedalus auth logout', then sign in again."
    case 'storage_unavailable':
      return 'Protected credential storage is unavailable.'
  }
}

const workflowMessage = (code: CLIAuthWorkflowError['code']): string => {
  switch (code) {
    case 'cli_credential_store_failed':
      return 'The CLI could not complete the local credential update.'
    case 'cli_revocation_unconfirmed':
      return 'Logout failed because revocation was not confirmed. Credentials were retained. Retry logout.'
    case 'cli_session_identity_changed':
      return "The refreshed login changed identity or organization. Run 'dedalus auth logout', then sign in again."
    case 'cli_session_provider_mismatch':
      return 'The stored login belongs to another issuer, resource, or gateway. Restore its configuration before logging out.'
  }
}
// @custom end
