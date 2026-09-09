import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createServer, type Server, type IncomingMessage } from 'node:http'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { WebSocketServer } from 'ws'

import type { Command } from 'commander'
import SDK from '../src/sdk/index.js'
import { AuthenticatedCommandClient } from '../src/auth/client.js'
import { getProgram } from '../src/cli/program.js'

const binary = fileURLToPath(new URL('../dist/esm/bin.js', import.meta.url))

const runCLI = (args: string[], options: { env?: NodeJS.ProcessEnv; stdin?: string } = {}) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [binary, ...args], { env: options.env ?? process.env })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.setEncoding('utf8').on('data', (chunk) => {
      stderr += chunk
    })
    child.stdin.end(options.stdin)
    const timeout = setTimeout(() => child.kill('SIGTERM'), 10_000)
    child.once('error', reject)
    child.once('close', (code, signal) => {
      clearTimeout(timeout)
      if (code === 0) resolve({ stdout, stderr })
      else
        reject(
          Object.assign(new Error(stderr || `CLI exited with ${signal ?? code}`), {
            code,
            signal,
            stdout,
            stderr,
          }),
        )
    })
  })

const listen = async (server: Server) => {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert(address && typeof address === 'object')
  return `http://127.0.0.1:${address.port}`
}

test('Scalar manifest operations have generated SDK methods and CLI commands', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../scalar-sdk.manifest.json', import.meta.url), 'utf8'),
  ) as { operations: { publicResource: string; publicOperation: string }[] }
  const sdk = new SDK({ apiKey: 'fixture' })
  const program = getProgram()
  assert.equal(manifest.operations.length, 35)
  for (const operation of manifest.operations) {
    const resources = operation.publicResource.split('.')
    const resource = resources.reduce<unknown>((value, name) => {
      assert(value && typeof value === 'object')
      return Reflect.get(value, name)
    }, sdk)
    assert(resource && typeof resource === 'object')
    assert.equal(
      typeof Reflect.get(resource, operation.publicOperation),
      'function',
      operation.publicResource + '.' + operation.publicOperation,
    )
    const group = resources.reduce<Command | undefined>(
      (parent, name) => parent?.commands.find((command) => command.name() === name),
      program,
    )
    const name = operation.publicOperation.replace(
      /[A-Z]/gu,
      (letter) => '-' + letter.toLowerCase(),
    )
    assert.ok(
      group?.commands.some((command) => command.name() === name),
      resources.join(':') + ' ' + name,
    )
  }
})

test('machine list reaches the generated endpoint with bearer auth', async (context) => {
  let completeRequest!: (request: IncomingMessage) => void
  const request = new Promise<IncomingMessage>((resolve) => {
    completeRequest = resolve
  })
  const server = createServer((incoming, response) => {
    completeRequest(incoming)
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ items: [{ id: 'machine_1' }] }))
  })
  context.after(() => server.close())
  const baseURL = await listen(server)
  const processResult = runCLI([
    '--base-url',
    baseURL,
    '--api-key',
    'test-token',
    '--format',
    'json',
    'machines',
    'list',
  ])
  const incoming = await request
  const result = await processResult
  assert.equal(incoming.method, 'GET')
  assert.equal(incoming.url, '/v1/machines')
  assert.equal(incoming.headers.authorization, 'Bearer test-token')
  assert.deepEqual(JSON.parse(result.stdout), [{ id: 'machine_1' }])
})

test('create port encodes path, headers, and JSON body', async (context) => {
  let completeRequest!: (request: { incoming: IncomingMessage; body: string }) => void
  const received = new Promise<{ incoming: IncomingMessage; body: string }>((resolve) => {
    completeRequest = resolve
  })
  const server = createServer(async (incoming, response) => {
    let body = ''
    for await (const chunk of incoming) body += chunk
    completeRequest({ incoming, body })
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ ok: true }))
  })
  context.after(() => server.close())
  const baseURL = await listen(server)
  const processResult = runCLI([
    '--base-url',
    baseURL,
    '--api-key',
    'test-token',
    'machines',
    'ports',
    'create',
    '--machine-id',
    'machine/a',
    '--port',
    '8080',
    '--protocol',
    'https',
    '--format',
    'json',
  ])
  const { incoming, body } = await received
  const result = await processResult
  assert.equal(incoming.url, '/v1/machines/machine%2Fa/ports')
  assert.ok(incoming.headers['idempotency-key'])
  assert.deepEqual(JSON.parse(body), { port: 8080, protocol: 'https' })
  assert.deepEqual(JSON.parse(result.stdout), { ok: true })
})

test('SSE commands stream parsed events', async (context) => {
  const server = createServer((_incoming, response) => {
    response.writeHead(200, { 'content-type': 'text/event-stream' })
    response.end('event: status\ndata: {"status":"running"}\n\n')
  })
  context.after(() => server.close())
  const baseURL = await listen(server)
  const result = await runCLI([
    '--base-url',
    baseURL,
    '--api-key',
    'test-token',
    'machines',
    'watch',
    '--machine-id',
    'machine_1',
    '--format',
    'jsonl',
  ])
  assert.deepEqual(JSON.parse(result.stdout), { status: 'running' })
})

