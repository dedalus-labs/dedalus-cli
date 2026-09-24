import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { resolve as resolvePath } from 'node:path'
import { createServer } from 'node:http'
import { test } from 'node:test'

const run = (args, baseURL) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [resolvePath(process.env.FEEDBACK_PACKAGE_ROOT ?? '.', 'dist/esm/bin.js'), '--base-url', baseURL,
    '--api-key', 'test', '--max-retries', '0', ...args], { stdio: ['pipe', 'pipe', 'pipe'], env: { PATH: process.env.PATH } })
  let stdout = '', stderr = ''
  child.stdout.on('data', (data) => { stdout += data })
  child.stderr.on('data', (data) => { stderr += data })
  child.on('error', reject)
  child.on('close', (status) => resolve({ status, stdout, stderr }))
  child.stdin.end()
})

const withAPI = async (action) => {
  const requests = []
  const server = createServer(async (request, response) => {
    let source = ''
    for await (const chunk of request) source += chunk
    requests.push({ method: request.method, url: request.url, body: source ? JSON.parse(source) : undefined })
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify(request.method === 'GET' ? { items: [] } : { execution_id: 'execution' }))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try { await action(`http://127.0.0.1:${server.address().port}`, requests) }
  finally { await new Promise((resolve) => server.close(resolve)) }
}

const resources = [['machines', 'exec'], ['machines', 'executions'], ['machines:exec'], ['machines:executions']]

test('invariant_execution_argv_reaches_the_wire_literally_for_every_resource_spelling', async () => {
  await withAPI(async (baseURL, requests) => {
    const argv = ['printf', '@does-not-exist', '\\@literal', '--help', '--command', 'two words', '', 'null', '123', '--']
    for (const resource of resources) {
      for (const verb of [[], ['create']]) {
        const result = await run([...resource, ...verb, '--machine-id', 'machine', '--cwd', '/tmp', '--', ...argv], baseURL)
        assert.equal(result.status, 0, result.stderr)
        assert.deepEqual(requests.at(-1), { method: 'POST', url: '/v1/machines/machine/executions', body: { command: argv, cwd: '/tmp' } })
      }
    }
  })
})

test('invariant_invalid_execution_syntax_never_sends_a_request', async () => {
  await withAPI(async (baseURL, requests) => {
    for (const suffix of [
      ['--command', '["echo"]', '--', 'other'],
      ['--', '', 'argument'],
      ['echo'],
      ['echo', '--', 'argument'],
    ]) {
      const result = await run(['machines', 'exec', 'create', '--machine-id', 'machine', ...suffix], baseURL)
      assert.equal(result.status, 2, result.stderr)
    }
    assert.deepEqual(requests, [])
  })
})

test('invariant_existing_execution_flags_and_management_commands_remain_available', async () => {
  await withAPI(async (baseURL, requests) => {
    for (const resource of resources) {
      const create = await run([...resource, 'create', '--machine-id', 'machine', '--command', '["echo","hello"]'], baseURL)
      assert.equal(create.status, 0, create.stderr)
      assert.deepEqual(requests.at(-1).body, { command: ['echo', 'hello'] })
      const list = await run([...resource, 'list', '--machine-id', 'machine'], baseURL)
      assert.equal(list.status, 0, list.stderr)
      assert.equal(requests.at(-1).method, 'GET')
      const help = await run([...resource, '--help'], baseURL)
      assert.equal(help.status, 0, help.stderr)
      assert.match(help.stdout, /create.*argv/u)
    }
  })
})
