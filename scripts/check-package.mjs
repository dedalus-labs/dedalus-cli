/** Verifies that a clean npm package contains every declared runtime entry. */

import { spawn } from 'node:child_process'

const requiredFiles = [
  'dist/cjs/custom/index.js',
  'dist/esm/custom/bin.js',
  'dist/esm/custom/index.d.ts',
  'dist/esm/custom/index.js',
]

const npm = process.env.npm_execpath
if (!npm) throw new Error('npm_execpath is unavailable')

const output = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [npm, 'pack', '--dry-run', '--json'], {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8').on('data', (value) => { stdout += value })
  child.stderr.setEncoding('utf8').on('data', (value) => { stderr += value })
  child.once('error', reject)
  child.once('close', (code) => code === 0
    ? resolve(stdout)
    : reject(new Error(`npm pack failed (${code ?? 'signal'}): ${stderr.trim()}`)))
})

const reports = JSON.parse(output)
const files = new Set(reports[0]?.files?.map(({ path }) => path) ?? [])
const missing = requiredFiles.filter((path) => !files.has(path))
if (missing.length > 0) {
  throw new Error(`npm package is missing runtime files: ${missing.join(', ')}`)
}

process.stdout.write(`Package contains ${files.size} files and every declared runtime entry.\n`)
