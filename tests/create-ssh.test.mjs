import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

const root = resolve(process.env.CLI_PACKAGE_ROOT ?? '.')
const machineID = '00000000-0000-4000-8000-000000000111'
const sessionMachineID = '00000000-0000-4000-8000-000000000222'
const ready = { machine_id: sessionMachineID, session_id: 'session', status: 'ready', connection: {
  endpoint: 'localhost', port: 2222, ssh_username: 'root', user_certificate: 'test-certificate',
  host_trust: { host_pattern: 'localhost', public_key: 'test-host-key' },
} }

const fixture = async (t, { create = { machine_id: machineID }, createStatus = 200, session = ready } = {}) => {
  const directory = mkdtempSync(join(tmpdir(), "dedalus create ssh's test-"))
  const bin = join(directory, 'bin')
  const receipt = join(directory, 'ssh.json')
  const credentialFile = join(directory, 'credential.txt')
  writeFileSync(credentialFile, 'private-credential', { mode: 0o600 })
  mkdirSync(bin)
  symlinkSync(join(root, 'dist/esm/bin.js'), join(bin, 'dedalus'))
  writeFileSync(join(bin, 'ssh'), `#!${process.execPath}
    const { readFileSync, statSync, writeFileSync } = require('node:fs');
    const args = process.argv.slice(2);
    const key = args[args.indexOf('-i') + 1];
    const knownHosts = require('node:path').join(key, '..', 'known_hosts');
    writeFileSync(process.env.SSH_RECEIPT, JSON.stringify({ args, key,
      certificate: readFileSync(key + '-cert.pub', 'utf8'),
      knownHosts: readFileSync(knownHosts, 'utf8'),
      modes: [key, key + '-cert.pub', knownHosts].map((path) => statSync(path).mode & 0o777),
    }));
    if (process.env.TEST_TTY_INPUT) {
      console.log('INPUT_READY:' + Boolean(process.stdin.isTTY));
      process.stdin.once('data', (data) => {
        console.log('TTY:' + Boolean(process.stdin.isTTY) + ':' + data.toString().trim());
        process.exit(0);
      });
    } else {
      console.log('attached shell');
      process.exit(Number(process.env.SSH_EXIT ?? 0));
    }
  `, { mode: 0o700 })
  const requests = []
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    requests.push({ path: req.url, headers: req.headers, body: body ? JSON.parse(body) : undefined })
    res.writeHead(req.url === '/v1/machines' ? createStatus : 200, { 'content-type': 'application/json' })
    const response = req.url === '/v1/machines' ? create : req.method === 'POST' ? session : ready
    res.end(JSON.stringify(response))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { server.closeAllConnections(); server.close(); rmSync(directory, { recursive: true, force: true }) })
  const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('DEDALUS_')))
  const run = (args = [], input = '', env = {}, terminal = true, shellCommand) => new Promise((resolve, reject) => {
    const argv = shellCommand ?? [process.execPath, join(root, 'dist/esm/bin.js'), 'machines', 'create',
      '--base-url', `http://127.0.0.1:${server.address().port}`, '--max-retries', '0', ...args]
    const executable = terminal ? 'python3' : argv[0]
    const values = terminal ? [join('tests', 'fixtures', 'terminal.py'), ...argv] : argv.slice(1)
    const child = spawn(executable, values, {
      env: { ...cleanEnv, DEDALUS_API_KEY: 'test-key', DEDALUS_CREDENTIALS_FILE: join(directory, 'credentials.json'),
        PATH: `${bin}:${process.env.PATH}`, TMPDIR: directory, SSH_RECEIPT: receipt, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    t.after(() => { if (child.exitCode === null) child.kill('SIGTERM') })
    let stdout = '', stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.once('error', reject)
    child.once('close', (code) => resolve({ code, stdout, stderr }))
    child.stdin.end(input)
  })
  return { run, requests, receipt, credentialFile, baseURL: `http://127.0.0.1:${server.address().port}`,
    reconnect: (command, env) => run([], '', env, true, ['sh', '-c', command]),
  }
}

test('invariant_create_ssh_preserves_request_options_and_attaches_to_the_created_machine', { timeout: 10000, skip: process.platform === 'win32' }, async (t) => {
  const f = await fixture(t, { session: { ...ready, status: 'wake_in_progress', retry_after_ms: 1 } })
  const result = await f.run(['--ssh', '--api-key', 'explicit-key', '--dedalus-org-id', 'selected-org',
    '--vcpu', '0.5', '--memory-mib', '2048', '--format', 'yaml', '--transform', 'machine_id'], '{"storage_gib":12}')
  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stdout, 'attached shell\n')
  assert.deepEqual(f.requests.map(({ path }) => path), [
    '/v1/machines', `/v1/machines/${machineID}/ssh`, `/v1/machines/${sessionMachineID}/ssh/session`,
  ])
  assert.deepEqual(f.requests[0].body, { storage_gib: 12, vcpu: 0.5, memory_mib: 2048 })
  for (const { headers } of f.requests) {
    assert.equal(headers.authorization, 'Bearer explicit-key')
    assert.equal(headers['x-dedalus-org-id'], 'selected-org')
  }
  assert.match(f.requests[1].body.public_key, /^ssh-ed25519 /u)
  const ssh = JSON.parse(readFileSync(f.receipt, 'utf8'))
  assert.equal(ssh.args.at(-1), 'root@localhost')
  assert.ok(ssh.args.includes('StrictHostKeyChecking=yes'))
  assert.deepEqual(ssh.modes, [0o600, 0o600, 0o600])
  assert.equal(ssh.knownHosts, '@cert-authority localhost test-host-key\n')
  assert.equal(existsSync(ssh.key), false)
  assert.match(result.stderr, new RegExp(`dedalus ssh ${machineID}`, 'u'))
})

test('invariant_plain_create_preserves_machine_output_and_server_defaults', async (t) => {
  const f = await fixture(t)
  const result = await f.run(['--transform', 'machine_id', '--raw-output'], '', {}, false)
  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stdout.trim(), machineID)
  assert.deepEqual(f.requests.map(({ body }) => body), [{}])
  assert.equal(existsSync(f.receipt), false)
})

