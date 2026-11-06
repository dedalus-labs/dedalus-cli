import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(process.env.CLI_PACKAGE_ROOT ?? '.');

const fixture = async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'dedalus-credential-boundary-'));
  const store = join(directory, 'credentials.json');
  const requests = [];
  const server = createServer((req, res) => {
    requests.push(req.headers.authorization);
    const rejected = req.headers.authorization === 'Bearer rejected-key';
    res.writeHead(rejected ? 401 : 200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(rejected
      ? { error_code: 'UNAUTHORIZED', message: 'fixture rejected credential' }
      : { items: [], next_cursor: null }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(() => { server.closeAllConnections(); server.close(); rmSync(directory, { recursive: true, force: true }); });
  const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('DEDALUS_')));
  const run = (args = [], extraEnv = {}) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, 'dist/esm/bin.js'),
      'machines', 'list', '--base-url', origin, '--max-retries', '0', ...args], {
      env: { ...cleanEnv, DEDALUS_CREDENTIALS_FILE: store, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    t.after(() => { if (child.exitCode === null) child.kill(); });
  });
  const save = (base = origin) => writeFileSync(store, JSON.stringify({
    version: 1, profiles: { [base]: { credentials: { apiKey: 'saved-key' }, backend: 'file' } },
  }), { mode: 0o600 });
  return { run, save, requests, store };
};

test('invariant_installed_entrypoint_uses_the_selected_credential_without_exposing_it', { timeout: 10000 }, async (t) => {
  const f = await fixture(t);
  f.save();
  for (const [args, env, expected] of [
    [[], {}, 'saved-key'],
    [[], { DEDALUS_API_KEY: 'environment-key' }, 'environment-key'],
    [['--api-key', 'flag-key'], { DEDALUS_API_KEY: 'environment-key' }, 'flag-key'],
  ]) {
    const result = await f.run(args, env);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(f.requests.at(-1), `Bearer ${expected}`);
    assert.doesNotMatch(result.stdout + result.stderr, /saved-key|environment-key|flag-key/);
  }
});

test('invariant_rejected_explicit_credentials_never_fall_back_to_saved_credentials', { timeout: 10000 }, async (t) => {
  const f = await fixture(t);
  f.save();
  const result = await f.run(['--api-key', 'rejected-key']);
  assert.equal(result.code, 10, result.stderr);
  assert.deepEqual(f.requests, ['Bearer rejected-key']);
  assert.doesNotMatch(result.stdout + result.stderr, /saved-key|rejected-key/);
});

test('invariant_credentials_for_another_api_never_reach_the_request', { timeout: 10000 }, async (t) => {
  const f = await fixture(t);
  f.save('https://another-api.invalid');
  const result = await f.run();
  assert.equal(result.code, 10, result.stderr);
  assert.deepEqual(f.requests, []);
});

test('invariant_corrupt_saved_credentials_do_not_block_explicit_authentication', { timeout: 10000 }, async (t) => {
  const f = await fixture(t);
  writeFileSync(f.store, '{invalid');
  const result = await f.run(['--api-key', 'flag-key']);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(f.requests, ['Bearer flag-key']);
});
