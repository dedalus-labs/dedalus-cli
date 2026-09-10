import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { afterEach, test } from 'node:test'
import { Command } from 'commander'

import SDK from '../dist/esm/sdk/index.js'
import { getProgram } from '../dist/esm/index.js'
import { addMachineAliases, createMachineAPI } from '../dist/esm/custom/machines.js'
import { awaitSSHSession } from '../dist/esm/custom/ssh.js'

afterEach(() => { process.exitCode = undefined })

const capture = async (action) => {
  let stdout = ''
  let stderr = ''
  const originalOut = process.stdout.write
  const originalErr = process.stderr.write
  process.stdout.write = (value, ...args) => {
    if (typeof value !== 'string') return originalOut.call(process.stdout, value, ...args)
    stdout += value; return true
  }
  process.stderr.write = (value, ...args) => {
    if (typeof value !== 'string') return originalErr.call(process.stderr, value, ...args)
    stderr += value; return true
  }
  try { await action() } finally {
    process.stdout.write = originalOut
    process.stderr.write = originalErr
  }
  return { stdout, stderr }
}

const aliases = (options) => addMachineAliases(new Command()
  .enablePositionalOptions()
  .option('--format <format>', '', 'auto')
  .option('--format-error <format>', '', 'auto')
  .option('--transform <path>')
  .option('--raw-output')
  .option('--api-key <value>', '', 'test')
  .option('--x-dedalus-org-id <id>')
  .option('--base-url <url>'), [
  { clientKey: 'apiKey', sdkKey: 'apiKey', name: 'api-key', optionKey: 'apiKey', auth: true },
], options)

test('public program includes custom aliases alongside generated commands', () => {
  const program = getProgram()
  assert.ok(program.commands.some((command) => command.name() === 'ssh'))
  assert.ok(program.commands.some((command) => command.name() === 'rename'))
  assert.ok(program.commands.find((command) => command.name() === 'machines').commands.some((command) => command.name() === 'update'))
})

test('aliases retain CLI usage exit codes', () => {
  const result = spawnSync(process.execPath, ['dist/esm/bin.js', 'rename', 'only-current'], { encoding: 'utf8' })
  assert.equal(result.status, 2)
})

test('organization flag is exposed only when the generated commands expose it', () => {
  const plain = addMachineAliases(new Command(), [])
  assert.equal(plain.commands.find((command) => command.name() === 'ssh').options.some((option) =>
    option.long === '--x-dedalus-org-id'), false)
  const generated = getProgram()
  assert.equal(generated.commands.find((command) => command.name() === 'ssh').options.some((option) =>
    option.long === '--x-dedalus-org-id'), true)
})

test('SSH session creation sends the name; polling stays on canonical ID during rename', async () => {
  const requests = []
  const api = createMachineAPI(new SDK({ apiKey: 'test', maxRetries: 0, fetch: async (url, init) => {
    requests.push({ url: String(url), method: init.method, body: init.body })
    return Response.json({ machine_id: 'dm-00000000-0000-4000-8000-000000000111', session_id: 'ss-1',
      status: requests.length === 1 ? 'wake_in_progress' : 'ready', retry_after_ms: 1 })
  } }))
  await capture(() => awaitSSHSession(api, 'old-name', 'ssh-ed25519 public'))
  assert.ok(requests[0].url.endsWith('/v1/machines/old-name/ssh'))
  assert.deepEqual(JSON.parse(requests[0].body), { public_key: 'ssh-ed25519 public' })
  assert.ok(requests[1].url.endsWith('/v1/machines/dm-00000000-0000-4000-8000-000000000111/ssh/ss-1'))
})

test('SSH refuses to poll without a canonical ID', async () => {
  await assert.rejects(awaitSSHSession({ createSSHSession: async () => ({ session_id: 'ss-1', status: 'wake_in_progress' }),
    getMachineSSHSession: async () => { throw new Error('must not poll') },
  }, 'name', 'key'), /omitted machine_id/u)
})

test('rename sends only the unchanged name and respects auth, org, and JSON output globals', async () => {
  let request
  const program = aliases({ api: (client) => createMachineAPI(client.withOptions({ maxRetries: 0,
    fetch: async (url, init) => {
      request = { url: String(url), method: init.method, body: init.body, headers: new Headers(init.headers) }
      return Response.json({ machine_id: 'dm-00000000-0000-4000-8000-000000000111', name: 'new-name' })
    },
  })) })
  const output = await capture(() => program.parseAsync(['--api-key', 'test-credential', '--format', 'json',
    'rename', 'old-name', 'new-name', '--x-dedalus-org-id', 'org-1'], { from: 'user' }))
  assert.equal(request.method, 'PATCH')
  assert.ok(request.url.endsWith('/v1/machines/old-name'))
  assert.deepEqual(JSON.parse(request.body), { name: 'new-name' })
  assert.equal(request.headers.get('authorization'), 'Bearer test-credential')
  assert.equal(request.headers.get('x-dedalus-org-id'), 'org-1')
  assert.deepEqual(JSON.parse(output.stdout), { machine_id: 'dm-00000000-0000-4000-8000-000000000111', name: 'new-name' })
})

