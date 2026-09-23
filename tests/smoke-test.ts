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
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// The result of running one case, collected for the JSON report or the printed table.
type SmokeResult = {
  operation: string;
  method: string;
  path: string;
  label?: string;
  status: 'passed' | 'failed';
  durationMs: number;
  error?: string;
};

// One or two entries per generated operation: the first passes only the flags the command
// requires, the second also passes every optional flag. `label` says which is which, and is
// absent when the command has no optional flag and so has only one case. `args` is the argv
// passed to the built CLI; the other fields are metadata used for filtering and reporting. This
// list is generated, so it stays in sync with the CLI command surface.
const cases: { operation: string; method: string; path: string; label?: string; args: string[] }[] = [
  {
    operation: 'list',
    method: 'GET',
    path: '/v1/machines',
    args: ['machines', 'list', '--max-items', '10'],
  },

  {
    operation: 'create',
    method: 'POST',
    path: '/v1/machines',
    args: [
      'machines',
      'create',
      '--autosleep',
      '300s',
      '--memory-mib',
      '4096',
      '--storage-gib',
      '10',
      '--vcpu',
      '1',
    ],
  },

  {
    operation: 'retrieve',
    method: 'GET',
    path: '/v1/machines/{machine_id}',
    args: ['machines', 'retrieve', '--machine-id', '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'],
  },

  {
    operation: 'update',
    method: 'PATCH',
    path: '/v1/machines/{machine_id}',
    label: 'required params',
    args: ['machines', 'update', '--machine-id', '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'],
  },

  {
    operation: 'update',
    method: 'PATCH',
    path: '/v1/machines/{machine_id}',
    label: 'all params',
    args: [
      'machines',
      'update',
      '--machine-id',
      '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
      '--autosleep',
      '',
      '--memory-mib',
      '0',
      '--storage-gib',
      '0',
      '--vcpu',
      '0',
    ],
  },

  {
    operation: 'delete',
    method: 'DELETE',
    path: '/v1/machines/{machine_id}',
    args: ['machines', 'delete', '--machine-id', '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'],
  },

  {
    operation: 'sleep',
    method: 'POST',
    path: '/v1/machines/{machine_id}/sleep',
    args: ['machines', 'sleep', '--machine-id', '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'],
  },

  {
    operation: 'wake',
    method: 'POST',
    path: '/v1/machines/{machine_id}/wake',
    args: ['machines', 'wake', '--machine-id', '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'],
  },

  {
    operation: 'list',
    method: 'GET',
    path: '/v1/machines/{machine_id}/ssh',
    args: [
      'machines:ssh',
      'list',
      '--machine-id',
      '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
      '--max-items',
      '10',
    ],
  },

  {
    operation: 'create',
    method: 'POST',
    path: '/v1/machines/{machine_id}/ssh',
    args: [
      'machines:ssh',
      'create',
      '--machine-id',
      '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
      '--public-key',
      '',
    ],
  },

  {
    operation: 'retrieve',
    method: 'GET',
    path: '/v1/machines/{machine_id}/ssh/{session_id}',
    args: [
      'machines:ssh',
      'retrieve',
      '--machine-id',
      '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
      '--session-id',
      'session_id',
    ],
  },

  {
    operation: 'delete',
    method: 'DELETE',
    path: '/v1/machines/{machine_id}/ssh/{session_id}',
    args: [
      'machines:ssh',
      'delete',
      '--machine-id',
      '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
      '--session-id',
      'session_id',
    ],
  },

  {
    operation: 'list',
    method: 'GET',
    path: '/v1/machines/{machine_id}/executions',
    args: [
      'machines:executions',
      'list',
      '--machine-id',
      '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
      '--max-items',
      '10',
    ],
  },

  {
    operation: 'create',
    method: 'POST',
    path: '/v1/machines/{machine_id}/executions',
    label: 'required params',
    args: [
      'machines:executions',
      'create',
      '--machine-id',
      '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
      '--command',
      '[""]',
    ],
  },

  {
    operation: 'create',
    method: 'POST',
    path: '/v1/machines/{machine_id}/executions',
    label: 'all params',
    args: [
      'machines:executions',
      'create',
      '--machine-id',
      '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
      '--command',
      '[""]',
      '--cwd',
      '',
      '--env',
      '{}',
      '--stdin',
      '',
      '--timeout-ms',
      '0',
    ],
  },

  {
    operation: 'retrieve',
    method: 'GET',
    path: '/v1/machines/{machine_id}/executions/{execution_id}',
    args: [
      'machines:executions',
      'retrieve',
      '--machine-id',
      '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
      '--execution-id',
      'execution_id',
    ],
  },

  {
    operation: 'delete',
    method: 'DELETE',
    path: '/v1/machines/{machine_id}/executions/{execution_id}',
    args: [
      'machines:executions',
      'delete',
      '--machine-id',
      '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
      '--execution-id',
      'execution_id',
    ],
  },

  {
    operation: 'output',
    method: 'GET',
    path: '/v1/machines/{machine_id}/executions/{execution_id}/output',
    args: [
      'machines:executions',
      'output',
      '--machine-id',
      '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
      '--execution-id',
      'execution_id',
    ],
  },

  {
    operation: 'events',
    method: 'GET',
    path: '/v1/machines/{machine_id}/executions/{execution_id}/events',
    args: [
      'machines:executions',
      'events',
      '--machine-id',
      '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
      '--execution-id',
      'execution_id',
      '--max-items',
      '10',
    ],
  },
];

// Each command gets its own budget so one hanging command fails on its own instead of stalling
// the whole run; the generator additionally bounds the overall run.
const COMMAND_TIMEOUT_MS = 60_000;

