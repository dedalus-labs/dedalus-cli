// @custom start
// Prove custom ranges remain explicit while code evolves.
import assert from 'node:assert/strict'
import test from 'node:test'
import { checkCustom } from '../scripts/check-custom.js'

const marked = '// @custom start\n// Read local credentials.\nexport const version = 1\n// @custom end\n'
const check = (source: string) => checkCustom(['auth.ts'], () => source)

test('custom ranges allow edits and independent ranges', () => {
  for (const source of [marked, marked.replace('= 1', '= 2'), marked + marked, marked.replaceAll('\n', '\r\n')]) {
    assert.deepEqual(check(source), [])
  }
  assert.deepEqual(check('export function run() {\n' + marked.replace('export ', '') + '}'), [])
})

test('unpaired, nested, and old markers are rejected', () => {
  for (const source of [
    marked.replace('// @custom end', ''),
    marked.replace('// @custom start', ''),
    marked.replace('// @custom end', '// @custom start\n// @custom end\n// @custom end'),
    marked + '// @custom end',
    marked.replace('// @custom start', '// @custom'),
    marked.replace('// @custom end', '// @custom finish'),
    '// @custom start\n// Explanation.\n',
  ]) assert.ok(check(source).length > 0, source)
})

test('only comment tokens with explanations declare custom ranges', () => {
  for (const source of [
    'const example = `\n' + marked + '`',
    marked.replace('// Read local credentials.\n', ''),
    marked.replace('// Read local credentials.', '/** */'),
    marked.replace('// Read local credentials.', '// @custom start'),
  ]) assert.ok(check(source).length > 0, source)
  assert.deepEqual(check(marked.replace('// Read local credentials.', '/** Read local credentials. */')), [])
  assert.deepEqual(check(marked.replace('Read local credentials.', 'Explain @custom in normal prose.')), [])
})

test('moving or removing a customization updates its declaration in the same change', () => {
  assert.deepEqual(checkCustom(['auth/session.ts'], () => marked), [])
  assert.deepEqual(checkCustom([], () => { throw new Error('removed file must not be read') }), [])
  assert.ok(check('export const generated = 1').length > 0)
})
// @custom end
