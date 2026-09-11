import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { createProgram } from '../src/cli/runtime.js'
import type { OAuthSession } from '../src/auth/types.js'
import type { DedalusCommandOptions } from '../src/auth/commands.js'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'

import { getProgram as getGeneratedProgram } from '../src/commands/index.js'
import { AuthenticatedCommandClient } from '../src/auth/client.js'
import { addDedalusCommands, formatDedalusError } from '../src/auth/commands.js'
import { addMachineCommands, machineResultHandler } from '../src/commands/machines.js'

// In-process command fixtures model an interactive terminal; child CLI tests use pipes.
const initialTTY = process.stdin.isTTY
test.before(() => {
  process.stdin.isTTY = true
})
test.after(() => {
  process.stdin.isTTY = initialTTY
})

const fixture = (auth: DedalusCommandOptions = {}) => {
  const calls: { url: string; body: unknown; headers: Headers }[] = []
  const connections: string[] = []
  let output: unknown
  class SDK extends AuthenticatedCommandClient {
    constructor(options: ConstructorParameters<typeof AuthenticatedCommandClient>[0]) {
      super({
        ...options,
        maxRetries: 0,
        fetch: async (url, init) => {
          assert.ok(init)
          assert.ok(init.body === undefined || typeof init.body === 'string')
          calls.push({
            url: String(url),
            body: JSON.parse(init.body ?? '{}') as unknown,
            headers: new Headers(init.headers),
          })
          return new Response(JSON.stringify({ machine_id: 'dm-created', phase: 'accepted' }), {
            headers: { 'content-type': 'application/json' },
          })
        },
      })
    }
  }
  const connected = machineResultHandler(async (api, machineID) => {
    connections.push(machineID)
    await api.createSSHSession(machineID, 'fixture-public-key')
    await api.getMachineSSHSession(machineID, 'session-1')
  })
  const program = addMachineCommands(
    addDedalusCommands(
      getGeneratedProgram({
        SDK,
        formatError: formatDedalusError,
        handleResult: async (...args) => {
          if (await connected(...args)) return true
          output = args[0]
          return true
        },
      }),
      { environment: { DEDALUS_API_KEY: 'workload-key' }, ...auth },
    ),
  )
  return { program, calls, connections, output: () => output }
}

test('generated machines create uses server defaults then native SSH session methods', async () => {
  const f = fixture()
  await f.program.parseAsync(['node', 'dedalus', 'machines', 'create', '--ssh'])
  assert.deepEqual(
    f.calls.map(({ body }) => body),
    [{}, { public_key: 'fixture-public-key' }, {}],
  )
  assert.deepEqual(
    f.calls.map(({ url }) => new URL(url).pathname),
    ['/v1/machines', '/v1/machines/dm-created/ssh', '/v1/machines/dm-created/ssh/session-1'],
  )
  assert.ok(f.calls[0])
  assert.ok(f.calls[1])
  assert.ok(f.calls[0].headers.get('idempotency-key'))
  assert.ok(f.calls[1].headers.get('idempotency-key'))
  assert.equal(f.calls[0].headers.get('authorization'), 'Bearer workload-key')
  assert.deepEqual(f.connections, ['dm-created'])
  assert.equal(f.output(), undefined)
})

test('SSH preserves an explicit per-operation organization override', async () => {
  const f = fixture()
  await f.program.parseAsync([
    'node',
    'dedalus',
    'machines',
    'create',
    '--ssh',
    '--x-dedalus-org-id',
    'org-override',
  ])
  assert.equal(f.calls.length, 3)
  for (const request of f.calls)
    assert.equal(request.headers.get('x-dedalus-org-id'), 'org-override')
})

test('generated create preserves explicit sizing and organization flags', async () => {
  const f = fixture()
  await f.program.parseAsync([
    'node',
    'dedalus',
    'machines',
    'create',
    '--vcpu',
    '2',
    '--memory-mib',
    '2048',
    '--storage-gib',
    '20',
    '--autosleep',
    '30m',
    '--x-dedalus-org-id',
    'org-override',
  ])
  assert.ok(f.calls[0])
  assert.deepEqual(f.calls[0].body, {
    autosleep: '30m',
    memory_mib: 2048,
    storage_gib: 20,
    vcpu: 2,
  })
  assert.equal(f.calls[0].headers.get('x-dedalus-org-id'), 'org-override')
  assert.deepEqual(f.output(), { machine_id: 'dm-created', phase: 'accepted' })
  assert.deepEqual(f.connections, [])
})

test('SSH customization preserves generated command identity and siblings', () => {
  const program = getGeneratedProgram()
  const machines = program.commands.find((command) => command.name() === 'machines')
  assert.ok(machines)
  const create = machines.commands.find((command) => command.name() === 'create')
  assert.ok(create)
  const siblings = [...machines.commands]
  addMachineCommands(program)
  assert.deepEqual(machines.commands, siblings)
  assert.equal(
    machines.commands.find((command) => command.name() === 'create'),
    create,
  )
  assert.ok(create.options.some((option) => option.long === '--ssh'))
  assert.equal(create.options.filter((option) => option.long === '--vcpu').length, 1)
})

