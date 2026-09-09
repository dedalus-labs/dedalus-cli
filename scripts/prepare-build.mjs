/** Removes generated output so a build cannot publish files from an older source tree. */

import { readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await rm(resolve(root, 'dist'), { recursive: true, force: true })

const { version } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
await writeFile(resolve(root, 'src/custom/version.generated.ts'),
  `// Generated from package.json by scripts/prepare-build.mjs.\nexport const version = ${JSON.stringify(version)}\n`)
