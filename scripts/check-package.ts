// @custom
/** Verifies that a clean npm package contains every declared runtime entry. */

import { spawn } from 'node:child_process'

const requiredFiles = [
  'dist/cjs/index.js',
  'dist/esm/bin.js',
  'dist/esm/index.d.ts',
  'dist/esm/index.js',
]

const npm = process.env.npm_execpath
if (!npm) throw new Error('npm_execpath is unavailable')

const output = await new Promise<string>((resolve, reject) => {
  const child = spawn(process.execPath, [npm, 'pack', '--dry-run', '--json'], {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8').on('data', (value) => {
    stdout += value
  })
  child.stderr.setEncoding('utf8').on('data', (value) => {
    stderr += value
  })
  child.once('error', reject)
  child.once('close', (code) =>
    code === 0
      ? resolve(stdout)
      : reject(new Error(`npm pack failed (${code ?? 'signal'}): ${stderr.trim()}`)),
  )
})

const reports: unknown = JSON.parse(output)
if (!Array.isArray(reports) || reports.length !== 1) throw new Error('Expected one npm pack report')
const report: unknown = reports[0]
if (!report || typeof report !== 'object' || !('files' in report) || !Array.isArray(report.files)) {
  throw new Error('npm pack report has no file list')
}
const files = new Set<string>()
for (const file of report.files as unknown[]) {
  if (!file || typeof file !== 'object' || !('path' in file) || typeof file.path !== 'string') {
    throw new Error('npm pack report contains an invalid file path')
  }
  files.add(file.path)
}
const missing = requiredFiles.filter((path) => !files.has(path))
if (missing.length > 0) {
  throw new Error(`npm package is missing runtime files: ${missing.join(', ')}`)
}

process.stdout.write(`Package contains ${files.size} files and every declared runtime entry.\n`)
