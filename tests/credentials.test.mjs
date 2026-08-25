import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'

import {
  CredentialStorageError,
  defaultCredentialStore,
  fileCredentialStore,
  keyringCredentialStore,
  resolveCredential,
} from '../dist/esm/custom/auth/credentials.js'

const run = promisify(execFile)

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

test('invariant workload flags win without reading lower-priority sources', async () => {
  let storedReads = 0
  const credential = await resolveCredential({
    flags: { apiKey: 'flag-key' },
    environment: { DEDALUS_API_KEY: 'environment-key' },
    storedAccessToken: async () => {
      storedReads += 1
      return 'oauth-token'
    },
  })

  assert.deepEqual(credential, {
    value: 'flag-key',
    source: 'flag',
    transport: 'bearer',
  })
  assert.equal(storedReads, 0)
})

test('invariant custom headers cannot replace the selected credential', async () => {
  for (const header of ['Authorization: Bearer bypass-token', 'x-API-key: bypass-token']) {
    await assert.rejects(
      resolveCredential({
        flags: { apiKey: 'selected-key' },
        environment: { DEDALUS_CUSTOM_HEADERS: header },
        storedAccessToken: async () => 'stored-token',
      }),
      (error) => error instanceof CredentialStorageError && error.code === 'unsupported_credential',
    )
  }
})

test('invariant a workload flag ignores a lower-priority Bearer environment override', async () => {
  let storedReads = 0
  const credential = await resolveCredential({
    flags: { apiKey: 'flag-key' },
    environment: { DEDALUS_BEARER_AUTH: 'unsupported-lower-priority-token' },
    storedAccessToken: async () => {
      storedReads += 1
      return 'oauth-token'
    },
  })

  assert.deepEqual(credential, {
    value: 'flag-key',
    source: 'flag',
    transport: 'bearer',
  })
  assert.equal(storedReads, 0)
})

test('invariant workload environment credentials win without reading OAuth storage', async () => {
  let storedReads = 0
  const credential = await resolveCredential({
    flags: {},
    environment: { DEDALUS_X_API_KEY: 'environment-key' },
    storedAccessToken: async () => {
      storedReads += 1
      return 'oauth-token'
    },
  })

  assert.deepEqual(credential, {
    value: 'environment-key',
    source: 'environment',
    transport: 'x-api-key',
  })
  assert.equal(storedReads, 0)
})

test('invariant credential sources never merge within one priority', async () => {
  await assert.rejects(
    resolveCredential({
      flags: { apiKey: 'first-key', xApiKey: 'second-key' },
      environment: {},
      storedAccessToken: async () => null,
    }),
    (error) => error instanceof CredentialStorageError && error.code === 'ambiguous_credential',
  )
})

test('invariant a stored OAuth token is selected only without a workload override', async () => {
  assert.deepEqual(await resolveCredential({
    flags: {},
    environment: {},
    storedAccessToken: async () => 'oauth-token',
  }), {
    value: 'oauth-token',
    source: 'oauth_session',
    transport: 'bearer',
  })
})

test('invariant filesystem storage persists the provider-neutral token set privately', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'dedalus-credentials-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const credentialPath = join(root, 'config', 'credentials')
  const store = fileCredentialStore(credentialPath)

  await store.write(session())

  assert.deepEqual(await store.read(), session())
  assert.equal((await stat(join(root, 'config'))).mode & 0o777, 0o700)
  assert.equal((await stat(credentialPath)).mode & 0o777, 0o600)
  const persisted = JSON.parse(await readFile(credentialPath, 'utf8'))
  assert.equal(persisted.access_token, 'oauth-access-token')
  assert.equal(persisted.refresh_token, 'oauth-refresh-token')
  assert.equal(persisted.org_id, 'org_cli')
  assert.equal('api_key' in persisted, false)
})

test('invariant filesystem lifecycle mutations are serialized across stores', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'dedalus-credentials-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const credentialPath = join(root, 'config', 'credentials')
  const firstStore = fileCredentialStore(credentialPath)
  const secondStore = fileCredentialStore(credentialPath)
  const events = []
  let enterFirst
  let releaseFirst
  const firstEntered = new Promise((resolve) => { enterFirst = resolve })
  const holdFirst = new Promise((resolve) => { releaseFirst = resolve })

  const first = firstStore.withLifecycleLock(async () => {
    events.push('first:start')
    enterFirst()
    await holdFirst
    events.push('first:end')
  })
  await firstEntered
  const second = secondStore.withLifecycleLock(async () => { events.push('second') })
  await new Promise((resolve) => setImmediate(resolve))

  assert.deepEqual(events, ['first:start'])
  releaseFirst()
  await Promise.all([first, second])
  assert.deepEqual(events, ['first:start', 'first:end', 'second'])
})

test('invariant filesystem storage rejects token files readable by other users', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'dedalus-credentials-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const credentialPath = join(root, 'config', 'credentials')
  const store = fileCredentialStore(credentialPath)
  await store.write(session())
  await chmod(credentialPath, 0o644)

  await assert.rejects(
    store.read(),
    (error) => error instanceof CredentialStorageError && error.code === 'insecure_permissions',
  )
})

