import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { afterEach, test } from 'node:test'
import { Command } from 'commander'

import SDK from '../dist/esm/sdk/index.js'
import { getProgram } from '../dist/esm/index.js'
import { addMachineAliases, createMachineAPI } from '../dist/esm/custom/machines.js'
import { loadMachineChoices, matchingMachines, renderPicker, updatePicker } from '../dist/esm/custom/ssh-picker.js'
import { awaitSSHSession } from '../dist/esm/custom/ssh.js'

afterEach(() => { process.exitCode = undefined })

const machine = (id, name, phase = 'running') => ({
  machine_id: id, name, desired_state: 'running', phase,
})

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
  assert.equal(program.commands.some((command) => command.name() === 'rename'), false)
  assert.ok(program.commands.find((command) => command.name() === 'machines').commands.some((command) => command.name() === 'update'))
})

test('SSH explicit IDs bypass the picker even without a TTY', async () => {
  for (const target of ['00000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-000000000123']) {
    const connected = []
    const program = aliases({ api: () => ({}), interactive: () => false,
      pick: () => { throw new Error('unexpected picker') },
      connect: async (_api, id) => { connected.push(id) },
    })
    await program.parseAsync(['ssh', target], { from: 'user' })
    assert.deepEqual(connected, [target])
  }
})

test('SSH picker selection transmits stable ID and cancellation creates no session', async () => {
  for (const selected of ['00000000-0000-4000-8000-000000000111', undefined]) {
    const connected = []
    const program = aliases({ api: () => ({}), interactive: () => true,
      pick: async () => selected, connect: async (_api, id) => { connected.push(id) },
    })
    await program.parseAsync(['ssh'], { from: 'user' })
    assert.deepEqual(connected, selected === undefined ? [] : [selected])
  }
})

test('SSH without a TTY or target exits promptly with actionable usage', () => {
  const result = spawnSync(process.execPath, ['dist/esm/bin.js', 'ssh'], { encoding: 'utf8', timeout: 3000 })
  assert.equal(result.status, 2)
  assert.match(result.stderr, /interactive terminal.*dedalus ssh <machine-id>/u)
  assert.equal(result.stdout, '')
})

test('aliases retain CLI usage exit codes', () => {
  const result = spawnSync(process.execPath, ['dist/esm/bin.js', 'ssh', 'not-a-uuid'], { encoding: 'utf8' })
  assert.equal(result.status, 2)
})

test('organization flag is exposed only when the generated commands expose it', () => {
  const plain = addMachineAliases(new Command(), [])
  assert.equal(plain.commands.find((command) => command.name() === 'ssh').options.some((option) =>
    option.long === '--x-dedalus-org-id'), false)
  const source = new Command()
  source.command('machines').command('retrieve').option('--x-dedalus-org-id <id>')
  const generated = addMachineAliases(source, [])
  assert.equal(generated.commands.find((command) => command.name() === 'ssh').options.some((option) =>
    option.long === '--x-dedalus-org-id'), true)
  assert.equal(getProgram().commands.find((command) => command.name() === 'ssh').options.some((option) =>
    option.long === '--x-dedalus-org-id'), false)
})

test('invariant_picker_reads_list_phases_keeps_unnamed_and_skips_destroyed', async () => {
  const cursors = []
  const pages = [
    { items: [machine('00000000-0000-4000-8000-000000000001', 'one'), { ...machine('00000000-0000-4000-8000-000000000003', 'dying'), desired_state: 'destroyed' }], next_cursor: 'page-2' },
    { items: [], next_cursor: 'page-3' },
    { items: [machine('00000000-0000-4000-8000-000000000002', null, 'sleeping'), machine('00000000-0000-4000-8000-000000000004', 'gone', 'destroyed')], next_cursor: null },
  ]
  const choices = await loadMachineChoices({ listMachines: async (cursor) => {
    cursors.push(cursor)
    return pages.shift()
  } }, new AbortController().signal)
  assert.deepEqual(cursors, [undefined, 'page-2', 'page-3'])
  assert.deepEqual(choices, [
    { id: '00000000-0000-4000-8000-000000000001', name: 'one', status: 'running' },
    { id: '00000000-0000-4000-8000-000000000002', name: null, status: 'sleeping' },
  ])
})

