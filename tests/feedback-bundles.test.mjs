import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { test } from 'node:test';
const root = resolve(process.env.FEEDBACK_PACKAGE_ROOT ?? '.');
const load = (name) => import(pathToFileURL(join(root, 'dist/esm/feedback', name + '.js')));
const { createDiagnostics, diagnosticScope, selectDiagnostics } = await load('diagnostics');
const { buildFeedbackBundle } = await load('bundle');
const scope = diagnosticScope({ apiKey: 'test-key', baseURL: 'https://staging.invalid' });
const receipt = '01973f7b7cf6726a9a9f4f37d4b47a21';
const directory = (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'dedalus-feedback-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

test('invariant opt-out sends no files and preserves the failure receipt', (t) => {
  const dir = directory(t);
  const log = createDiagnostics('dedalus machines create', scope, dir);
  log.record({
    kind: 'response',
    route: '/v1/machines',
    status_code: 500,
    duration_ms: 42,
    request_id: receipt,
  });
  log.record({ kind: 'command_failure' });
  const result = buildFeedbackBundle('false', scope, 'https://staging.invalid', '1.0.0', dir);
  assert.equal(result.selection.receipt, receipt);
  assert.deepEqual(result.attachments, []);
});

test('invariant auto selects only recent failures for the same credential and host', (t) => {
  const dir = directory(t);
  const log = createDiagnostics('dedalus machines create', scope, dir);
  log.record({ kind: 'response', route: '/v1/machines', status_code: 200, duration_ms: 1 });
  assert.equal(
    buildFeedbackBundle('auto', scope, 'https://staging.invalid', '1.0.0', dir).attachments.length,
    0,
  );
  log.record({ kind: 'transport_failure', route: '/v1/machines', duration_ms: 3 });
  log.record({ kind: 'command_failure' });
  assert.ok(
    buildFeedbackBundle('auto', scope, 'https://staging.invalid', '1.0.0', dir).attachments.length >
      0,
  );
  assert.equal(selectDiagnostics(diagnosticScope({ apiKey: 'other-key' }), dir).events.length, 0);
  assert.equal(selectDiagnostics(scope, dir, Date.now() + 16 * 60 * 1000).events.length, 0);
  assert.equal(selectDiagnostics(scope, dir).receipt, undefined);
});

test('invariant attachments contain only allowlisted fields and exact byte hashes', (t) => {
  const dir = directory(t);
  const log = createDiagnostics('dedalus machines create', scope, dir);
  log.record({
    kind: 'response',
    status_code: 500,
    route: '/v1/machines',
    request_id: receipt,
    duration_ms: 7,
    authorization: 'Bearer super-secret',
    body: { password: 'secret-password' },
    error: 'private workspace content',
  });
  log.record({ kind: 'command_failure' });
  const raw = readFileSync(join(dir, readdirSync(dir)[0]), 'utf8');
  assert.doesNotMatch(raw, /super-secret|secret-password|private workspace/);
  const bundle = buildFeedbackBundle(
    'true',
    scope,
    'https://user:password@staging.invalid/?token=secret',
    '1.0.0',
    dir,
  );
  assert.equal(bundle.attachments.length, 4);
  for (const file of bundle.attachments) {
    assert.equal(file.manifest.sha256, createHash('sha256').update(file.bytes).digest('hex'));
    assert.equal(file.manifest.size_bytes, file.bytes.length);
    const content =
      file.manifest.format === 'application/gzip' ? gunzipSync(file.bytes) : file.bytes;
    assert.doesNotMatch(
      Buffer.from(content).toString(),
      /super-secret|secret-password|private workspace|user:password|token=secret/,
    );
  }
  assert.ok(bundle.attachments.reduce((sum, file) => sum + file.bytes.length, 0) <= 1024 * 1024);
});
