import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'

const root = resolve(process.env.CLI_PACKAGE_ROOT ?? '.')

test('invariant_ssh_cancellation_removes_credentials_and_stops_children', { timeout: 20000 }, async (t) => {
  for (const stage of ['keygen', 'poll', 'ssh']) {
    for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) {
      await t.test(`${stage} ${signal}`, async (t) => {
        const directory = mkdtempSync(join(tmpdir(), 'dedalus-ssh-lifetime-'))
        const fixture = join(directory, 'fixture.mjs')
        const childScript = join(directory, 'child.mjs')
        const receipt = join(directory, 'receipt.json')
        writeFileSync(childScript, `
          import { writeFileSync } from 'node:fs';
          writeFileSync(${JSON.stringify(receipt)}, JSON.stringify({ pid: process.pid, path: process.argv[2] }));
          console.log('ready');
          setInterval(() => {}, 1000);
        `)
        writeFileSync(fixture, `
          import childProcess from 'node:child_process';
          import { syncBuiltinESMExports } from 'node:module';
          import { writeFileSync } from 'node:fs';
          const spawn = childProcess.spawn;
          childProcess.spawn = (command, args, options) => {
            const path = args[args.indexOf(command === 'ssh' ? '-i' : '-f') + 1];
            if (command === 'ssh' || ${JSON.stringify(stage)} === 'keygen') {
              return spawn(process.execPath, [${JSON.stringify(childScript)}, path], { stdio: 'inherit' });
            }
            return spawn(command, args, options);
          };
          syncBuiltinESMExports();
          const { connectMachine } = await import(${JSON.stringify(pathToFileURL(join(root, 'dist/esm/custom/ssh.js')).href)});
          await connectMachine({ createSSHSession: async () => {
            if (${JSON.stringify(stage)} === 'poll') {
              writeFileSync(${JSON.stringify(receipt)}, JSON.stringify({ path: '' }));
              console.log('ready');
              return { machine_id: 'machine', session_id: 'session', status: 'wake_in_progress', retry_after_ms: 60000 };
            }
            return { machine_id: 'machine', session_id: 'session', status: 'ready', connection: {
              endpoint: 'localhost', port: 22, ssh_username: 'test', user_certificate: 'test-cert',
              host_trust: { host_pattern: 'localhost', public_key: 'test-host-key' },
            }};
          }}, 'machine');
        `)
        const child = spawn(process.execPath, [fixture], {
          env: { ...process.env, TMPDIR: directory }, stdio: ['ignore', 'pipe', 'pipe'],
        })
        t.after(() => { child.kill('SIGKILL'); rmSync(directory, { recursive: true, force: true }) })
        const closed = once(child, 'close')
        const exited = once(child, 'exit')
        let output = ''
        await new Promise((resolve, reject) => {
          child.stdout.on('data', (chunk) => { output += chunk; if (output.includes('ready')) resolve() })
          child.once('error', reject)
          child.once('exit', () => reject(new Error('fixture exited before cancellation')))
        })
        const receiptData = JSON.parse(readFileSync(receipt, 'utf8'))
        t.after(() => { if (receiptData.pid) { try { process.kill(receiptData.pid, 'SIGKILL') } catch {} } })
        child.kill(signal)
        const [exitCode, exitSignal] = await exited
        assert.equal(exitSignal, null)
        assert.equal(exitCode, code)
        await closed
        assert.deepEqual(readdirSync(directory).filter((name) => name.startsWith('dedalus-ssh-')), [])
        if (receiptData.path) assert.equal(existsSync(receiptData.path), false)
        if (receiptData.pid) {
          // Signal delivery and OS reaping finish asynchronously.
          for (let attempt = 0; attempt < 100; attempt += 1) {
            try { process.kill(receiptData.pid, 0) } catch { break }
            await new Promise((resolve) => setTimeout(resolve, 10))
          }
          assert.throws(() => process.kill(receiptData.pid, 0), { code: 'ESRCH' })
        }
      })
    }
  }
})
