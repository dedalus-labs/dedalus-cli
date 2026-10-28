import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const api = 'https://dcs.dedaluslabs.ai';
const issuer = 'https://clerk.dedaluslabs.ai';
const root = resolve(process.env.CLI_PACKAGE_ROOT ?? '.');
const entrypoint = fileURLToPath(new URL('./fixtures/production-oauth-entrypoint.mjs', import.meta.url));

const fixture = (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'dedalus-production-oauth-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const store = join(directory, 'credentials.json');
  const trace = join(directory, 'requests.jsonl');
  const revoked = join(directory, 'revoked.json');
  writeFileSync(revoked, '[]');
  for (const opener of ['open', 'xdg-open']) {
    writeFileSync(join(directory, opener), '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  }
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('DEDALUS_')));
  const readStore = () => JSON.parse(readFileSync(store, 'utf8'));
  const requests = () => readFileSync(trace, 'utf8').trim().split('\n').map(JSON.parse);
  let authorization;
  const run = (args, browser = false) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entrypoint], {
      env: { ...env, PATH: directory + ':' + env.PATH, CLI_PACKAGE_ROOT: root,
        DEDALUS_CREDENTIALS_FILE: store, TEST_REQUESTS: trace, TEST_REVOKED: revoked,
        TEST_ARGS: JSON.stringify(args) }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    t.after(() => { if (child.exitCode === null) child.kill(); });
    let stdout = '', stderr = '', opened = false;
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => {
      stderr += chunk;
      const match = stderr.match(/  (https:\/\/clerk\.dedaluslabs\.ai\/oauth\/authorize\?[^\s]+)/);
      if (!browser || !match || opened) return;
      opened = true;
      authorization = new URL(match[1]).searchParams;
      const callback = new URL(authorization.get('redirect_uri'));
      assert.equal(callback.hostname, '127.0.0.1');
      callback.searchParams.set('code', 'fixture-code');
      callback.searchParams.set('state', authorization.get('state'));
      callback.searchParams.set('iss', issuer);
      fetch(callback).then(response => response.text()).catch(reject);
    });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });

  return { run, store, revoked, readStore, requests, authorization: () => authorization };
};

test('invariant_production_browser_configuration_drives_the_complete_credential_lifecycle', {
  skip: process.platform === 'win32', timeout: 15000,
}, async (t) => {
  const { run, store, revoked, readStore, requests, authorization: readAuthorization } = fixture(t);
  const login = await run(['login', '--flow', 'oauth'], true);
  assert.equal(login.code, 0, login.stderr);
  const authorization = readAuthorization();
  assert.deepEqual(authorization.getAll('resource'), [api]);
  assert.equal(authorization.get('client_id'), 'j7A9ArTlXXvR2ocG');
  assert.equal(authorization.get('scope'), 'offline_access user:org:read');
  assert.equal(authorization.get('code_challenge_method'), 'S256');
  const exchange = requests()[0].form;
  assert.equal(createHash('sha256').update(exchange.code_verifier).digest('base64url'),
    authorization.get('code_challenge'));
  assert.equal(exchange.redirect_uri, authorization.get('redirect_uri'));
  assert.equal(statSync(store).mode & 0o777, 0o600);
  assert.equal(readStore().profiles[api].credentials.browserToken, 'fixture-access');
  assert.equal((await run(['machines', 'list'])).code, 0);
  assert.equal(requests().at(-1).authorization, 'Bearer fixture-access');

  const saved = readStore();
  saved.profiles[api].oauth.browserToken.expiresAt = 0;
  writeFileSync(store, JSON.stringify(saved));
  assert.equal((await run(['machines', 'list'])).code, 0);
  assert.equal(requests().at(-1).authorization, 'Bearer fixture-renewed');
  assert.equal(readStore().profiles[api].oauth.browserToken.refreshToken, 'fixture-rotated');
  const logout = await run(['logout']);
  assert.equal(logout.code, 0, logout.stderr);
  assert.equal(readStore().profiles[api], undefined);
  assert.deepEqual(JSON.parse(readFileSync(revoked, 'utf8')), ['fixture-rotated', 'fixture-renewed']);
  const rejected = await run(['machines', 'list', '--browser-token', 'fixture-renewed', '--max-retries', '0']);
  assert.equal(rejected.code, 10, rejected.stderr);
  assert.doesNotMatch(login.stdout + login.stderr + logout.stdout + logout.stderr + rejected.stderr,
    /fixture-access|fixture-renewed|fixture-refresh|fixture-rotated/);
});
