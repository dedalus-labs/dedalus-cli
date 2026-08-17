// @custom
/** Removes generated output so a build cannot publish files from an older source tree. */

import { readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await rm(resolve(root, 'dist'), { recursive: true, force: true })

const manifest: unknown = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
if (
  !manifest ||
  typeof manifest !== 'object' ||
  !('version' in manifest) ||
  typeof manifest.version !== 'string'
) {
  throw new Error('package.json must contain a version string')
}
const version = manifest.version
await writeFile(
  resolve(root, 'src/cli/version.generated.ts'),
  `// Generated from package.json by scripts/prepare-build.ts.\nexport const version = ${JSON.stringify(version)}\n`,
)
