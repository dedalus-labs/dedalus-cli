import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { test } from 'node:test'

const binary = resolve(process.env.FEEDBACK_PACKAGE_ROOT ?? '.', 'dist/esm/bin.js')
const run = (...args) => spawnSync(process.execPath, [binary, ...args], { encoding: 'utf8', timeout: 5000, env: { PATH: process.env.PATH } })
const groups = [
  ['machines ssh', ['list', 'create', 'retrieve', 'delete']],
  ['machines executions', ['list', 'create', 'retrieve', 'delete', 'output', 'events']],
  ['machines executions logs', ['retrieve', 'reauthorize', 'create-token']],
  ['machines autoresizing', ['retrieve', 'update']],
  ['organization autoresizing', ['retrieve', 'update']],
]

test('invariant_every_resource_operation_is_discoverable_under_its_parent', () => {
  for (const [path, verbs] of groups) {
    const parent = run(...path.split(' '), '--help')
    assert.equal(parent.status, 0, parent.stderr)
    for (const verb of verbs) {
      assert.match(parent.stdout, new RegExp(`\\b${verb}\\b`))
      const result = run(...path.split(' '), verb, '--help')
      assert.equal(result.status, 0, result.stderr)
      assert.ok(result.stdout.includes(`Usage: dedalus ${path} ${verb}`))
      assert.ok(!result.stdout.includes(path.replaceAll(' ', ':')))
    }
    assert.equal(run(path.replaceAll(' ', ':'), verbs[0]).status, 2)
  }
  assert.match(run('machines', '--help').stdout, /ssh/)
  assert.match(run('organization', '--help').stdout, /autoresizing/)
})

test('invariant_nesting_preserves_resource_routes_and_global_credentials', async () => {
  const requests = []
  const server = createServer((req, res) => {
    requests.push([req.url, req.headers.authorization])
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ items: [] }))
  })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  try {
    for (const [args, route] of [
      [['machines', 'ssh', 'list', '--machine-id', 'machine'], '/v1/machines/machine/ssh'],
      [['machines', 'executions', 'list', '--machine-id', 'machine'], '/v1/machines/machine/executions'],
      [['machines', 'executions', 'logs', 'retrieve', '--machine-id', 'machine', '--execution-id', 'execution'], '/v1/machines/machine/executions/execution/logs'],
      [['machines', 'autoresizing', 'retrieve', '--machine-id', 'machine'], '/v1/machines/machine/autoresizing'],
      [['organization', 'autoresizing', 'retrieve'], '/v1/organization/autoresizing'],
    ]) {
      const child = spawn(process.execPath, [binary, '--api-key', 'test', '--base-url', `http://127.0.0.1:${server.address().port}`, ...args], { env: { PATH: process.env.PATH }, stdio: ['ignore', 'pipe', 'pipe'] })
      let stderr = ''
      child.stdout.resume()
      child.stderr.on('data', (data) => { stderr += data })
      const status = await new Promise((done, reject) => { child.on('close', done); child.on('error', reject) })
      assert.equal(status, 0, stderr)
      assert.deepEqual(requests.at(-1), [route, 'Bearer test'])
    }
  } finally { await new Promise((done) => server.close(done)) }
})

test('invariant_completion_follows_nested_resources_aliases_and_option_values', () => {
  for (const [words, expected] of [
    [[''], 'organization'], [['machines', ''], 'ssh'], [['machines', ''], 'exec'],
    [['machines', 'exec', ''], 'logs'], [['organization', ''], 'autoresizing'],
    [['machines', 'executions', 'logs', ''], 'retrieve'],
    [['--api-key', 'machines', 'machines', 'ssh', 'list', '--m'], '--machine-id'],
  ]) {
    const result = run('__complete', '--', ...words)
    assert.equal(result.status, 0, result.stderr)
    assert.ok(result.stdout.split('\n').includes(expected), result.stdout)
    assert.ok(!result.stdout.includes(':'))
    assert.ok(!result.stdout.includes('__complete'))
  }
  for (const words of [['--api-key', ''], ['machines', 'exec', '--', '']]) {
    assert.equal(run('__complete', '--', ...words).stdout, '')
  }
  for (const shell of ['bash', 'zsh', 'fish']) assert.equal(run('completion', shell).status, 0)
  assert.equal(run('completion', 'constructor').status, 2)
})

for (const shell of ['bash', 'zsh']) {
  test(`invariant_${shell}_completion_passes_each_resource_word_separately`, {
    skip: spawnSync(shell, ['--version']).error?.code === 'ENOENT',
  }, () => {
    const completion = run('completion', shell).stdout
    const invoke = shell === 'bash'
      ? 'COMP_WORDS=(dedalus machines executions logs ""); COMP_CWORD=4; __dedalus_completion; printf "%s\\n" "${COMPREPLY[@]}"'
      : 'words=(dedalus machines executions logs ""); _dedalus'
    const result = spawnSync(shell, ['-c', `dedalus() { "$NODE" "$BINARY" "$@"; }\ncompdef() { :; }\ncompadd() { shift; printf '%s\\n' "$@"; }\n${completion}\n${invoke}`], {
      encoding: 'utf8', env: { PATH: process.env.PATH, NODE: process.execPath, BINARY: binary },
    })
    assert.equal(result.status, 0, result.stderr)
    assert.ok(result.stdout.split('\n').includes('retrieve'), result.stdout)
    assert.ok(!result.stdout.includes(':'))
  })
}