test('SSH fails closed when create omits machine_id', async () => {
  const program = fixture().program
  const machines = program.commands.find((command) => command.name() === 'machines')
  assert.ok(machines)
  const create = machines.commands.find((command) => command.name() === 'create')
  assert.ok(create)
  create.setOptionValue('ssh', true)
  await assert.rejects(
    machineResultHandler(async () => assert.fail('unexpected SSH'))(
      { phase: 'accepted' },
      new AuthenticatedCommandClient({ apiKey: 'fixture' }),
      create,
    ),
    /server returned no machine_id/u,
  )
})

test('create and SSH share stored OAuth gateway authentication', async () => {
  const session: OAuthSession = {
    version: 1,
    issuer: 'https://as.dedaluslabs.ai',
    clientId: 'dedalus-cli',
    resource: 'https://dcs.dedaluslabs.ai',
    gatewayURL: 'https://admin.api.dedaluslabs.ai/dcs',
    accessToken: 'fixture-access',
    accessTokenExpiresAt: 2_000_000_000_000,
    refreshToken: 'fixture-refresh',
    userId: 'user_cli',
    organizationId: 'org_cli',
    organizationName: 'Test',
    grantedScopes: ['offline_access', 'dedalus:cli'],
  }
  const f = fixture({
    environment: {},
    credentialStore: () => ({
      backend: 'keyring',
      read: async () => session,
      write: async () => {},
      remove: async () => true,
      withLifecycleLock: async (fn) => fn(),
    }),
    authProvider: () => ({
      issuer: session.issuer,
      clientId: session.clientId,
      resource: session.resource,
      gatewayURL: session.gatewayURL,
      login: async () => session,
      revoke: async () => true,
      refresh: async (value) => value,
    }),
  })
  await f.program.parseAsync(['node', 'dedalus', 'machines', 'create', '--ssh'])
  assert.deepEqual(f.connections, ['dm-created'])
  assert.equal(f.calls.length, 3)
  for (const request of f.calls) {
    assert.ok(request.url.startsWith(`${session.gatewayURL}/v1/machines`))
    assert.equal(request.headers.get('authorization'), 'Bearer fixture-access')
    assert.equal(request.headers.get('x-api-key'), null)
  }
})

const runCLI = (args: string[], stdin?: string) =>
  new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [
      fileURLToPath(new URL('../dist/esm/bin.js', import.meta.url)),
      ...args,
    ])
    let stdout = '',
      stderr = ''
    child.stdout.on('data', (value) => {
      stdout += value
    })
    child.stderr.on('data', (value) => {
      stderr += value
    })
    child.stdin.end(stdin)
    child.once('error', reject)
    child.once('close', (code) => resolve({ code, stdout, stderr }))
  })

const serverFixture = async (context: TestContext, status = 200) => {
  const requests: unknown[] = []
  const server = createServer(async (request, response) => {
    let body = ''
    for await (const chunk of request) body += chunk
    requests.push(JSON.parse(body) as unknown)
    response.writeHead(status, { 'content-type': 'application/json' })
    response.end(
      JSON.stringify(
        status === 200
          ? { machine_id: 'dm-created', phase: 'accepted' }
          : { error_code: 'AUTH_SCOPE_FORBIDDEN', message: 'private provider details' },
      ),
    )
  })
  context.after(() => server.close())
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  return {
    requests,
    args: [
      '--api-key',
      'fixture',
      '--base-url',
      `http://127.0.0.1:${address.port}`,
      'machines',
      'create',
    ],
  }
}

test('generated create retains piped JSON and output transforms', async (context) => {
  const f = await serverFixture(context)
  const result = await runCLI(
    [...f.args, '--format', 'json', '--transform', 'machine_id'],
    JSON.stringify({ vcpu: 2, autosleep: 'never' }),
  )
  assert.equal(result.code, 0, result.stderr)
  assert.deepEqual(f.requests, [{ vcpu: 2, autosleep: 'never' }])
  assert.equal(JSON.parse(result.stdout), 'dm-created')
})

test('generated create permission errors retain the secret-safe boundary', async (context) => {
  const f = await serverFixture(context, 403)
  const result = await runCLI([...f.args, '--ssh', '--format-error', 'json'])
  assert.notEqual(result.code, 0)
  assert.equal(JSON.parse(result.stderr).error.code, 'AUTH_SCOPE_FORBIDDEN')
  assert.doesNotMatch(result.stderr, /private|Error:|\n    at /u)
  assert.equal(result.stdout, '')
})

test('result hooks receive the constructed client with its inferred instance type', async () => {
  class FixtureClient {
    calls = 0
    execute() {
      this.calls += 1
      return 'result'
    }
  }
  let handled = false
  const program = createProgram({
    SDK: FixtureClient,
    binaryName: 'fixture',
    version: '1',
    description: '',
    defaultFormat: 'json',
    defaultErrorFormat: 'json',
    clientOptions: [],
    commands: [
      {
        resourcePath: [],
        commandPath: ['execute'],
        methodName: 'execute',
        transport: 'http',
        iterable: false,
        callShape: 'options',
        positional: [],
        flags: [],
      },
    ],
    handleResult: async (result, client) => {
      const calls: number = client.calls
      assert.equal(calls, 1)
      assert.equal(result, 'result')
      handled = true
      return true
    },
  })
  await program.parseAsync(['node', 'fixture', 'execute'])
  assert.equal(handled, true)
})