test('picker propagates load errors and reports empty fleet', async () => {
  await assert.rejects(loadMachineChoices({ listMachines: async () => {
    throw new Error('access denied')
  } }, new AbortController().signal), /access denied/u)
  await assert.rejects(loadMachineChoices({ listMachines: async () => ({ items: [], next_cursor: null }) },
    new AbortController().signal), /No machines available.*dedalus machines create/u)
})

test('picker refuses malformed names and repeating pagination cursors', async () => {
  await assert.rejects(loadMachineChoices({ listMachines: async () => ({ items: [machine('not-a-uuid', 123)] }) },
    new AbortController().signal), /invalid name/u)
  await assert.rejects(loadMachineChoices({ listMachines: async () => ({ items: [], next_cursor: 'repeat' }) },
    new AbortController().signal), /repeated cursor/u)
})

test('picker search covers names, IDs, status; navigation and editing keep a valid selection', () => {
  let state = { machines: [
    { id: '00000000-0000-4000-8000-000000000001', name: 'alpha', status: 'running' },
    { id: '00000000-0000-4000-8000-000000000002', name: 'beta', status: 'sleeping' },
  ], query: '', cursor: 0 }
  state = updatePicker(state, '', { name: 'down' })
  assert.equal(matchingMachines(state)[state.cursor].id, '00000000-0000-4000-8000-000000000002')
  state = updatePicker(state, 'ALPHA', {})
  assert.deepEqual(matchingMachines(state).map(({ id }) => id), ['00000000-0000-4000-8000-000000000001'])
  assert.equal(state.cursor, 0)
  for (const query of ['00000000-0000-4000-8000-000000000002', 'SLEEPING', 'beta']) {
    assert.deepEqual(matchingMachines({ ...state, query }).map(({ id }) => id), ['00000000-0000-4000-8000-000000000002'])
  }
  state = updatePicker(state, '', { name: 'u', ctrl: true })
  assert.equal(state.query, '')
  state = updatePicker(state, 'z', {})
  assert.deepEqual(matchingMachines(state), [])
  assert.match(renderPicker(state, 24, 100), /No matching machines/u)
  state = updatePicker(state, '', { name: 'backspace' })
  assert.equal(matchingMachines(state).length, 2)
  const view = renderPicker(state, 24, 100)
  assert.match(view, /> alpha  \[running\]\n    00000000-0000-4000-8000-000000000001/u)
  assert.match(view, /beta  \[sleeping\]\n    00000000-0000-4000-8000-000000000002/u)
})

test('SSH session creation and polling use the returned canonical ID', async () => {
  const requests = []
  const api = createMachineAPI(new SDK({ apiKey: 'test', maxRetries: 0, fetch: async (url, init) => {
    requests.push({ url: String(url), method: init.method, body: init.body })
    return Response.json({ machine_id: '00000000-0000-4000-8000-000000000111', session_id: '00000000-0000-4000-8000-000000000010',
      status: ['wake_in_progress', 'ssh_in_progress', 'ready'][requests.length - 1], retry_after_ms: 1 })
  } }))
  await capture(() => awaitSSHSession(api, '00000000-0000-4000-8000-000000000111', 'ssh-ed25519 public'))
  assert.ok(requests[0].url.endsWith('/v1/machines/00000000-0000-4000-8000-000000000111/ssh'))
  assert.deepEqual(JSON.parse(requests[0].body), { public_key: 'ssh-ed25519 public' })
  assert.equal(requests.length, 3)
  for (const request of requests.slice(1)) {
    assert.ok(request.url.endsWith('/v1/machines/00000000-0000-4000-8000-000000000111/ssh/00000000-0000-4000-8000-000000000010'))
  }
})

test('SSH refuses to poll without a canonical ID', async () => {
  await assert.rejects(awaitSSHSession({ createSSHSession: async () => ({ session_id: '00000000-0000-4000-8000-000000000010', status: 'wake_in_progress' }),
    getMachineSSHSession: async () => { throw new Error('must not poll') },
  }, 'name', 'key'), /omitted machine_id/u)
})
