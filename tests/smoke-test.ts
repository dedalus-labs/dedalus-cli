// File generated from our OpenAPI spec by Scalar. See README.md for details.

// Smoke test: invokes the generated CLI once per operation to confirm each command can reach
// its endpoint. Build the CLI first (so dist/esm/bin.js exists), then run this from the repo
// with `bun tests/smoke-test.ts`. Each case below holds the argv for one command, minus the
// base URL and credentials — the embedded SDK reads those from the environment, so set
// <PREFIX>_BASE_URL and the auth variables before running.
//
// Two environment variables tune a run:
//   - SCALAR_SMOKE_FILTER: comma-separated needles; only operations whose name or path contains
//     one of them run, so you can smoke-test a subset without editing this file.
//   - SCALAR_SMOKE_REPORT: a file path; when set, the run writes a JSON report there instead of
//     printing a table. The generator uses this to collect per-operation results.
import { execFile } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// The result of running one case, collected for the JSON report or the printed table.
type SmokeResult = {
  operation: string
  method: string
  path: string
  status: 'passed' | 'failed'
  durationMs: number
  error?: string
}

// One entry per generated operation. `args` is the argv passed to the built CLI; the other fields
// are metadata used for filtering and reporting. This list is generated, so it stays in sync with
// the CLI command surface.
const cases: { operation: string; method: string; path: string; args: string[] }[] = [
  {
    operation: "list",
    method: "GET",
    path: "/v1/machines",
    args: ["machine-lifecycle","list"],
  },

  {
    operation: "create",
    method: "POST",
    path: "/v1/machines",
    args: ["machine-lifecycle","create","--memory-mib","1","--storage-gib","1","--vcpu","1"],
  },

  {
    operation: "delete",
    method: "DELETE",
    path: "/v1/machines/{machine_id}",
    args: ["machine-lifecycle","delete","--machine-id","machine_id"],
  },

  {
    operation: "retrieve",
    method: "GET",
    path: "/v1/machines/{machine_id}",
    args: ["machine-lifecycle","retrieve","--machine-id","machine_id"],
  },

  {
    operation: "patch",
    method: "PATCH",
    path: "/v1/machines/{machine_id}",
    args: ["machine-lifecycle","patch","--machine-id","machine_id"],
  },

  {
    operation: "listArtifacts",
    method: "GET",
    path: "/v1/machines/{machine_id}/artifacts",
    args: ["machine-lifecycle","list-artifacts","--machine-id","machine_id"],
  },

  {
    operation: "deleteArtifact",
    method: "DELETE",
    path: "/v1/machines/{machine_id}/artifacts/{artifact_id}",
    args: ["machine-lifecycle","delete-artifact","--machine-id","machine_id","--artifact-id","artifact_id"],
  },

  {
    operation: "retrieveArtifact",
    method: "GET",
    path: "/v1/machines/{machine_id}/artifacts/{artifact_id}",
    args: ["machine-lifecycle","retrieve-artifact","--machine-id","machine_id","--artifact-id","artifact_id"],
  },

  {
    operation: "listExecutions",
    method: "GET",
    path: "/v1/machines/{machine_id}/executions",
    args: ["machine-lifecycle","list-executions","--machine-id","machine_id"],
  },

  {
    operation: "createExecution",
    method: "POST",
    path: "/v1/machines/{machine_id}/executions",
    args: ["machine-lifecycle","create-execution","--machine-id","machine_id","--command","[\"command\"]"],
  },

  {
    operation: "deleteExecution",
    method: "DELETE",
    path: "/v1/machines/{machine_id}/executions/{execution_id}",
    args: ["machine-lifecycle","delete-execution","--machine-id","machine_id","--execution-id","execution_id"],
  },

  {
    operation: "retrieveExecution",
    method: "GET",
    path: "/v1/machines/{machine_id}/executions/{execution_id}",
    args: ["machine-lifecycle","retrieve-execution","--machine-id","machine_id","--execution-id","execution_id"],
  },

  {
    operation: "listExecutionEvents",
    method: "GET",
    path: "/v1/machines/{machine_id}/executions/{execution_id}/events",
    args: ["machine-lifecycle","list-execution-events","--machine-id","machine_id","--execution-id","execution_id"],
  },

  {
    operation: "listExecutionOutput",
    method: "GET",
    path: "/v1/machines/{machine_id}/executions/{execution_id}/output",
    args: ["machine-lifecycle","list-execution-output","--machine-id","machine_id","--execution-id","execution_id"],
  },

  {
    operation: "listPreviews",
    method: "GET",
    path: "/v1/machines/{machine_id}/previews",
    args: ["machine-lifecycle","list-previews","--machine-id","machine_id"],
  },

  {
    operation: "createPreview",
    method: "POST",
    path: "/v1/machines/{machine_id}/previews",
    args: ["machine-lifecycle","create-preview","--machine-id","machine_id","--port","1"],
  },

  {
    operation: "deletePreview",
    method: "DELETE",
    path: "/v1/machines/{machine_id}/previews/{preview_id}",
    args: ["machine-lifecycle","delete-preview","--machine-id","machine_id","--preview-id","preview_id"],
  },

  {
    operation: "retrievePreview",
    method: "GET",
    path: "/v1/machines/{machine_id}/previews/{preview_id}",
    args: ["machine-lifecycle","retrieve-preview","--machine-id","machine_id","--preview-id","preview_id"],
  },

  {
    operation: "sleep",
    method: "POST",
    path: "/v1/machines/{machine_id}/sleep",
    args: ["machine-lifecycle","sleep","--machine-id","machine_id"],
  },

  {
    operation: "listSshSessions",
    method: "GET",
    path: "/v1/machines/{machine_id}/ssh",
    args: ["machine-lifecycle","list-ssh-sessions","--machine-id","machine_id"],
  },

  {
    operation: "createSshSession",
    method: "POST",
    path: "/v1/machines/{machine_id}/ssh",
    args: ["machine-lifecycle","create-ssh-session","--machine-id","machine_id","--public-key","public_key"],
  },

  {
    operation: "deleteSshSession",
    method: "DELETE",
    path: "/v1/machines/{machine_id}/ssh/{session_id}",
    args: ["machine-lifecycle","delete-ssh-session","--machine-id","machine_id","--session-id","session_id"],
  },

  {
    operation: "retrieveSshSession",
    method: "GET",
    path: "/v1/machines/{machine_id}/ssh/{session_id}",
    args: ["machine-lifecycle","retrieve-ssh-session","--machine-id","machine_id","--session-id","session_id"],
  },

  {
    operation: "watchStatus",
    method: "GET",
    path: "/v1/machines/{machine_id}/status/stream",
    args: ["machine-lifecycle","watch-status","--machine-id","machine_id","--max-items","10"],
  },

  {
    operation: "listTerminals",
    method: "GET",
    path: "/v1/machines/{machine_id}/terminals",
    args: ["machine-lifecycle","list-terminals","--machine-id","machine_id"],
  },

  {
    operation: "createTerminal",
    method: "POST",
    path: "/v1/machines/{machine_id}/terminals",
    args: ["machine-lifecycle","create-terminal","--machine-id","machine_id","--height","1","--width","1"],
  },

  {
    operation: "deleteTerminal",
    method: "DELETE",
    path: "/v1/machines/{machine_id}/terminals/{terminal_id}",
    args: ["machine-lifecycle","delete-terminal","--machine-id","machine_id","--terminal-id","terminal_id"],
  },

  {
    operation: "retrieveTerminal",
    method: "GET",
    path: "/v1/machines/{machine_id}/terminals/{terminal_id}",
    args: ["machine-lifecycle","retrieve-terminal","--machine-id","machine_id","--terminal-id","terminal_id"],
  },

  {
    operation: "wake",
    method: "POST",
    path: "/v1/machines/{machine_id}/wake",
    args: ["machine-lifecycle","wake","--machine-id","machine_id"],
  },

  {
    operation: "list",
    method: "GET",
    path: "/v1/usage",
    args: ["usage","list"],
  },

  {
    operation: "listComputeUsage",
    method: "GET",
    path: "/v1/usage/machines/compute",
    args: ["usage:machines","list-compute-usage"],
  },

  {
    operation: "listStorageUsage",
    method: "GET",
    path: "/v1/usage/machines/storage",
    args: ["usage:machines","list-storage-usage"],
  },

]

