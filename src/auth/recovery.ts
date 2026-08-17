// @custom
/** OAuth recovery attached only to credentials selected by the CLI. */
import type { CredentialStore } from './credentials.js'
import type { AuthProvider } from './types.js'
import { CredentialStorageError } from './credentials.js'
import { recoverRejectedAccessToken } from './workflow.js'

type Recovery = { readonly recover: (rejected: string) => Promise<void> }
const recoveries = new WeakMap<() => string, Recovery>()

export const recoverableBearer = async (
  initial: string,
  store: CredentialStore,
  provider: AuthProvider,
): Promise<() => string> => {
  const identity = await store.read()
  if (!identity || identity.accessToken !== initial)
    throw new CredentialStorageError('invalid_credential')
  let token = initial
  const bearer = () => token
  recoveries.set(bearer, {
    recover: async (rejected) => {
      token = await recoverRejectedAccessToken(store, provider, rejected, identity)
    },
  })
  return bearer
}

export const oauthRecovery = (bearer: unknown): Recovery | undefined =>
  typeof bearer === 'function' ? recoveries.get(bearer as () => string) : undefined
