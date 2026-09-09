/** Rejects customization commits that modify Scalar-owned implementation files. */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const protectedPaths = [
  'src/bin.ts',
  'src/index.ts',
  'src/commands/index.ts',
  'src/sdk',
]

// Release Please changes only these marked version values during promotion.
const implementation = (path, source) => {
  if (path === 'src/sdk/version.ts') {
    source = source.replace(/^(export const VERSION = )(['"])[^'"\n]+\2(;? \/\/ x-release-please-version)$/mu, '$1"VERSION"$3')
  }
  if (path === 'src/commands/index.ts') {
    source = source.replace(/^(    version: )(['"])[^'"\n]+\2(, \/\/ x-release-please-version)$/mu, '$1"VERSION"$3')
  }
  return source.trimEnd()
}

const base = process.env.SCALAR_BASE_REF ?? 'origin/scalar-next'
let changed
try {
  const candidates = execFileSync('git', ['diff', '--name-only', base, '--', ...protectedPaths], {
    encoding: 'utf8',
  }).trim().split('\n').filter(Boolean)
  changed = candidates.filter((path) => {
    try {
      const baseline = execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8' })
      return implementation(path, baseline) !== implementation(path, readFileSync(path, 'utf8'))
    } catch {
      return true
    }
  }).join('\n')
} catch (error) {
  throw new Error(`Could not compare custom code with ${base}. Fetch scalar-next or set SCALAR_BASE_REF.`, {
    cause: error,
  })
}

if (changed) {
  throw new Error(`Custom commits modify Scalar-owned files:\n${changed}`)
}

process.stdout.write('Only the reviewed Scalar runtime seam may carry generated-file customizations.\n')
