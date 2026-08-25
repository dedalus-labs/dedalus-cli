import assert from 'node:assert/strict'
import { chmod, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { CredentialStorageError, fileCredentialStore } from '../dist/esm/custom/auth/credentials.js'
import { createClerkAuthProvider } from '../dist/esm/custom/auth/oauth.js'
import {
  accessTokenForCommand,
  CLIAuthWorkflowError,
  login,
  logout,
  status,
} from '../dist/esm/custom/auth/workflow.js'

const unlocked = async (operation) => operation()

const session = (overrides = {}) => ({
  version: 1,
  issuer: 'https://clerk.example.com',
  clientId: 'client_cli',
  accessToken: 'oauth-access-token',
  accessTokenExpiresAt: 2_000_000_000_000,
  refreshToken: 'oauth-refresh-token',
  userId: 'user_cli',
  organizationId: 'org_cli',
  organizationName: 'Dedalus Labs',
  grantedScopes: ['offline_access', 'user:org:read'],
  ...overrides,
})

const store = (initial) => {
  let stored = initial
  return {
    backend: 'keyring',
    read: async () => stored ?? null,
    write: async (value) => { stored = value },
    remove: async () => {
      if (stored === undefined) return false
      stored = undefined
      return true
    },
    withLifecycleLock: unlocked,
  }
}

const provider = (overrides = {}) => ({
  issuer: 'https://clerk.example.com',
  clientId: 'client_cli',
  login: async () => session(),
  refresh: async (current) => current,
  revoke: async () => true,
  ...overrides,
})

test('invariant an existing OAuth login performs no provider work', async () => {
  const events = []
  const existing = store(session())
  const result = await login({
    provider: provider({ login: async () => { events.push('login'); throw new Error('must not run') } }),
    store: existing,
  })

  assert.equal(result.status, 'already_signed_in')
  assert.equal(result.session.organizationId, 'org_cli')
  assert.deepEqual(events, [])
  assert.deepEqual(await existing.read(), session())
})

test('invariant login replaces an expired OAuth session', async () => {
  const events = []
  const expired = store(session({
    accessToken: 'expired-access-token',
    accessTokenExpiresAt: 1_000,
    refreshToken: 'expired-refresh-token',
  }))
  const fresh = session({ accessToken: 'fresh-access-token', refreshToken: 'fresh-refresh-token' })

  const result = await login({
    provider: provider({ login: async () => { events.push('login'); return fresh } }),
    store: expired,
    now: () => 2_000,
  })

  assert.equal(result.status, 'logged_in')
  assert.deepEqual(events, ['login'])
  assert.deepEqual(await expired.read(), fresh)
})

test('invariant login durably stores the Clerk token set without returning secrets', async () => {
  const events = []
  const empty = store()
  const result = await login({
    provider: provider({ login: async () => { events.push('provider'); return session() } }),
    store: {
      ...empty,
      write: async (value) => { events.push('store'); await empty.write(value) },
    },
  })

  assert.equal(result.status, 'logged_in')
  assert.equal(JSON.stringify(result).includes('oauth-access-token'), false)
  assert.equal(JSON.stringify(result).includes('oauth-refresh-token'), false)
  assert.deepEqual(await empty.read(), session())
  assert.deepEqual(events, ['provider', 'store'])
})

test('invariant login success is not reported after a failed durable write', async () => {
  await assert.rejects(login({
    provider: provider(),
    store: {
      ...store(),
      write: async () => { throw new Error('keychain locked') },
    },
  }), (error) =>
    error instanceof CLIAuthWorkflowError && error.code === 'cli_credential_store_failed')
})

test('invariant workload overrides do not read or refresh OAuth storage', async () => {
  let storeConstructions = 0
  let storedReads = 0
  let refreshes = 0
  const result = await status(
    { flags: { apiKey: 'override-key' }, environment: {} },
    () => {
      storeConstructions += 1
      return {
        ...store(session()),
        backend: 'file',
        read: async () => { storedReads += 1; return session() },
      }
    },
    () => provider({ refresh: async (value) => { refreshes += 1; return value } }),
    false,
  )

  assert.deepEqual(result, { source: 'flag' })
  assert.equal(storeConstructions, 0)
  assert.equal(storedReads, 0)
  assert.equal(refreshes, 0)
})

test('invariant offline status returns local metadata without provider calls', async () => {
  let providerCalls = 0
  const result = await status(
    { flags: {}, environment: {} },
    () => store(session({ accessTokenExpiresAt: 1 })),
    () => {
      providerCalls += 1
      throw new Error('provider configuration must not be read')
    },
    true,
  )

  assert.equal(result.source, 'oauth_session')
  assert.equal(result.offline, true)
  assert.equal(result.session.organizationId, 'org_cli')
  assert.equal(providerCalls, 0)
  assert.equal(JSON.stringify(result).includes('oauth-access-token'), false)
})

test('invariant refresh persists before any unrelated provider request', async () => {
  const existing = store(session({ accessTokenExpiresAt: 1 }))
  const requests = []
  const authProvider = createClerkAuthProvider(
    { issuer: 'https://clerk.example.com', clientId: 'client_cli' },
    {
      now: () => 1_000,
      fetch: async (input) => {
        requests.push(String(input))
        if (!String(input).endsWith('/oauth/token')) throw new Error('userinfo is unavailable')
        return Response.json({
          access_token: 'refreshed-access-token',
          expires_in: 3_600,
          scope: 'offline_access user:org:read',
          token_type: 'Bearer',
        })
      },
    },
  )
  const token = await accessTokenForCommand(
    existing,
    authProvider,
    () => 1_000,
  )

  assert.equal(token, 'refreshed-access-token')
  assert.deepEqual(requests, ['https://clerk.example.com/oauth/token'])
  assert.deepEqual(await existing.read(), session({
    accessToken: 'refreshed-access-token',
    accessTokenExpiresAt: 3_601_000,
  }))
})

test('invariant concurrent commands refresh one expired session once', async () => {
  let stored = session({ accessTokenExpiresAt: 1 })
  let refreshes = 0
  let lock = Promise.resolve()
  const serializedStore = {
    backend: 'keyring',
    read: async () => stored,
    write: async (value) => { stored = value },
    remove: async () => false,
    withLifecycleLock: async (operation) => {
      const previous = lock
      let release
      lock = new Promise((resolve) => { release = resolve })
      await previous
      try {
        return await operation()
      } finally {
        release()
      }
    },
  }
  const authProvider = provider({ refresh: async () => {
    refreshes += 1
    return session({ accessToken: 'refreshed-access-token', accessTokenExpiresAt: 5_000_000 })
  } })

  const tokens = await Promise.all([
    accessTokenForCommand(serializedStore, authProvider, () => 1_000),
    accessTokenForCommand(serializedStore, authProvider, () => 1_000),
  ])

  assert.deepEqual(tokens, ['refreshed-access-token', 'refreshed-access-token'])
  assert.equal(refreshes, 1)
})

test('invariant refresh cannot silently change user or organization', async () => {
  const original = session({ accessTokenExpiresAt: 1 })
  const existing = store(original)

  await assert.rejects(
    accessTokenForCommand(
      existing,
      provider({ refresh: async () => session({ userId: 'other_user' }) }),
      () => 1_000,
    ),
    (error) => error instanceof CLIAuthWorkflowError && error.code === 'cli_session_identity_changed',
  )
  assert.deepEqual(await existing.read(), original)
})

test('invariant an issuer migration requires a fresh login', async () => {
  await assert.rejects(
    accessTokenForCommand(
      store(session()),
      provider({ issuer: 'https://dedalus-as.example.com' }),
    ),
    (error) => error instanceof CLIAuthWorkflowError && error.code === 'cli_session_provider_mismatch',
  )
})

test('invariant canonical issuer survives login, persistence, and a fresh provider process', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'dedalus-provider-session-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const firstStore = fileCredentialStore(join(root, 'config', 'credentials'))
  const configured = createClerkAuthProvider({
    issuer: 'https://clerk.example.com/',
    clientId: 'client_cli',
  })
  await login({
    provider: { ...configured, login: async () => session({ issuer: configured.issuer }) },
    store: firstStore,
  })

  const nextStore = fileCredentialStore(join(root, 'config', 'credentials'))
  const nextProvider = createClerkAuthProvider({
    issuer: 'https://clerk.example.com/',
    clientId: 'client_cli',
  })
  const result = await status({ flags: {}, environment: {} }, () => nextStore, () => nextProvider, true)

  assert.equal(nextProvider.issuer, 'https://clerk.example.com')
  assert.equal(result.source, 'oauth_session')
  assert.equal(result.session.issuer, 'https://clerk.example.com')
})

