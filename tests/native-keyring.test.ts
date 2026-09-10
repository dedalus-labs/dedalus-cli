// @custom start
// Require native credential storage and preserve storage failure causes.
import assert from 'node:assert/strict'
import test from 'node:test'
import lockfile from 'proper-lockfile'
import {
  CredentialStorageError,
  defaultCredentialStore,
  keyringCredentialStore,
} from '../src/auth/credentials.js'
import type { OAuthSession } from '../src/auth/types.js'

const session: OAuthSession = {
  version: 1,
  issuer: 'https://issuer.example.com',
  clientId: 'client_cli',
  resource: 'https://dcs.example.com',
  gatewayURL: 'https://admin.example.com/dcs',
  accessToken: 'test-access',
  accessTokenExpiresAt: 2_000_000_000_000,
  refreshToken: 'test-refresh',
  userId: 'user_cli',
  organizationId: 'org_cli',
  grantedScopes: ['offline_access'],
}

test('invariant credential storage remains native on every supported platform', () => {
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')
  assert.ok(platform)
  const bus = process.env.DBUS_SESSION_BUS_ADDRESS
  delete process.env.DBUS_SESSION_BUS_ADDRESS
  try {
    for (const value of ['darwin', 'win32', 'linux']) {
      Object.defineProperty(process, 'platform', { ...platform, value })
      assert.equal(defaultCredentialStore().backend, 'keyring', value)
    }
  } finally {
    Object.defineProperty(process, 'platform', platform)
    if (bus === undefined) delete process.env.DBUS_SESSION_BUS_ADDRESS
    else process.env.DBUS_SESSION_BUS_ADDRESS = bus
  }
})

test('invariant native keyring failures retain their causes', async () => {
  const failure = new Error('native keyring unavailable')
  const store = keyringCredentialStore(async () => ({
    getPassword: async () => {
      throw failure
    },
    setPassword: async () => {
      throw failure
    },
    deleteCredential: async () => {
      throw failure
    },
  }))
  for (const action of [() => store.read(), () => store.write(session), () => store.remove()]) {
    await assert.rejects(
      action,
      (error) =>
        error instanceof CredentialStorageError &&
        error.code === 'storage_unavailable' &&
        error.cause === failure,
    )
  }
})

test('invariant releasing a lifecycle lock preserves an earlier operation failure', async (context) => {
  const operationFailure = new Error('credential operation failed')
  const releaseFailure = new Error('lock release failed')
  context.mock.method(lockfile, 'lock', async () => async () => {
    throw releaseFailure
  })
  await assert.rejects(
    defaultCredentialStore().withLifecycleLock(async () => {
      throw operationFailure
    }),
    (error) =>
      error instanceof AggregateError &&
      error.errors.includes(operationFailure) &&
      error.errors.some(
        (failure) => failure instanceof CredentialStorageError && failure.cause === releaseFailure,
      ),
  )
})
// @custom end
