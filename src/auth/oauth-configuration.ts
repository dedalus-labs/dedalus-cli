// @custom start
/** Validate OAuth endpoints before opening a browser or sending credentials. */
import { DedalusOAuthError } from './oauth-http.js'

const maxOAuthDisplayLength = 4 * 1024

export const validIssuer = (raw: string): URL => {
  try {
    if (raw.length > maxOAuthDisplayLength || raw !== raw.trim()) {
      throw new DedalusOAuthError('invalid_configuration')
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
      throw new DedalusOAuthError('invalid_configuration')
    }
    return issuer
  } catch (error: unknown) {
    if (error instanceof DedalusOAuthError) throw error
    throw new DedalusOAuthError('invalid_configuration', { cause: error })
  }
}

export const validSignInURL = (raw: string): URL => {
  try {
    if (raw.length > maxOAuthDisplayLength || raw !== raw.trim()) {
      throw new DedalusOAuthError('invalid_configuration')
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
      throw new DedalusOAuthError('invalid_configuration')
    }
    return signInURL
  } catch (error: unknown) {
    if (error instanceof DedalusOAuthError) throw error
    throw new DedalusOAuthError('invalid_configuration', { cause: error })
  }
}
// @custom end