test('invariant logout removes local tokens after confirmed provider revocation', async () => {
  const existing = store(session())
  assert.deepEqual(await logout(existing, () => provider()), {
    status: 'logged_out',
    revocationConfirmed: true,
  })
  assert.equal(await existing.read(), null)
})

test('invariant logout removes local tokens when provider revocation fails', async () => {
  const existing = store(session())
  assert.deepEqual(await logout(existing, () => provider({ revoke: async () => { throw new Error('offline') } })), {
    status: 'logged_out',
    revocationConfirmed: false,
  })
  assert.equal(await existing.read(), null)
})

test('invariant logout removes local tokens when provider configuration is unavailable', async () => {
  const existing = store(session())
  assert.deepEqual(await logout(existing, () => { throw new Error('invalid provider configuration') }), {
    status: 'logged_out',
    revocationConfirmed: false,
  })
  assert.equal(await existing.read(), null)
})

test('invariant logout never sends a session to a different provider', async () => {
  const existing = store(session())
  let revocations = 0
  const otherProvider = provider({
    issuer: 'https://dedalus-as.example.com',
    clientId: 'client_v2',
    revoke: async () => { revocations += 1; return true },
  })

  assert.deepEqual(await logout(existing, () => otherProvider), {
    status: 'logged_out',
    revocationConfirmed: false,
  })
  assert.equal(revocations, 0)
  assert.equal(await existing.read(), null)
})

test('invariant logout is idempotent without a local OAuth session', async () => {
  assert.deepEqual(await logout(store(), () => provider()), {
    status: 'not_logged_in',
    revocationConfirmed: false,
  })
})

test('invariant logout can remove an obsolete local credential format', async () => {
  let removed = false
  const obsolete = {
    ...store(),
    read: async () => { throw new CredentialStorageError('invalid_credential') },
    remove: async () => { removed = true; return true },
  }

  assert.deepEqual(await logout(obsolete, () => provider()), {
    status: 'logged_out',
    revocationConfirmed: false,
  })
  assert.equal(removed, true)
})

test('invariant logout removes an exposed filesystem credential', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'dedalus-logout-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const credentialPath = join(root, 'config', 'credentials')
  const credentialStore = fileCredentialStore(credentialPath)
  await credentialStore.write(session())
  await chmod(credentialPath, 0o644)

  assert.deepEqual(await logout(credentialStore, () => provider()), {
    status: 'logged_out',
    revocationConfirmed: false,
  })
  assert.equal(await credentialStore.read(), null)
})