// Locate the built executable from the nearest package.json `bin` entry. Walking up from this
// file (rather than assuming a fixed relative path) keeps it correct whether this harness runs
// from the repo's `tests/` directory or is staged flat into a runner by the smoke tester.
const resolveBinPath = (): string => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 6; depth += 1) {
    const manifestPath = join(dir, 'package.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        bin?: string | Record<string, string>;
      };
      const bin = typeof manifest.bin === 'string' ? manifest.bin : Object.values(manifest.bin ?? {})[0];
      if (bin) return join(dir, bin);
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    'Could not locate the built CLI binary (run the package build first so dist/esm/bin.js exists).',
  );
};

// A `file` flag is a path the CLI opens, so its argv token is a placeholder rather than a sampled
// value — nothing the schema could produce names a real file. One temporary file backs every such
// flag in the run: the commands only need the path to resolve and the bytes to arrive.
const createSmokeFile = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'scalar-cli-smoke-'));
  const path = join(dir, 'smoke-upload.txt');
  writeFileSync(path, 'scalar smoke test upload\n', 'utf8');
  return path;
};

/**
 * How many commands run at once, capped at the number of cases there are.
 *
 * SCALAR_SMOKE_CONCURRENCY overrides the default; anything unparseable falls back to it.
 */
const smokeConcurrency = (caseCount: number): number => {
  const override = Number.parseInt(process.env['SCALAR_SMOKE_CONCURRENCY'] ?? '', 10);
  const limit = Number.isInteger(override) && override > 0 ? override : 32;
  return Math.min(limit, caseCount);
};

const main = async (): Promise<void> => {
  const binPath = resolveBinPath();
  const smokeFilePath = cases.some((testCase) => testCase.args.includes('__scalar_smoke_file__'))
    ? createSmokeFile()
    : undefined;

  // SCALAR_SMOKE_FILTER (comma-separated) keeps only cases whose operation name or path matches
  // one of the needles, so a caller can smoke-test a subset. With no filter, every case runs.
  const filter = process.env['SCALAR_SMOKE_FILTER'];
  const needles = filter
    ? filter
        .split(',')
        .map((needle) => needle.trim())
        .filter(Boolean)
    : [];
  const selected =
    needles.length > 0
      ? cases.filter((testCase) =>
          needles.some((needle) => testCase.operation.includes(needle) || testCase.path.includes(needle)),
        )
      : cases;

  // Run the selected commands under a bounded worker pool rather than all at once. Every case
  // spawns a whole node process running the built binary, so an unbounded fan-out over a large
  // SDK's command surface would swamp the machine. Each worker pulls the next index off a shared
  // cursor and writes into a pre-sized array, so results stay in case order however the workers
  // interleave. The per-case body catches everything and never rejects, so one failing command
  // still cannot block the others.
  const results: SmokeResult[] = new Array<SmokeResult>(selected.length);
  let cursor = 0;
  const runNext = async (): Promise<void> => {
    for (let index = cursor++; index < selected.length; index = cursor++) {
      const testCase = selected[index];
      if (!testCase) continue;
      const startedAt = Date.now();
      // `label` distinguishes the required-flags run from the all-flags run of the same command;
      // it is omitted entirely when the command contributed only one case.
      const identity = {
        operation: testCase.operation,
        method: testCase.method,
        path: testCase.path,
        ...(testCase.label ? { label: testCase.label } : {}),
      };
      try {
        // Pass the current environment through so the embedded SDK picks up the base URL and
        // credentials; node runs the built bin exactly as the published executable would.
        const args = testCase.args.map((arg) =>
          arg === '__scalar_smoke_file__' && smokeFilePath ? smokeFilePath : arg,
        );
        await execFileAsync('node', [binPath, ...args], {
          env: process.env,
          timeout: COMMAND_TIMEOUT_MS,
          maxBuffer: 1024 * 1024 * 20,
        });
        results[index] = { ...identity, status: 'passed', durationMs: Date.now() - startedAt };
      } catch (error) {
        // Surface stderr (commander/runtime error output) when present; fall back to the message.
        const detail =
          error && typeof error === 'object' && 'stderr' in error
            ? String((error as { stderr?: unknown }).stderr ?? '')
            : '';
        const message =
          detail.trim() || (error instanceof Error ? (error.stack ?? error.message) : String(error));
        results[index] = {
          ...identity,
          status: 'failed',
          durationMs: Date.now() - startedAt,
          error: message,
        };
      }
    }
  };
  await Promise.all(Array.from({ length: smokeConcurrency(selected.length) }, runNext));
  const failed = results.filter((result) => result.status === 'failed');

  // With SCALAR_SMOKE_REPORT set, write a machine-readable report; otherwise print a table.
  const reportPath = process.env['SCALAR_SMOKE_REPORT'];
  if (reportPath) {
    writeFileSync(reportPath, JSON.stringify({ total: results.length, failed: failed.length, results }));
  } else {
    for (const result of results) {
      const suffix = result.label ? ` [${result.label}]` : '';
      if (result.status === 'passed')
        console.log(
          `\u2714 ${result.operation}${suffix} (${result.method} ${result.path}) ${result.durationMs}ms`,
        );
      else
        console.error(
          `\u2718 ${result.operation}${suffix} (${result.method} ${result.path})\n${result.error ?? ''}`,
        );
    }
    if (results.length === 0) {
      console.error('No commands ran (empty SDK or a SCALAR_SMOKE_FILTER that matched nothing).');
    } else {
      console.log(`\n${results.length - failed.length}/${results.length} commands passed`);
    }
  }

  // An empty run (no operations, or a filter that matched nothing) is a failure, not a vacuous pass.
  if (failed.length > 0 || results.length === 0) process.exitCode = 1;
};

void main();
