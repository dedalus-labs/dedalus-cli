import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const packageRoot = process.env.UPDATE_PACKAGE_ROOT ?? '.'
const { newerStable, updateCLI } = await import(pathToFileURL(resolve(packageRoot, 'dist/esm/custom/update.js')).href)
const { getProgram } = await import(pathToFileURL(resolve(packageRoot, 'dist/esm/index.js')).href)

const fixture = (overrides = {}) => {
  const runs = []
  const queries = []
  const effects = {
    current: '0.7.0', entry: '/global/dedalus-cli/dist/esm/bin.js', executable: '/usr/bin/node', platform: 'linux',
    latest: async () => 'v0.8.0', realpath: (path) => path,
    output: (name, args) => {
      queries.push([name, args])
      if (name === 'npm' && args[0] === 'root') return '/global'
      if (name === 'npm' && args[0] === 'view') return '0.8.0'
      throw new Error('not installed')
    },
    run: (name, args) => runs.push([name, args]), print: () => {}, ...overrides,
  }
  return { effects, runs, queries }
}

test('invariant check mode never probes or mutates an installation', async () => {
  const { effects, runs, queries } = fixture({ realpath: () => { throw new Error('must not resolve') } })
  await updateCLI(true, effects)
  assert.deepEqual(runs, [])
  assert.deepEqual(queries, [])
})

test('invariant equal or older releases never install', async () => {
  for (const current of ['0.8.0', '0.9.0', '1.0.0']) {
    const { effects, runs, queries } = fixture({ current })
    await updateCLI(false, effects)
    assert.deepEqual(runs, [])
    assert.deepEqual(queries, [])
  }
})

test('invariant global npm updates pin the release and never replace Node', async () => {
  const { effects, runs } = fixture()
  await updateCLI(false, effects)
  assert.deepEqual(runs, [['npm', ['install', '--global', 'dedalus-cli@0.8.0']]])
})

test('invariant missing npm publication leaves the installation unchanged', async () => {
  const { effects, runs } = fixture({ output: (_name, args) => args[0] === 'root' ? '/global' : '0.6.0' })
  await assert.rejects(updateCLI(false, effects), /not available from npm/)
  assert.deepEqual(runs, [])
})

test('invariant local, unknown and Windows installations are never mutated', async () => {
  for (const overrides of [{ entry: '/project/node_modules/dedalus-cli/dist/esm/bin.js' }, { entry: '/standalone/dedalus', executable: '/standalone/dedalus' }, { platform: 'win32' }]) {
    const { effects, runs } = fixture(overrides)
    await updateCLI(false, effects)
    assert.deepEqual(runs, [])
  }
})

test('invariant Homebrew ownership and publication must both match before upgrade', async () => {
  for (const [executable, published, upgrade] of [['/brew/Cellar/dedalus/0.7.0/bin/dedalus', '0.8.0', true], ['/brew/Cellar/dedalus-other/bin/dedalus', '0.8.0', false], ['/brew/Cellar/dedalus/0.7.0/bin/dedalus', '0.6.0', false]]) {
    const { effects, runs } = fixture({ entry: '/standalone/dedalus', executable,
      output: (name, args) => {
        if (name !== 'brew') throw new Error('unavailable')
        return args[0] === '--prefix' ? '/brew/Cellar/dedalus/0.7.0' : JSON.stringify({ formulae: [{ versions: { stable: published } }] })
      },
    })
    if (published === '0.6.0') await assert.rejects(updateCLI(false, effects), /has not published/)
    else await updateCLI(false, effects)
    assert.equal(runs.some(([, args]) => args[0] === 'upgrade'), upgrade)
  }
})

test('invariant unrecognized versions cannot authorize installation', () => {
  for (const value of ['dev', '0.8.0-rc.1', '0.8', '0.8.0; echo unsafe']) assert.throws(() => newerStable(value, '0.7.0'))
  assert.equal(newerStable('0.10.0', '0.9.0'), true)
})

test('design update is registered with a read-only check option', () => {
  const update = getProgram().commands.find((command) => command.name() === 'update')
  assert.ok(update)
  assert.ok(update.options.some((option) => option.long === '--check'))
})

test('invariant release lookup failure never touches an installation', async () => {
  const { effects, queries, runs } = fixture({ latest: async () => { throw new Error('offline') } })
  await assert.rejects(updateCLI(false, effects), /offline/)
  assert.deepEqual(queries, [])
  assert.deepEqual(runs, [])
})

test('invariant installer failure propagates to the caller', async () => {
  const { effects } = fixture({ run: () => { throw new Error('permission denied') } })
  await assert.rejects(updateCLI(false, effects), /permission denied/)
})
