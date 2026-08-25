/**
 * Provider-neutral contracts for command-line OAuth 2.0 sessions.
 *
 * Clerk implements these contracts in `oauth.ts`. Credential storage and
 * command lifecycle code depend on these shapes without depending on Clerk.
 */

export type OAuthSession = {
  readonly version: 1
  readonly issuer: string
  readonly clientId: string
  readonly accessToken: string
  /** Unix epoch milliseconds, capped at JavaScript's year 275760 date limit. */
  readonly accessTokenExpiresAt: number
  readonly refreshToken: string
  readonly userId: string
  readonly organizationId: string
  readonly organizationName?: string
  readonly grantedScopes: readonly string[]
  readonly providerSessionId?: string
}

export type AuthProviderErrorStage = 'local' | 'network' | 'provider'

export class AuthProviderError extends Error {
  readonly code: string
  readonly stage: AuthProviderErrorStage
  readonly status: number | undefined

  constructor(
    code: string,
    options: ErrorOptions & {
      readonly stage?: AuthProviderErrorStage
      readonly status?: number
    } = {},
  ) {
    super(code, options)
    this.name = 'AuthProviderError'
    this.code = code
    this.stage = options.stage ?? 'local'
    this.status = options.status
  }
}

export type AuthProvider = {
  readonly issuer: string
  readonly clientId: string
  readonly login: () => Promise<OAuthSession>
  readonly refresh: (session: OAuthSession) => Promise<OAuthSession>
  readonly revoke: (session: OAuthSession) => Promise<boolean>
}

export type OAuthSessionMetadata = Omit<
  OAuthSession,
  'accessToken' | 'refreshToken' | 'version'
>

export const oauthSessionMetadata = (session: OAuthSession): OAuthSessionMetadata => ({
  issuer: session.issuer,
  clientId: session.clientId,
  accessTokenExpiresAt: session.accessTokenExpiresAt,
  userId: session.userId,
  organizationId: session.organizationId,
  ...(session.organizationName === undefined ? {} : { organizationName: session.organizationName }),
  grantedScopes: session.grantedScopes,
  ...(session.providerSessionId === undefined ? {} : { providerSessionId: session.providerSessionId }),
})
