import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))

test('invariant released ESM, CommonJS and executable versions follow the package', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dedalus-release-version-'))
  try {
    for (const path of ['src', 'scripts', 'tsconfig.json', 'tsconfig.cjs.json']) {
      await cp(join(root, path), join(directory, path), { recursive: true })
    }
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    manifest.version = '9.8.7-test.1'
    await writeFile(join(directory, 'package.json'), JSON.stringify(manifest))
    await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'junction')
    const run = (args) => execFileSync(process.execPath, args, { cwd: directory, encoding: 'utf8' }).trim()
    run(['scripts/prepare-build.mjs'])
    for (const config of ['tsconfig.json', 'tsconfig.cjs.json']) {
      run([join(root, 'node_modules/typescript/bin/tsc'), '-p', config])
    }
    run(['scripts/finalize-build.mjs'])
    assert.equal(run(['dist/esm/custom/bin.js', '--version']), manifest.version)
    assert.equal(run(['--input-type=module', '-e',
      "import { getProgram } from './dist/esm/custom/index.js'; console.log(getProgram().version())"]), manifest.version)
    assert.equal(run(['-e',
      "console.log(require('./dist/cjs/custom/index.js').getProgram().version())"]), manifest.version)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