test('invariant_create_ssh_uses_server_defaults_and_propagates_shell_exit_status', { skip: process.platform === 'win32' }, async (t) => {
  const f = await fixture(t)
  const result = await f.run(['--ssh'], '', { SSH_EXIT: '23' })
  assert.equal(result.code, 23, result.stderr)
  assert.deepEqual(f.requests[0].body, {})
  assert.equal(existsSync(JSON.parse(readFileSync(f.receipt, 'utf8')).key), false)
})

test('invariant_failed_creation_never_starts_ssh', { skip: process.platform === 'win32' }, async (t) => {
  for (const options of [{ create: {} }, { createStatus: 401, create: { message: 'denied' } }]) {
    const f = await fixture(t, options)
    const result = await f.run(['--ssh'])
    assert.notEqual(result.code, 0)
    assert.equal(result.stdout, '')
    assert.equal(f.requests.length, 1)
    assert.equal(existsSync(f.receipt), false)
  }
})

test('invariant_failed_ssh_keeps_the_machine_recoverable', { skip: process.platform === 'win32' }, async (t) => {
  for (const status of ['failed', 'closed', 'expired', 'unknown']) {
    const f = await fixture(t, { session: { ...ready, status } })
    const result = await f.run(['--ssh'])
    assert.notEqual(result.code, 0)
    assert.equal(result.stdout, '')
    assert.match(result.stderr, new RegExp(`dedalus ssh ${machineID}`, 'u'))
    assert.equal(f.requests.length, 2)
    assert.equal(existsSync(f.receipt), false)
  }
})

test('invariant_piped_create_input_leaves_ssh_attached_to_the_terminal', { timeout: 10000, skip: process.platform === 'win32' }, async (t) => {
  const f = await fixture(t)
  const result = await f.run(['--ssh'], '{"vcpu":0.5}', { TEST_TTY_INPUT: 'interactive-input\n' })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /TTY:true:interactive-input/u)
  assert.deepEqual(f.requests[0].body, { vcpu: 0.5 })
})

test('invariant_noninteractive_create_ssh_rejects_before_creating_a_machine', { skip: process.platform === 'win32' }, async (t) => {
  const f = await fixture(t)
  const result = await f.run(['--ssh'], '{"vcpu":0.5}', {}, false)
  assert.equal(result.code, 2, result.stderr)
  assert.match(result.stderr, /controlling terminal/u)
  assert.deepEqual(f.requests, [])
})

test('invariant_reconnect_hint_preserves_scope_without_disclosing_credentials', { timeout: 15000, skip: process.platform === 'win32' }, async (t) => {
  for (const [flag, variable, header, prefix] of [
    ['--api-key', 'DEDALUS_API_KEY', 'authorization', 'Bearer '],
    ['--x-api-key', 'DEDALUS_X_API_KEY', 'x-api-key', ''],
    ['--api-key', undefined, 'authorization', 'Bearer '],
  ]) {
    const f = await fixture(t)
    const credential = variable ? 'private-credential' : '@' + f.credentialFile
    const failed = await f.run(['--ssh', flag, credential, '--dedalus-org-id', 'selected-org'], '', {
      SSH_EXIT: '23', DEDALUS_API_KEY: '',
    })
    assert.equal(failed.code, 23, failed.stderr)
    const command = failed.stderr.match(/Reconnect with: (.+)/u)?.[1]
    assert.ok(command, failed.stderr)
    assert.doesNotMatch(failed.stderr, /private-credential|test-key/u)
    const reconnect = await f.reconnect(command, {
      DEDALUS_BASE_URL: f.baseURL + '/wrong', DEDALUS_ORG_ID: 'wrong-org',
      DEDALUS_API_KEY: '', ...(variable ? { [variable]: 'private-credential' } : {}),
    })
    assert.equal(reconnect.code, 0, reconnect.stderr)
    assert.equal(f.requests.length, 3)
    assert.equal(f.requests[2].path, `/v1/machines/${machineID}/ssh`)
    assert.equal(f.requests[2].headers['x-dedalus-org-id'], 'selected-org')
    assert.equal(f.requests[2].headers[header], prefix + 'private-credential')
    if (variable) assert.ok(failed.stderr.includes('Set ' + variable))
  }
})
