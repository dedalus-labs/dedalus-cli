import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import os from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { connectMachine } from '../dist/esm/custom/ssh.js'

test('invariant_ssh_preserves_temporary_file_paths', async (t) => {
  const prefix = process.platform === 'win32' ? 'dedalus ssh paths-' : 'dedalus ssh "paths" \\-'
  const directory = await mkdtemp(join(os.tmpdir(), prefix))
  const spawn = childProcess.spawn
  let config = ''
  let diagnostics = ''
  let keyPath
  t.mock.method(os, 'tmpdir', () => directory)
  t.mock.method(childProcess, 'spawn', (command, args, options) => {
    if (command !== 'ssh') return spawn(command, args, options)
    keyPath = args[args.indexOf('-i') + 1]
    // Parse the production arguments with OpenSSH without opening a connection.
    const child = spawn(command, ['-G', '-F', 'none', ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', (chunk) => { config += chunk })
    child.stderr.on('data', (chunk) => { diagnostics += chunk })
    return child
  })
  syncBuiltinESMExports()
  try {
    await connectMachine({ createSSHSession: async () => ({
      machine_id: 'dm-00000000-0000-4000-8000-000000000111',
      session_id: 'ss-paths', status: 'ready',
      connection: {
        endpoint: 'localhost', port: 22, ssh_username: 'test', user_certificate: 'test-certificate',
        host_trust: { host_pattern: 'localhost', public_key: 'test-host-key' },
      },
    }) }, 'machine')
    assert.equal(process.exitCode, undefined, diagnostics)
    assert.ok(keyPath.startsWith(directory))
    const lines = config.split('\n')
    assert.ok(lines.includes(`identityfile ${keyPath}`), config)
    assert.ok(lines.includes(`certificatefile ${keyPath}-cert.pub`), config)
    assert.ok(lines.includes(`userknownhostsfile ${join(keyPath, '..', 'known_hosts')}`), config)
  } finally {
    t.mock.restoreAll()
    syncBuiltinESMExports()
    process.exitCode = undefined
    await rm(directory, { recursive: true, force: true })
  }
})
