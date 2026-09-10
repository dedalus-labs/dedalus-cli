// @custom start
/** Production endpoints are public. Alternate deployments require one private, complete bundle. */
import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { AuthProviderError } from './types.js'
import { validIssuer, validSignInURL } from './oauth-configuration.js'

export type CLIAuthConfiguration = {
  readonly issuer: string
  readonly clientId: string
  readonly resource: string
  readonly gatewayURL: string
  readonly signInURL: string
}

const production: CLIAuthConfiguration = {
  issuer: 'https://as.dedaluslabs.ai',
  clientId: 'dedalus-cli',
  resource: 'https://dcs.dedaluslabs.ai',
  gatewayURL: 'https://admin.api.dedaluslabs.ai/dcs',
  signInURL: 'https://www.dedaluslabs.ai/cli/sign-in',
}

export const cliAuthConfiguration = (
  environment: Readonly<Record<string, string | undefined>>,
): CLIAuthConfiguration => {
  for (const name of ['DEDALUS_CLERK_ISSUER', 'DEDALUS_CLERK_CLIENT_ID', 'DEDALUS_SIGN_IN_URL']) {
    if (environment[name] !== undefined) throw new AuthProviderError('invalid_configuration')
  }
  const path = environment.DEDALUS_AUTH_CONFIG
  if (path === undefined) return production
  if (!isAbsolute(path)) throw new AuthProviderError('invalid_configuration')
  let descriptor: number
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  } catch (cause) {
    throw new AuthProviderError('configuration_unavailable', { cause })
  }
  const failures: unknown[] = []
  let result: CLIAuthConfiguration | undefined
  try {
    const stat = fstatSync(descriptor)
    if (
      !stat.isFile() ||
      stat.size > 4096 ||
      (process.platform !== 'win32' &&
        ((stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()))
    )
      throw new AuthProviderError('invalid_configuration')
    const bytes = Buffer.alloc(4097)
    let length = 0
    while (length < bytes.length) {
      const count = readSync(descriptor, bytes, length, bytes.length - length, null)
      if (count === 0) break
      length += count
    }
    if (length > 4096) throw new AuthProviderError('invalid_configuration')
    const value: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length)),
    )
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).length !== 5 ||
      !('issuer' in value) ||
      typeof value.issuer !== 'string' ||
      !('resource' in value) ||
      typeof value.resource !== 'string' ||
      !('clientId' in value) ||
      value.clientId !== 'dedalus-cli' ||
      !('gatewayURL' in value) ||
      typeof value.gatewayURL !== 'string' ||
      !('signInURL' in value) ||
      typeof value.signInURL !== 'string'
    )
      throw new AuthProviderError('invalid_configuration')
    const gateway = new URL(value.gatewayURL)
    validIssuer(gateway.origin)
    if (value.gatewayURL !== gateway.origin + '/dcs')
      throw new AuthProviderError('invalid_configuration')
    result = {
      issuer: validIssuer(value.issuer).origin,
      clientId: value.clientId,
      resource: validIssuer(value.resource).origin,
      gatewayURL: value.gatewayURL,
      signInURL: validSignInURL(value.signInURL).toString(),
    }
  } catch (cause) {
    failures.push(
      cause instanceof AuthProviderError
        ? cause
        : new AuthProviderError('invalid_configuration', { cause }),
    )
  }
  try {
    closeSync(descriptor)
  } catch (cause) {
    failures.push(new AuthProviderError('configuration_cleanup_failed', { cause }))
  }
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1)
    throw new AggregateError(failures, 'CLI configuration and cleanup failed')
  if (!result) throw new AuthProviderError('invalid_configuration')
  return result
}
// @custom end
