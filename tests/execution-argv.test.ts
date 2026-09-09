import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { type TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

const binary = fileURLToPath(new URL('../dist/esm/bin.js', import.meta.url))
const run = (args: string[], input = '') =>
  new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [binary, ...args], {
      env: { PATH: process.env.PATH, DEDALUS_API_KEY: 'test' },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    const timeout = setTimeout(() => child.kill(), 10_000)
    child.once('error', reject)
    child.once('close', (code) => { clearTimeout(timeout); resolve({ code, stdout, stderr }) })
    child.stdin.end(input)
  })

const fixture = async (context: TestContext) => {
  const requests: { method: string | undefined; url: string | undefined; body: unknown }[] = []
  const server = createServer(async (request, response) => {
    let body = ''
    for await (const chunk of request) body += String(chunk)
    requests.push({ method: request.method, url: request.url, body: body ? JSON.parse(body) : null })
    response.setHeader('content-type', 'application/json')
    response.end('{"execution_id":"ex-test","status":"queued","items":[]}')
  })
  context.after(() => server.close())
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert(address && typeof address === 'object')
  return { requests, args: ['--base-url', `http://127.0.0.1:${address.port}`, 'machines'] }
}

for (const resource of ['executions', 'exec']) {
  for (const explicit of [false, true]) {
    test(`${resource} ${explicit ? 'create ' : ''}forwards literal argv through HTTP`, async (context) => {
      const f = await fixture(context)
      const directory = await mkdtemp(join(tmpdir(), 'execution-argv-'))
      context.after(() => rm(directory, { recursive: true, force: true }))
      const file = join(directory, 'literal.txt')
      await writeFile(file, 'must not be uploaded')
      const argv = ['echo', 'hello world', '', '--help', '--', 'a"b', '$HOME', '&&', '@' + file, '\\@literal']
      const result = await run([...f.args, resource, ...(explicit ? ['create'] : []),
        '--machine-id', 'dm-test', '--cwd', '/tmp', '--env', '{"MODE":"test"}',
        '--stdin', 'input', '--timeout-ms', '1000', '--', ...argv])
      assert.equal(result.code, 0, result.stderr)
      assert.deepEqual(f.requests, [{ method: 'POST', url: '/v1/machines/dm-test/executions',
        body: { command: argv, cwd: '/tmp', env: { MODE: 'test' }, stdin: 'input', timeout_ms: 1000 } }])
    })
  }
}

for (const scenario of [
  { name: 'subcommand name stays literal', args: ['--machine-id', 'dm-test', '--', 'list'], command: ['list'] },
  { name: 'explicit remote shell', args: ['--machine-id', 'dm-test', '--', 'sh', '-c', 'echo "hello world" && ls'], command: ['sh', '-c', 'echo "hello world" && ls'] },
  { name: 'JSON command', args: ['create', '--machine-id', 'dm-test', '--command', '["echo","hello world"]'], command: ['echo', 'hello world'] },
  { name: 'piped command', args: ['create'], stdin: '{"machine_id":"dm-test","command":["echo","hello world"]}', command: ['echo', 'hello world'] },
  { name: 'piped machine ID', args: ['--', 'list'], stdin: '{"machine_id":"dm-test"}', command: ['list'] },
  { name: 'delimiter as option value', args: ['--machine-id', 'dm-test', '--stdin', '--', '--', 'echo'], command: ['echo'] },
]) {
  test(`exec preserves ${scenario.name}`, async (context) => {
    const f = await fixture(context)
    const result = await run([...f.args, 'exec', ...scenario.args], scenario.stdin)
    assert.equal(result.code, 0, result.stderr)
    assert.equal(f.requests.length, 1)
    const request = f.requests[0]
    assert(request)
    assert.equal(request.method, 'POST')
    assert.equal(request.url, '/v1/machines/dm-test/executions')
    assert(request.body && typeof request.body === 'object' && 'command' in request.body)
    assert.deepEqual(request.body.command, scenario.command)
  })
}

for (const [verb, method, suffix] of [
  ['list', 'GET', ''], ['retrieve', 'GET', '/ex-test'], ['delete', 'DELETE', '/ex-test'],
  ['output', 'GET', '/ex-test/output'], ['events', 'GET', '/ex-test/events'],
] as const) {
  test(`exec ${verb} retains the existing endpoint`, async (context) => {
    const f = await fixture(context)
    const result = await run([...f.args, 'exec', verb, '--machine-id', 'dm-test',
      ...(verb === 'list' ? [] : ['--execution-id', 'ex-test'])])
    assert.equal(result.code, 0, result.stderr)
    assert.deepEqual(f.requests, [{ method, url: '/v1/machines/dm-test/executions' + suffix, body: null }])
  })
}

for (const args of [
  ['--machine-id', 'dm-test', '--'], ['--machine-id', 'dm-test', '--', ''],
  ['--machine-id', 'dm-test', '--command', '["echo"]', '--', 'pwd'],
  ['create', '--machine-id', 'dm-test', '--command=["echo"]', '--', 'pwd'],
  ['--', 'echo'], ['typo'], ['create', '--machine-id', 'dm-test', 'echo'],
]) {
  test(`exec rejects ${JSON.stringify(args)} before HTTP`, async (context) => {
    const f = await fixture(context)
    const result = await run([...f.args, 'exec', ...args])
    assert.equal(result.code, 2, result.stderr)
    assert.deepEqual(f.requests, [])
  })
}

test('execution help and completion expose the alias and create options', async () => {
  for (const resource of ['exec', 'executions']) {
    assert.equal((await run(['machines', resource])).code, 0)
    for (const explicit of [false, true]) {
      const help = await run(['machines', resource, ...(explicit ? ['create'] : []), '--help'])
      assert.equal(help.code, 0, help.stderr)
      assert.match(help.stdout, /machine-id/u)
      assert.match(help.stdout, /executable/u)
    }
  }
  const alias = await run(['completion', 'query', '--', 'machines', 'ex'])
  assert.match(alias.stdout, /^exec$/mu)
  assert.match(alias.stdout, /^executions$/mu)
  const flags = await run(['completion', 'query', '--', 'machines', 'exec', 'create', '--machine'])
  assert.equal(flags.stdout.trim(), '--machine-id')
})