// Each command gets its own budget so one hanging command fails on its own instead of stalling
// the whole run; the generator additionally bounds the overall run.
const COMMAND_TIMEOUT_MS = 60_000

// Locate the built executable from the nearest package.json `bin` entry. Walking up from this
// file (rather than assuming a fixed relative path) keeps it correct whether this harness runs
// from the repo's `tests/` directory or is staged flat into a runner by the smoke tester.
const resolveBinPath = (): string => {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let depth = 0; depth < 6; depth += 1) {
    const manifestPath = join(dir, 'package.json')
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { bin?: string | Record<string, string> }
      const bin = typeof manifest.bin === 'string' ? manifest.bin : Object.values(manifest.bin ?? {})[0]
      if (bin) return join(dir, bin)
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('Could not locate the built CLI binary (run the package build first so dist/esm/bin.js exists).')
}

const main = async (): Promise<void> => {
  const binPath = resolveBinPath()

  // SCALAR_SMOKE_FILTER (comma-separated) keeps only cases whose operation name or path matches
  // one of the needles, so a caller can smoke-test a subset. With no filter, every case runs.
  const filter = process.env['SCALAR_SMOKE_FILTER']
  const needles = filter ? filter.split(',').map((needle) => needle.trim()).filter(Boolean) : []
  const selected = needles.length > 0 ? cases.filter((testCase) => needles.some((needle) => testCase.operation.includes(needle) || testCase.path.includes(needle))) : cases

  // Run every selected command concurrently. Promise.allSettled means one failing command never
  // blocks the others, so a single run reports the status of every endpoint.
  const settled = await Promise.allSettled(
    selected.map(async (testCase): Promise<SmokeResult> => {
      const startedAt = Date.now()
      try {
        // Pass the current environment through so the embedded SDK picks up the base URL and
        // credentials; node runs the built bin exactly as the published executable would.
        await execFileAsync('node', [binPath, ...testCase.args], { env: process.env, timeout: COMMAND_TIMEOUT_MS, maxBuffer: 1024 * 1024 * 20 })
        return { operation: testCase.operation, method: testCase.method, path: testCase.path, status: 'passed', durationMs: Date.now() - startedAt }
      } catch (error) {
        // Surface stderr (commander/runtime error output) when present; fall back to the message.
        const detail = error && typeof error === 'object' && 'stderr' in error ? String((error as { stderr?: unknown }).stderr ?? '') : ''
        const message = detail.trim() || (error instanceof Error ? (error.stack ?? error.message) : String(error))
        return { operation: testCase.operation, method: testCase.method, path: testCase.path, status: 'failed', durationMs: Date.now() - startedAt, error: message }
      }
    }),
  )

  // allSettled never rejects, but defensively map any rejected slot to a failed result.
  const results: SmokeResult[] = settled.map((result) => (result.status === 'fulfilled' ? result.value : { operation: 'unknown', method: '', path: '', status: 'failed', durationMs: 0, error: String(result.reason) }))
  const failed = results.filter((result) => result.status === 'failed')

  // With SCALAR_SMOKE_REPORT set, write a machine-readable report; otherwise print a table.
  const reportPath = process.env['SCALAR_SMOKE_REPORT']
  if (reportPath) {
    writeFileSync(reportPath, JSON.stringify({ total: results.length, failed: failed.length, results }))
  } else {
    for (const result of results) {
      if (result.status === 'passed') console.log(`\u2714 ${result.operation} (${result.method} ${result.path}) ${result.durationMs}ms`)
      else console.error(`\u2718 ${result.operation} (${result.method} ${result.path})\n${result.error ?? ''}`)
    }
    if (results.length === 0) {
      console.error('No commands ran (empty SDK or a SCALAR_SMOKE_FILTER that matched nothing).')
    } else {
      console.log(`\n${results.length - failed.length}/${results.length} commands passed`)
    }
  }

  // An empty run (no operations, or a filter that matched nothing) is a failure, not a vacuous pass.
  if (failed.length > 0 || results.length === 0) process.exitCode = 1
}

void main()
