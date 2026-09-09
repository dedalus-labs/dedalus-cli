import assert from 'node:assert/strict'
import test from 'node:test'

import { Command } from 'commander'

import { addDedalusCommands } from '../dist/esm/custom/commands.js'
import { createMachineAPI } from '../dist/esm/custom/machines.js'

const addMachines = (overrides = {}) => {
  const calls = []
  const connections = []
  let output = ''
  const program = new Command()
  addDedalusCommands(program, {
    environment: { DEDALUS_API_KEY: 'workload-key' },
    writeOutput: (value) => { output += value },
    machines: {
      api: (options) => ({
        createMachine: async (body) => {
          calls.push({ body, options })
          return { machine_id: 'dm-created', phase: 'accepted' }
        },
        createSSHSession: async () => { throw new Error('unexpected SSH session') },
        getMachineSSHSession: async () => { throw new Error('unexpected SSH poll') },
      }),
      connect: async (_api, machineID) => { connections.push(machineID) },
      ...overrides,
    },
  })
  return { calls, connections, output: () => output, program }
}

test('invariant machines create --connect uses API defaults and connects the created machine', async () => {
  const fixture = addMachines()
  await fixture.program.parseAsync(['node', 'dedalus', 'machines', 'create', '--connect'])

  assert.deepEqual(fixture.calls[0].body, {})
  assert.equal(fixture.calls[0].options.apiKey, 'workload-key')
  assert.equal(fixture.calls[0].options.bearerAuth, null)
  assert.equal(fixture.calls[0].options.xAPIKey, null)
  assert.deepEqual(fixture.connections, ['dm-created'])
  assert.equal(fixture.output(), '')
})

test('invariant the machines adapter uses Scalar transport with an empty JSON body', async () => {
  const requests = []
  const api = createMachineAPI({
    apiKey: 'workload-key',
    baseURL: 'https://api.example.test',
    maxRetries: 0,
    fetch: async (url, init) => {
      requests.push({ url: String(url), init })
      return new Response(JSON.stringify({ machine_id: 'dm-created' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })

  assert.deepEqual(await api.createMachine({}), { machine_id: 'dm-created' })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, 'https://api.example.test/v1/machines')
  assert.equal(requests[0].init.method, 'POST')
  assert.equal(requests[0].init.body, '{}')
  const headers = new Headers(requests[0].init.headers)
  assert.equal(headers.get('authorization'), 'Bearer workload-key')
  assert.ok(headers.get('idempotency-key'))
})

test('invariant machines create preserves explicit shape overrides', async () => {
  const fixture = addMachines()

  await fixture.program.parseAsync(['node', 'dedalus', 'machines', 'create',
    '--vcpu', '2', '--memory-mib', '2048', '--storage-gib', '20', '--autosleep', '30m'])

  assert.deepEqual(fixture.calls[0].body, {
    autosleep: '30m',
    memory_mib: 2048,
    storage_gib: 20,
    vcpu: 2,
  })
  assert.deepEqual(JSON.parse(fixture.output()), {
    machine_id: 'dm-created',
    phase: 'accepted',
  })
  assert.deepEqual(fixture.connections, [])
})

test('invariant Scalar generated commands cannot shadow the machines adapter', () => {
  const machines = new Command('machines').addCommand(new Command('create'))
  assert.throws(() => addDedalusCommands(new Command().addCommand(machines)),
    /Scalar generated the reserved 'machines create' command/u)
})

test('invariant connect fails closed when create omits machine_id', async () => {
  const fixture = addMachines({
    api: () => ({
      createMachine: async () => ({ phase: 'accepted' }),
      createSSHSession: async () => { throw new Error('unexpected SSH session') },
      getMachineSSHSession: async () => { throw new Error('unexpected SSH poll') },
    }),
  })

  await assert.rejects(
    fixture.program.parseAsync(['node', 'dedalus', 'machines', 'create', '--connect']),
    /server returned no machine_id/u,
  )
  assert.deepEqual(fixture.connections, [])
})

test('invariant create and connect share the authenticated OAuth gateway client', async () => {
  const session = {
    version: 1, issuer: 'https://clerk.example.com', clientId: 'client_cli',
    accessToken: 'fixture-access', accessTokenExpiresAt: 2_000_000_000_000,
    refreshToken: 'fixture-refresh', userId: 'user_cli', organizationId: 'org_cli',
    organizationName: 'Test', grantedScopes: ['offline_access', 'user:org:read'],
  }
  let clientOptions
  let connected
  const api = { createMachine: async () => ({ machine_id: 'dm-created' }) }
  const program = new Command()
  addDedalusCommands(program, {
    environment: { DEDALUS_BASE_URL: 'https://dev.admin.api.dedaluslabs.ai/dcs' },
    credentialStore: () => ({
      backend: 'file', read: async () => session, write: async () => {}, remove: async () => true,
      withLifecycleLock: async (operation) => operation(),
    }),
    authProvider: () => ({ issuer: session.issuer, clientId: session.clientId, refresh: async (value) => value }),
    machines: {
      api: (options) => { clientOptions = options; return api },
      connect: async (client, machine) => { assert.equal(client, api); connected = machine },
    },
  })
  await program.parseAsync(['node', 'dedalus', 'machines', 'create', '--connect'])
  assert.equal(connected, 'dm-created')
  assert.equal(clientOptions.baseURL, 'https://dev.admin.api.dedaluslabs.ai/dcs')
  assert.equal(clientOptions.bearerAuth, session.accessToken)
  assert.equal(clientOptions.apiKey, null)
  assert.equal(clientOptions.xAPIKey, null)
})
