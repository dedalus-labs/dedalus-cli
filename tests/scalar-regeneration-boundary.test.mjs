import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('invariant the published CLI executes Scalar runtime with narrow hooks', async () => {
  const [manifest, program, runtime] = await Promise.all([
    source('../package.json'),
    source('../src/custom/program.ts'),
    source('../src/cli/runtime.ts'),
  ])

  assert.match(manifest, /"dedalus": "\.\/dist\/esm\/custom\/bin\.js"/u)
  assert.match(program, /from '\.\.\/cli\/runtime\.js'/u)
  assert.doesNotMatch(program, /custom\/runtime|from '\.\/runtime\.js'/u)
  assert.match(runtime, /readonly formatError\?:/u)
  assert.match(runtime, /formatError\?\.\(error, command\)/u)
  assert.match(runtime, /handleWebSocket\(result, call\.params, call\.stdin, outputOptions\)/u)

  await assert.rejects(access(new URL('../src/custom/runtime.ts', import.meta.url)))
})

test('invariant release version bumps pass the boundary but implementation edits fail', async () => {
  const { execFileSync, spawnSync } = await import('node:child_process')
  const { mkdir, mkdtemp, rm, writeFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const directory = await mkdtemp(join(tmpdir(), 'dedalus-boundary-'))
  try {
    await mkdir(join(directory, 'src/sdk'), { recursive: true })
    await mkdir(join(directory, 'src/commands'), { recursive: true })
    const sdk = (version) => `export const VERSION = '${version}'; // x-release-please-version\n`
    const commands = (version) => `const program = {\n    version: '${version}', // x-release-please-version\n};\n`
    await writeFile(join(directory, 'src/sdk/version.ts'), sdk('0.1.0'))
    await writeFile(join(directory, 'src/commands/index.ts'), commands('0.1.0'))
    const git = (args) => execFileSync('git', args, { cwd: directory, stdio: 'pipe' })
    git(['init'])
    git(['add', 'src/sdk/version.ts', 'src/commands/index.ts'])
    git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test',
      '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture'])
    await writeFile(join(directory, 'src/sdk/version.ts'), sdk('0.2.0'))
    await writeFile(join(directory, 'src/commands/index.ts'), commands('0.2.0'))
    const check = () => spawnSync(process.execPath,
      [new URL('../scripts/check-scalar-boundaries.mjs', import.meta.url).pathname],
      { cwd: directory, env: { ...process.env, SCALAR_BASE_REF: 'HEAD' }, encoding: 'utf8' })
    assert.equal(check().status, 0)
    await writeFile(join(directory, 'src/commands/index.ts'), commands('0.2.0') + 'program.debug = true\n')
    const rejected = check()
    assert.notEqual(rejected.status, 0)
    assert.match(rejected.stderr, /Custom commits modify Scalar-owned files/u)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
