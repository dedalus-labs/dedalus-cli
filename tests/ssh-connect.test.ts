// @custom
// Verify SSH credentials, subprocess status, and cancellation cleanup.
import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { once } from 'node:events'

import { awaitSSHSession, connectMachine } from '../src/ssh/connect.js'

const ready = {
  session_id: 'ss-test',
  status: 'ready',
  connection: {
    endpoint: 'fixture.example',
    port: 2222,
    ssh_username: 'root',
    user_certificate: 'fixture-cert',
    host_trust: { host_pattern: '*.example', public_key: 'ssh-ed25519 fixture-ca' },
  },
}

const waiting = { session_id: 'ss-test', status: 'wake_in_progress', retry_after_ms: 1 }

test('invariant SSH polling follows the created machine and session', async () => {
  let polls = 0
  const result = await awaitSSHSession(
    {
      createSSHSession: async (machine, key) => {
        assert.equal(machine, 'dm-test')
        assert.equal(key, 'pub')
        return waiting
      },
      getMachineSSHSession: async (machine, session) => {
        assert.equal(machine, 'dm-test')
        assert.equal(session, 'ss-test')
        polls++
        return ready
      },
    },
    'dm-test',
    'pub',
  )
  assert.deepEqual(result, ready)
  assert.equal(polls, 1)
})

test('invariant terminal errors and malformed polling responses stop without polling', async () => {
  for (const session of [
    ...['failed', 'expired', 'closed', 'unknown'].map((status) => ({ ...waiting, status })),
    { ...waiting, retry_after_ms: -1 },
    { status: 'ready' },
  ]) {
    let polls = 0
    await assert.rejects(
      awaitSSHSession(
        {
          createSSHSession: async () => session,
          getMachineSSHSession: async () => {
            polls++
            return ready
          },
        },
        'dm-test',
        'pub',
      ),
    )
    assert.equal(polls, 0)
  }
})

test('invariant SSH uses server trust, propagates exit status and removes credentials', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dedalus-ssh-test-'))
  const previousPath = process.env.PATH
  const previousExit = process.exitCode
  try {
    const record = join(directory, 'record.json')
    const executable = (source: string) => `#!${process.execPath}\n${source}\n`
    await writeFile(
      join(directory, 'ssh-keygen'),
      executable(`
      const fs = require('node:fs'); const args = process.argv.slice(2);
      const key = args[args.indexOf('-f') + 1];
      fs.writeFileSync(key, 'fixture-private-key', { mode: 0o600 });
      fs.writeFileSync(key + '.pub', 'ssh-ed25519 fixture-key');
    `),
      { mode: 0o755 },
    )
    await writeFile(
      join(directory, 'ssh'),
      executable(`
      const fs = require('node:fs'); const args = process.argv.slice(2);
      const key = args[args.indexOf('-i') + 1];
      const option = name => args.find(value => value.startsWith(name + '=')).slice(name.length + 1);
      const certificate = option('CertificateFile'); const hosts = option('UserKnownHostsFile');
      fs.writeFileSync(${JSON.stringify(record)}, JSON.stringify({
        args, key, certificate: fs.readFileSync(certificate, 'utf8'),
        hosts: fs.readFileSync(hosts, 'utf8'), mode: fs.statSync(certificate).mode & 0o777,
      }));
      process.exit(7);
    `),
      { mode: 0o755 },
    )
    process.env.PATH = `${directory}:${previousPath}`
    await connectMachine(
      {
        createSSHSession: async (machine, key) => {
          assert.equal(machine, 'dm-test')
          assert.equal(key, 'ssh-ed25519 fixture-key')
          return ready
        },
        getMachineSSHSession: async () => {
          throw new Error('unexpected poll')
        },
      },
      'dm-test',
    )
    const result = JSON.parse(await readFile(record, 'utf8'))
    assert.equal(process.exitCode, 7)
    assert.equal(result.mode, 0o600)
    assert.ok(result.args.includes('StrictHostKeyChecking=yes'))
    assert.ok(result.args.includes('IdentitiesOnly=yes'))
    assert.equal(result.args.at(-2), '--')
    assert.equal(result.args.at(-1), 'root@fixture.example')
    assert.equal(result.certificate, 'fixture-cert\n')
    assert.equal(result.hosts, '@cert-authority *.example ssh-ed25519 fixture-ca\n')
    await assert.rejects(access(result.key), { code: 'ENOENT' })
  } finally {
    if (previousPath === undefined) delete process.env.PATH
    else process.env.PATH = previousPath
    process.exitCode = previousExit
    await rm(directory, { recursive: true, force: true })
  }
})

test('invariant SIGINT and SIGTERM remove private credentials during SSH setup', async () => {
  const { spawn } = await import('node:child_process')
  const directory = await mkdtemp(join(tmpdir(), 'dedalus-signal-test-'))
  const record = join(directory, 'key-path')
  try {
    await writeFile(
      join(directory, 'ssh-keygen'),
      `#!${process.execPath}\n
      const fs = require('node:fs'); const args = process.argv.slice(2);
      const key = args[args.indexOf('-f') + 1];
      fs.writeFileSync(key, 'fixture-private-key', {mode:0o600});
      fs.writeFileSync(key + '.pub', 'ssh-ed25519 fixture');
      fs.writeFileSync(${JSON.stringify(record)}, key);
    `,
      { mode: 0o755 },
    )
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      const child = spawn(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `
        import {connectMachine} from ${JSON.stringify(new URL('../dist/esm/ssh/connect.js', import.meta.url).href)};
        const keepAlive = setInterval(()=>{},1000);
        await connectMachine({createSSHSession:async()=>{
          process.send('waiting'); return new Promise(()=>{});
        }},'dm-test');
        clearInterval(keepAlive);
      `,
        ],
        {
          env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
          stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
        },
      )
      const exited = once(child, 'exit')
      try {
        await once(child, 'message', { signal: AbortSignal.timeout(10000) })
        const key = await readFile(record, 'utf8')
        await access(key)
        child.kill(signal)
        const [code] = await exited
        await assert.rejects(access(key), { code: 'ENOENT' })
        assert.equal(code, signal === 'SIGINT' ? 130 : 143)
      } finally {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
      }
    }
  } finally {
    // Also remove credentials deliberately left behind by the red regression run.
    try {
      await rm(join(await readFile(record, 'utf8'), '..'), { recursive: true, force: true })
    } catch {}
    await rm(directory, { recursive: true, force: true })
  }
})