test('invariant filesystem storage rejects oversized credential files', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'dedalus-credentials-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const credentialPath = join(root, 'config', 'credentials')
  const credentialStore = fileCredentialStore(credentialPath)
  await credentialStore.write(session())
  await writeFile(credentialPath, ' '.repeat(513 * 1024), { mode: 0o600 })

  await assert.rejects(
    credentialStore.read(),
    (error) => error instanceof CredentialStorageError && error.code === 'invalid_credential',
  )
})

test('invariant filesystem storage never follows a credential symlink', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'dedalus-credentials-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const targetPath = join(root, 'target', 'credentials')
  await fileCredentialStore(targetPath).write(session())
  const linkDirectory = join(root, 'link')
  await mkdir(linkDirectory, { mode: 0o700 })
  const linkPath = join(linkDirectory, 'credentials')
  await symlink(targetPath, linkPath)
  const linkedStore = fileCredentialStore(linkPath)

  await assert.rejects(
    linkedStore.read(),
    (error) => error instanceof CredentialStorageError && error.code === 'insecure_permissions',
  )
  await assert.rejects(
    linkedStore.remove(),
    (error) => error instanceof CredentialStorageError && error.code === 'insecure_permissions',
  )
  assert.deepEqual(await fileCredentialStore(targetPath).read(), session())
})

test('invariant a non-regular credential path cannot block reads', async (context) => {
  if (process.platform === 'win32') return context.skip('FIFOs are POSIX-only')
  const root = await mkdtemp(join(tmpdir(), 'dedalus-credentials-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const directory = join(root, 'config')
  const credentialPath = join(directory, 'credentials')
  await mkdir(directory, { mode: 0o700 })
  await run('mkfifo', [credentialPath])
  await chmod(credentialPath, 0o600)

  await assert.rejects(
    fileCredentialStore(credentialPath).read(),
    (error) => error instanceof CredentialStorageError && error.code === 'insecure_permissions',
  )
})

test('invariant filesystem removal rejects an unsafe parent directory', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'dedalus-credentials-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const directory = join(root, 'config')
  const credentialPath = join(directory, 'credentials')
  const credentialStore = fileCredentialStore(credentialPath)
  await credentialStore.write(session())
  await chmod(directory, 0o755)

  await assert.rejects(
    credentialStore.remove(),
    (error) => error instanceof CredentialStorageError && error.code === 'insecure_permissions',
  )
  assert.equal((await stat(credentialPath)).isFile(), true)
})

test('invariant filesystem removal is idempotent for a missing credential', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'dedalus-credentials-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const directory = join(root, 'config')
  await mkdir(directory, { mode: 0o700 })

  assert.equal(await fileCredentialStore(join(directory, 'credentials')).remove(), false)
})

test('invariant legacy raw-key storage cannot be interpreted as an OAuth session', async () => {
  let stored = JSON.stringify({ version: 1, current: 'legacy-api-key' })
  const store = keyringCredentialStore(async () => ({
    getPassword: async () => stored,
    setPassword: async (value) => { stored = value },
    deleteCredential: async () => true,
  }))

  await assert.rejects(
    store.read(),
    (error) => error instanceof CredentialStorageError && error.code === 'invalid_credential',
  )
})

test('invariant the keyring adapter owns OAuth session read, write, and removal', async () => {
  let stored
  const store = keyringCredentialStore(async () => ({
    getPassword: async () => stored,
    setPassword: async (value) => { stored = value },
    deleteCredential: async () => {
      const existed = stored !== undefined
      stored = undefined
      return existed
    },
  }))

  assert.equal(await store.read(), null)
  await store.write(session())
  assert.deepEqual(await store.read(), session())
  assert.equal(await store.remove(), true)
  assert.equal(await store.read(), null)
})

test('invariant a missing native keyring entry is not a corrupt credential', async () => {
  const store = keyringCredentialStore(async () => ({
    getPassword: async () => null,
    setPassword: async () => {},
    deleteCredential: async () => false,
  }))

  assert.equal(await store.read(), null)
})

test('invariant an empty keyring record fails closed', async () => {
  const store = keyringCredentialStore(async () => ({
    getPassword: async () => '',
    setPassword: async () => {},
    deleteCredential: async () => false,
  }))

  await assert.rejects(
    store.read(),
    (error) => error instanceof CredentialStorageError && error.code === 'invalid_credential',
  )
})

test('invariant stored expiry must be printable as an ISO timestamp', async () => {
  const store = keyringCredentialStore(async () => ({
    getPassword: async () => undefined,
    setPassword: async () => {},
    deleteCredential: async () => false,
  }))

  await assert.rejects(
    store.write(session({ accessTokenExpiresAt: 8_700_000_000_000_000 })),
    (error) => error instanceof CredentialStorageError && error.code === 'invalid_credential',
  )
})

test('invariant credential backend selection follows the host platform', () => {
  assert.equal(defaultCredentialStore({ platform: 'darwin', environment: {} }).backend, 'keyring')
  assert.equal(defaultCredentialStore({ platform: 'win32', environment: {} }).backend, 'keyring')
  assert.equal(defaultCredentialStore({
    platform: 'linux',
    environment: {},
    credentialPath: '/tmp/dedalus-test-credentials',
  }).backend, 'file')
})
