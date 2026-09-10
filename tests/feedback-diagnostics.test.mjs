import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

const root = resolve(process.env.FEEDBACK_PACKAGE_ROOT ?? '.');
const { createDiagnostics, diagnosticScope, selectDiagnostics, pruneDiagnostics } =
  await import(pathToFileURL(join(root, 'dist/esm/feedback/diagnostics.js')));
const scope = diagnosticScope({ apiKey: 'test-key', baseURL: 'https://staging.invalid' });
const receipt = '01973f7b7cf6726a9a9f4f37d4b47a21';
const directory = (t) => {
  const path = mkdtempSync(join(tmpdir(), 'dedalus-diagnostics-test-'));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
};

test('invariant selection requires a recent failure in the same credential scope', (t) => {
  const dir = directory(t);
  const log = createDiagnostics('dedalus machines create', scope, dir);
  log.record({ kind: 'response', route: '/v1/machines', status_code: 200, duration_ms: 1 });
  assert.equal(selectDiagnostics(scope, dir).events.length, 0);
  log.record({ kind: 'transport_failure', route: '/v1/machines', duration_ms: 3 });
  assert.ok(selectDiagnostics(scope, dir).events.length > 0);
  assert.equal(selectDiagnostics(diagnosticScope({ apiKey: 'other-key' }), dir).events.length, 0);
  assert.equal(selectDiagnostics(scope, dir, Date.now() + 16 * 60 * 1000).events.length, 0);
});

test('invariant recording drops fields outside the diagnostic contract', (t) => {
  const dir = directory(t);
  const log = createDiagnostics('dedalus machines create', scope, dir);
  log.record({
    kind: 'response', status_code: 500, route: '/v1/machines', request_id: receipt,
    duration_ms: 7, authorization: 'Bearer super-secret',
    body: { password: 'secret-password' }, error: 'private workspace content',
  });
  const raw = readFileSync(join(dir, readdirSync(dir)[0]), 'utf8');
  assert.doesNotMatch(raw, /super-secret|secret-password|private workspace/);
  assert.equal(selectDiagnostics(scope, dir).receipt, receipt);
});

test('invariant feedback logs and symlinked files cannot be selected', (t) => {
  const dir = directory(t);
  const log = createDiagnostics('dedalus feedback', scope, dir);
  log.record({ kind: 'command_failure' });
  assert.equal(selectDiagnostics(scope, dir).events.length, 0);
  const name = scope + '.' + Date.now() + '.00000000-0000-0000-0000-000000000000.jsonl';
  symlinkSync(join(dir, readdirSync(dir)[0]), join(dir, name));
  assert.equal(selectDiagnostics(scope, dir).events.length, 0);
});

test('invariant local SSH failure retains the last session API receipt', (t) => {
  const dir = directory(t);
  const log = createDiagnostics('dedalus ssh', scope, dir);
  log.record({ kind: 'response', route: '/v1/machines/{machine_id}/ssh',
    status_code: 200, duration_ms: 10, request_id: receipt });
  log.record({ kind: 'command_failure' });
  const selection = selectDiagnostics(scope, dir);
  assert.equal(selection.receipt, receipt);
  assert.equal(selection.failure, undefined);
  assert.equal(selectDiagnostics(diagnosticScope({ apiKey: 'other-key' }), dir).events.length, 0);
});

test('invariant a later response without a receipt does not reuse an older receipt', (t) => {
  const dir = directory(t);
  const log = createDiagnostics('dedalus ssh', scope, dir);
  log.record({ kind: 'response', route: '/v1/machines/{machine_id}/ssh',
    status_code: 500, duration_ms: 10, request_id: receipt });
  log.record({ kind: 'response', route: '/v1/machines/{machine_id}/ssh/{resource_id}',
    status_code: 200, duration_ms: 5 });
  log.record({ kind: 'command_failure' });
  const selection = selectDiagnostics(scope, dir);
  assert.equal(selection.receipt, undefined);
  assert.equal(selection.failure, undefined);
});

test('invariant partitions are capped and expired logs are pruned', (t) => {
  const dir = directory(t);
  const log = createDiagnostics('dedalus machines list', scope, dir);
  for (let i = 0; i < 1200; i++) log.record({ kind: 'request_start', route: '/v1/machines' });
  const path = join(dir, readdirSync(dir)[0]);
  assert.equal(readFileSync(path, 'utf8').trim().split('\n').length, 1000);
  const old = new Date(Date.now() - 11 * 24 * 60 * 60 * 1000);
  utimesSync(path, old, old);
  pruneDiagnostics(dir);
  assert.equal(readdirSync(dir).length, 0);
});

test('invariant transport capture preserves receipts without request data', async (t) => {
  const dir = directory(t);
  t.mock.method(globalThis, 'fetch', async () => new Response('private response body', {
    status: 500, headers: { 'X-Request-ID': receipt },
  }));
  const diagnostics = createDiagnostics('dedalus machines retrieve', scope, dir);
  await diagnostics.fetch('https://staging.invalid/v1/machines/private-machine?token=secret-query', {
    headers: { Authorization: 'Bearer secret-key' },
  });
  const selection = selectDiagnostics(scope, dir);
  assert.equal(selection.receipt, receipt);
  assert.equal(selection.failure.route, '/v1/machines/{machine_id}');
  assert.doesNotMatch(JSON.stringify(selection), /private-machine|secret-query|secret-key|private response/);
});
