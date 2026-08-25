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
