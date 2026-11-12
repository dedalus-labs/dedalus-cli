import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

const root = resolve(process.env.CLI_PACKAGE_ROOT ?? '.')
const machineId = '00000000-0000-4000-8000-000000000111'
const machine = {
  machine_id: machineId, desired_state: 'running', autosleep_seconds: 300,
  memory_mib: 1024, storage_gib: 10, vcpu: 1, status: { phase: 'running' },
}
const event = (type, data, id = '42') => `id: ${id}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`

async function runWatch(t, handler, args = []) {
  const requests = []
  const server = createServer((request, response) => {
    requests.push({ method: request.method, url: request.url, headers: request.headers })
    handler(response)
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  t.after(() => { server.closeAllConnections(); server.close() })
  const child = spawn(process.execPath, [join(root, 'dist/esm/bin.js'),
    'machines', 'watch', '--machine-id', machineId, '--api-key', 'public-test-key',
    '--base-url', `http://127.0.0.1:${server.address().port}`, '--max-retries', '0',
    '--format', 'jsonl', ...args,
  ], { env: { PATH: process.env.PATH, DEDALUS_NO_UPDATE_CHECK: '1' } })
  t.after(() => child.kill())
  let stdout = ''; let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  const completed = once(child, 'close')
  return { child, requests, completed, output: () => ({ stdout, stderr }) }
}

test('invariant_watch_delivers_status_before_close_and_preserves_resume_headers', { timeout: 5000 }, async (t) => {
  let response
  const run = await runWatch(t, (res) => {
    response = res
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.write(event('status', machine))
  }, ['--last-event-id', 'resume-41'])
  await once(run.child.stdout, 'data')
  assert.deepEqual(JSON.parse(run.output().stdout), machine)
  assert.equal(run.requests[0].method, 'GET')
  assert.equal(run.requests[0].url, `/v1/machines/${machineId}/status/stream`)
  assert.equal(run.requests[0].headers.authorization, 'Bearer public-test-key')
  assert.equal(run.requests[0].headers.accept, 'text/event-stream')
  assert.equal(run.requests[0].headers['last-event-id'], 'resume-41')
  response.end()
  assert.deepEqual(await run.completed, [0, null])
  assert.equal(run.output().stderr, '')
})

test('invariant_bookmarks_do_not_consume_the_status_limit_and_limit_cancels_stream', { timeout: 5000 }, async (t) => {
  const run = await runWatch(t, (res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.write(': keepalive\n\n' + event('bookmark', {}) + event('status', machine) + event('status', { ...machine, vcpu: 2 }))
  }, ['--max-items', '1'])
  assert.deepEqual(await run.completed, [0, null])
  assert.deepEqual(run.output().stdout.trim().split('\n').map(JSON.parse), [machine])
  assert.equal(run.output().stderr, '')
})

test('invariant_watch_failures_exit_nonzero_without_becoming_status_output', { timeout: 10000 }, async (t) => {
  const error = { error_code: 'WATCH_FAILED', message: 'Watch interrupted', retryable: false }
  for (const kind of ['sse', 'http', 'malformed']) {
    await t.test(kind, async (t) => {
      const run = await runWatch(t, (res) => {
        res.writeHead(kind === 'http' ? 401 : 200, {
          'content-type': kind === 'http' ? 'application/json' : 'text/event-stream',
        })
        res.end(kind === 'http' ? JSON.stringify(error)
          : kind === 'sse' ? event('error', error) : 'event: status\ndata: invalid-json\n\n')
      })
      const [code, signal] = await run.completed
      assert.notEqual(code, 0)
      assert.equal(signal, null)
      assert.equal(run.output().stdout, '')
      assert.ok(run.output().stderr.length > 0)
      if (kind !== 'malformed') assert.match(run.output().stderr, /Watch interrupted/)
    })
  }
})
