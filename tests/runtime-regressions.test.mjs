import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import test from 'node:test'

import { CommandClient } from '../dist/esm/commands/client.js'

const commandDefinition = (transport) => ({
  resourcePath: ['probe'],
  commandPath: ['probe'],
  methodName: 'run',
  transport,
  iterable: transport === 'websocket',
  callShape: 'params',
  positional: [],
  flags: [],
})

const programSource = (sdkSource, transport) => `
  import { createProgram } from './dist/esm/cli/runtime.js'
  ${sdkSource}
  const program = createProgram({
    SDK,
    binaryName: 'dedalus-test',
    version: '0.0.0',
    description: 'runtime regression probe',
    defaultFormat: 'json',
    defaultErrorFormat: 'json',
    clientOptions: [],
    commands: [${JSON.stringify(commandDefinition(transport))}],
  })
  await program.parseAsync(['node', 'dedalus-test', 'probe'])
`

const runProgram = (source, input, delayMs = 0) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8').on('data', (value) => { stdout += value })
  child.stderr.setEncoding('utf8').on('data', (value) => { stderr += value })
  child.once('error', reject)
  child.once('close', (code) => code === 0
    ? resolve({ stdout, stderr })
    : reject(new Error(`runtime probe failed (${code ?? 'signal'}): ${stderr}`)))
  setTimeout(() => child.stdin.end(input), delayMs).unref()
})

test('invariant stored OAuth authenticates WebSocket SDK clients', () => {
  const client = new CommandClient({
    apiKey: null,
    xAPIKey: null,
    bearerAuth: 'oauth-access-token',
  })

  assert.deepEqual(client.webSocketAuthHeaders(), {
    Authorization: 'Bearer oauth-access-token',
  })
})

test('invariant WebSocket stdin is consumed exactly once and sent', async () => {
  const source = programSource(`
    class Socket {
      send(value) { process.stdout.write('SENT:' + JSON.stringify(value) + '\\n') }
      async *[Symbol.asyncIterator]() {}
    }
    class SDK {
      probe = {
        run: (params) => {
          process.stdout.write('PARAMS:' + JSON.stringify(params) + '\\n')
          return new Socket()
        },
      }
    }
  `, 'websocket')

  const { stdout } = await runProgram(source, 'hello')
  assert.match(stdout, /^PARAMS:\{\}\n/mu)
  assert.match(stdout, /^SENT:"hello"\n/mu)
})

test('invariant delayed piped JSON reaches generated commands', async () => {
  const source = programSource(`
    class SDK {
      probe = { run: async (params) => params }
    }
  `, 'http')

  const { stdout } = await runProgram(source, '{"slow":true}', 100)
  assert.deepEqual(JSON.parse(stdout), { slow: true })
})
