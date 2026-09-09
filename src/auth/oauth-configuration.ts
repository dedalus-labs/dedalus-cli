// @custom
/** Validate OAuth endpoints before opening a browser or sending credentials. */
import { ClerkOAuthError } from './oauth-http.js'

const maxOAuthDisplayLength = 4 * 1024

export const validIssuer = (raw: string): URL => {
  try {
    if (raw.length > maxOAuthDisplayLength || raw !== raw.trim()) {
      throw new ClerkOAuthError('invalid_configuration')
    }
    const issuer = new URL(raw)
    if (
      issuer.protocol !== 'https:' ||
      issuer.username ||
      issuer.password ||
      issuer.search ||
      issuer.hash ||
      (issuer.pathname !== '/' && issuer.pathname !== '')
    ) {
      throw new ClerkOAuthError('invalid_configuration')
    }
    return issuer
  } catch (error: unknown) {
    if (error instanceof ClerkOAuthError) throw error
    throw new ClerkOAuthError('invalid_configuration', { cause: error })
  }
}

export const validSignInURL = (raw: string): URL => {
  try {
    if (raw.length > maxOAuthDisplayLength || raw !== raw.trim()) {
      throw new ClerkOAuthError('invalid_configuration')
    }
    const signInURL = new URL(raw)
    const loopbackHTTP =
      signInURL.protocol === 'http:' &&
      (signInURL.hostname === '127.0.0.1' || signInURL.hostname === 'localhost')
    if (
      (signInURL.protocol !== 'https:' && !loopbackHTTP) ||
      signInURL.username ||
      signInURL.password ||
      signInURL.search ||
      signInURL.hash ||
      signInURL.pathname !== '/cli/sign-in'
    ) {
      throw new ClerkOAuthError('invalid_configuration')
    }
    return signInURL
  } catch (error: unknown) {
    if (error instanceof ClerkOAuthError) throw error
    throw new ClerkOAuthError('invalid_configuration', { cause: error })
  }
}