test('rename pretty output and transforms follow generated formatting', async () => {
  const result = { machine_id: 'dm-00000000-0000-4000-8000-000000000111', name: 'new-name' }
  const output = await capture(() => aliases({ api: () => ({ renameMachine: async () => result }) })
    .parseAsync(['--format', 'pretty', 'rename', 'old', 'new-name'], { from: 'user' }))
  assert.match(output.stdout, /rename/u)
  assert.match(output.stdout, /name: new-name/u)
  const raw = await capture(() => aliases({ api: () => ({ renameMachine: async () => result }) })
    .parseAsync(['rename', 'old', 'new-name', '--transform', 'machine_id', '--raw-output'], { from: 'user' }))
  assert.equal(raw.stdout, 'dm-00000000-0000-4000-8000-000000000111\n')
})

test('rename never claims success when server drops name or returns a different name', async () => {
  for (const result of [{ machine_id: 'dm-a' }, { machine_id: 'dm-a', name: 'wrong' }, { name: 'new-name' }]) {
    const output = await capture(() => aliases({ api: () => ({ renameMachine: async () => result }) })
      .parseAsync(['rename', 'old', 'new-name'], { from: 'user' }))
    assert.equal(output.stdout, '')
    assert.match(output.stderr, /did not confirm/u)
    assert.equal(process.exitCode, 1)
  }
})

test('rename surfaces API validation errors through CLI JSON error formatting', async () => {
  let sentName
  const output = await capture(() => aliases({ api: (client) => createMachineAPI(client.withOptions({
    maxRetries: 0, fetch: async (_url, init) => {
      sentName = JSON.parse(init.body).name
      return Response.json({ error: { message: 'name must be lowercase', code: 'invalid_name' } }, { status: 422 })
    },
  })) }).parseAsync(['rename', 'old', 'Do-Not-Normalize', '--format-error', 'json'], { from: 'user' }))
  assert.equal(sentName, 'Do-Not-Normalize')
  assert.equal(output.stdout, '')
  assert.doesNotThrow(() => JSON.parse(output.stderr))
  assert.match(output.stderr, /name must be lowercase/u)
  assert.notEqual(process.exitCode, 0)
})

test('rename requires a canonical response ID and preserves explicit machine identity', async () => {
  const canonicalID = 'dm-00000000-0000-4000-8000-000000000111'
  const differentID = 'dm-00000000-0000-4000-8000-000000000222'
  for (const [current, returnedID, success] of [
    ['old-name', canonicalID, true],
    ['old-name', 'dm-not-a-uuid', false],
    ['old-name', canonicalID.slice(3), false],
    ['old-name', 'dm-AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA', false],
    [canonicalID, canonicalID, true],
    [canonicalID.slice(3), canonicalID, true],
    [canonicalID, differentID, false],
    [canonicalID.slice(3), differentID, false],
  ]) {
    process.exitCode = undefined
    const output = await capture(() => aliases({ api: () => ({ renameMachine: async () => ({
      machine_id: returnedID, name: 'new-name',
    }) }) }).parseAsync(['rename', current, 'new-name'], { from: 'user' }))
    if (success) {
      assert.equal(JSON.parse(output.stdout).machine_id, canonicalID)
      assert.equal(output.stderr, '')
    } else {
      assert.equal(output.stdout, '')
      assert.match(output.stderr, /did not confirm/u)
      assert.equal(process.exitCode, 1)
    }
  }
})

test('each rename receives a fresh idempotency key and preserves it across HTTP retries', async () => {
  const keys = []
  const api = createMachineAPI(new SDK({ apiKey: 'test', maxRetries: 1, fetch: async (_url, init) => {
    keys.push(new Headers(init.headers).get('idempotency-key'))
    if (keys.length === 1) return Response.json({ message: 'try again' }, {
      status: 503, headers: { 'retry-after': '0.001' },
    })
    return Response.json({ machine_id: 'dm-00000000-0000-4000-8000-000000000111', name: 'new-name' })
  } }))
  await api.renameMachine('old-name', 'new-name')
  await api.renameMachine('new-name', 'other-name')
  assert.equal(keys.length, 3)
  assert.ok(keys.every((key) => typeof key === 'string' && key.length > 0))
  assert.equal(keys[0], keys[1])
  assert.notEqual(keys[1], keys[2])
})

test('invariant_output_format_honors_local_flags_over_global_defaults', async () => {
  const result = { machine_id: 'dm-00000000-0000-4000-8000-000000000111', name: 'new-name' }
  for (const [before, after] of [
    [['--format', 'yaml'], []],
    [[], ['--format', 'yaml']],
    [['--format', 'json'], ['--format', 'yaml']],
  ]) {
    const output = await capture(() => aliases({ api: () => ({ renameMachine: async () => result }) })
      .parseAsync([...before, 'rename', 'old', 'new-name', ...after], { from: 'user' }))
    assert.equal(output.stdout, `machine_id: ${result.machine_id}\nname: new-name\n`)
    assert.equal(output.stderr, '')
  }
})

test('invariant_error_format_honors_local_flags_over_global_defaults', async () => {
  for (const [before, after] of [
    [['--format-error', 'yaml'], []],
    [[], ['--format-error', 'yaml']],
    [['--format-error', 'json'], ['--format-error', 'yaml']],
  ]) {
    const output = await capture(() => aliases({ api: () => ({ renameMachine: async () => {
      throw new Error('access denied')
    } }) }).parseAsync([...before, 'rename', 'old', 'new-name', ...after], { from: 'user' }))
    assert.equal(output.stdout, '')
    assert.match(output.stderr, /^message: access denied\n/mu)
    assert.equal(process.exitCode, 1)
  }
})
