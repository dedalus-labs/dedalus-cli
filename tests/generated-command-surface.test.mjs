import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { WebSocketServer } from 'ws'

import { operationSpecs } from '../dist/esm/commands/operations.generated.js'

const binary = fileURLToPath(new URL('../dist/esm/custom/bin.js', import.meta.url))

const runCLI = (args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [binary, ...args], { env: options.env ?? process.env })
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk })
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk })
  child.stdin.end(options.stdin)
  const timeout = setTimeout(() => child.kill('SIGTERM'), 10_000)
  child.once('error', reject)
  child.once('close', (code, signal) => {
    clearTimeout(timeout)
    if (code === 0) resolve({ stdout, stderr })
    else reject(Object.assign(new Error(stderr || `CLI exited with ${signal ?? code}`), { code, signal, stdout, stderr }))
  })
})

const listen = async (server) => {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert(address && typeof address === 'object')
  return `http://127.0.0.1:${address.port}`
}

test('generated command table covers every OpenAPI operation', async () => {
  const source = JSON.parse(await readFile(new URL('../openapi.augmented.json', import.meta.url), 'utf8'))
  const methods = new Set(['get', 'post', 'put', 'patch', 'delete'])
  const operationIDs = Object.values(source.paths).flatMap((path) =>
    Object.entries(path).filter(([method]) => methods.has(method)).map(([, operation]) => operation.operationId),
  )
  assert.equal(operationSpecs.length, 35)
  assert.deepEqual(operationSpecs.map(({ id }) => id).sort(), operationIDs.sort())
})

test('machine list reaches the generated endpoint with bearer auth', async (context) => {
  let completeRequest
  const request = new Promise((resolve) => { completeRequest = resolve })
  const server = createServer((incoming, response) => {
    completeRequest(incoming)
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ items: [{ id: 'machine_1' }] }))
  })
  context.after(() => server.close())
  const baseURL = await listen(server)
  const processResult = runCLI(['--base-url', baseURL, '--api-key', 'test-token', '--format', 'json', 'machine-lifecycle', 'list'])
  const incoming = await request
  const result = await processResult
  assert.equal(incoming.method, 'GET')
  assert.equal(incoming.url, '/v1/machines')
  assert.equal(incoming.headers.authorization, 'Bearer test-token')
  assert.deepEqual(JSON.parse(result.stdout), { items: [{ id: 'machine_1' }] })
})

test('create port encodes path, headers, and JSON body', async (context) => {
  let completeRequest
  const received = new Promise((resolve) => { completeRequest = resolve })
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
    '--base-url', baseURL,
    '--api-key', 'test-token',
    'machine-lifecycle', 'create-port',
    '--machine-id', 'machine/a',
    '--idempotency-key', 'request-1',
    '--port', '8080',
    '--protocol', 'https',
    '--format', 'json',
  ])
  const { incoming, body } = await received
  const result = await processResult
  assert.equal(incoming.url, '/v1/machines/machine%2Fa/ports')
  assert.equal(incoming.headers['idempotency-key'], 'request-1')
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
    '--base-url', baseURL,
    '--api-key', 'test-token',
    'machine-lifecycle', 'watch-status',
    '--machine-id', 'machine_1',
    '--format', 'jsonl',
  ])
  assert.deepEqual(JSON.parse(result.stdout), { status: 'running' })
})

test('terminal command connects with authorization and sends JSON', async (context) => {
  const server = createServer()
  const websocket = new WebSocketServer({ server })
  context.after(() => websocket.close())
  context.after(() => server.close())
  const baseURL = await listen(server)
  const connection = new Promise((resolve) => websocket.once('connection', (socket, request) => {
    socket.once('message', (message) => resolve({ message: message.toString(), request }))
    socket.send(JSON.stringify({ type: 'output', data: 'ready' }))
  }))
  const processResult = runCLI([
    '--base-url', baseURL,
    '--api-key', 'websocket-token',
    'machine-lifecycle', 'connect-terminal',
    '--machine-id', 'machine_1',
    '--terminal-id', 'terminal_1',
    '--send', '{"type":"input","data":"hello"}',
    '--max-items', '1',
    '--format', 'jsonl',
  ])
  const { message, request } = await connection
  const result = await processResult
  assert.equal(request.url, '/v1/machines/machine_1/terminals/terminal_1/stream')
  assert.equal(request.headers.authorization, 'Bearer websocket-token')
  assert.deepEqual(JSON.parse(message), { type: 'input', data: 'hello' })
  const events = result.stdout.trim().split('\n').map((line) => JSON.parse(line))
  assert.deepEqual(events.find(({ type }) => type === 'message'), { type: 'message', message: { type: 'output', data: 'ready' } })
})

test('required generated flags fail before making a request', async () => {
  await assert.rejects(
    runCLI(['--api-key', 'test-token', 'machine-lifecycle', 'retrieve']),
    (error) => {
      assert.equal(error.code, 1)
      assert.match(error.stderr, /missing required value 'machine-id'/u)
      return true
    },
  )
})
