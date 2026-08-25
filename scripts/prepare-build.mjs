/** Removes generated output so a build cannot publish files from an older source tree. */

import { rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await rm(resolve(root, 'dist'), { recursive: true, force: true })