test('terminal command connects with authorization and sends JSON', async (context) => {
  const server = createServer()
  const websocket = new WebSocketServer({ server })
  context.after(() => websocket.close())
  context.after(() => server.close())
  const baseURL = await listen(server)
  const connection = new Promise<{ message: string; request: IncomingMessage }>((resolve) =>
    websocket.once('connection', (socket, request) => {
      socket.once('message', (message) => resolve({ message: message.toString(), request }))
      socket.send(JSON.stringify({ type: 'output', data: 'ready' }))
    }),
  )
  const processResult = runCLI([
    '--base-url',
    baseURL,
    '--api-key',
    'websocket-token',
    'machines',
    'terminals',
    'connect',
    '--machine-id',
    'machine_1',
    '--terminal-id',
    'terminal_1',
    '--send',
    '{"type":"input","data":"hello"}',
    '--max-items',
    '1',
    '--format',
    'jsonl',
  ])
  const { message, request } = await connection
  const result = await processResult
  assert.equal(request.url, '/v1/machines/machine_1/terminals/terminal_1/stream')
  assert.equal(request.headers.authorization, 'Bearer websocket-token')
  assert.deepEqual(JSON.parse(message), { type: 'input', data: 'hello' })
  const events = result.stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  assert.deepEqual(
    events.find((event: { type?: string }) => event.type === 'message'),
    { type: 'message', message: { type: 'output', data: 'ready' } },
  )
})

test('native WebSocket authenticates with the OAuth token provider', async (context) => {
  const server = createServer()
  const websocket = new WebSocketServer({ server })
  context.after(() => websocket.close())
  context.after(() => server.close())
  const baseURL = await listen(server)
  const connected = new Promise<IncomingMessage>((resolve) =>
    websocket.once('connection', (socket, request) => {
      resolve(request)
      socket.close()
    }),
  )
  const client = new AuthenticatedCommandClient({
    baseURL,
    apiKey: null,
    xAPIKey: null,
    bearerAuth: () => 'oauth-token',
  })
  const stream = client.machines.terminals.connect({
    machine_id: 'machine_1',
    terminal_id: 'terminal_1',
  })
  context.after(() => stream.close())
  assert.equal((await connected).headers.authorization, 'Bearer oauth-token')
  for await (const event of stream) assert.notEqual(event.type, 'error')
})

test('required generated flags fail before making a request', async () => {
  await assert.rejects(runCLI(['--api-key', 'test-token', 'machines', 'retrieve']), (error) => {
    assert(error instanceof Error && 'code' in error && 'stderr' in error)
    assert.equal(typeof error.stderr, 'string')
    assert.equal(error.code, 2)
    assert.match(String(error.stderr), /missing required value 'machine-id'/u)
    return true
  })
})

test('native pagination follows cursors while raw output preserves one envelope', async (context) => {
  const paths: string[] = []
  const server = createServer((incoming, response) => {
    paths.push(incoming.url ?? assert.fail('Missing URL'))
    const next = incoming.url?.includes('cursor=page2')
    response.setHeader('content-type', 'application/json')
    response.end(
      JSON.stringify({
        items: [{ machine_id: next ? 'two' : 'one' }],
        next_cursor: next ? null : 'page2',
      }),
    )
  })
  context.after(() => server.close())
  const baseURL = await listen(server)
  const args = ['--base-url', baseURL, '--api-key', 'fixture', 'machines', 'list']
  const result = await runCLI([...args, '--format', 'json'])
  assert.deepEqual(JSON.parse(result.stdout), [{ machine_id: 'one' }, { machine_id: 'two' }])
  assert.deepEqual(paths, ['/v1/machines', '/v1/machines?cursor=page2'])
  paths.length = 0
  const raw = await runCLI([...args, '--format', 'raw'])
  assert.deepEqual(JSON.parse(raw.stdout), { items: [{ machine_id: 'one' }], next_cursor: 'page2' })
  assert.equal(paths.length, 1)
})

test('nested execution commands accept flags after the verb', async (context) => {
  const requests: string[] = []
  const server = createServer((request, response) => {
    requests.push(request.url ?? '')
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end('{"items":[],"next_cursor":null}')
  })
  context.after(() => server.close())
  const baseURL = await listen(server)
  const result = await runCLI([
    'machines',
    'executions',
    'list',
    '--machine-id',
    'dm-test',
    '--api-key',
    'fixture',
    '--base-url',
    baseURL,
    '--format',
    'json',
  ])
  assert.deepEqual(requests, ['/v1/machines/dm-test/executions'])
  assert.deepEqual(JSON.parse(result.stdout), [])
})

test('nested SSH help lists session commands without authentication', async () => {
  const result = await runCLI(['machines', 'ssh', '--help'], { env: { PATH: process.env.PATH } })
  assert.match(result.stdout, /Usage: dedalus machines ssh/u)
  assert.match(result.stdout, /List SSH sessions/u)
  assert.match(result.stdout, /create/u)
  assert.doesNotMatch(result.stdout, /machines:ssh/u)
})

test('completion follows nested resources and skips option values', async () => {
  const result = await runCLI([
    'completion',
    'query',
    '--',
    '--api-key',
    'fixture',
    'machines',
    'ssh',
    '',
  ])
  assert.match(result.stdout, /^list$/mu)
  assert.match(result.stdout, /^create$/mu)
  assert.doesNotMatch(result.stdout, /machines:ssh/u)
  const flags = await runCLI([
    'completion',
    'query',
    '--',
    'machines',
    'executions',
    'list',
    '--machine',
  ])
  assert.equal(flags.stdout.trim(), '--machine-id')
})

test('completion does not suggest commands as option values', async () => {
  const result = await runCLI(['completion', 'query', '--', '--api-key', ''])
  assert.equal(result.stdout, '')
})
