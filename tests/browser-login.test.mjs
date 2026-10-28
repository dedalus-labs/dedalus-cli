import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

const root = resolve(process.env.CLI_PACKAGE_ROOT ?? '.');
const { auth } = await import(pathToFileURL(join(root, 'dist/esm/commands/index.js')));
const { runLogin, runLogout } = await import(pathToFileURL(join(root, 'dist/esm/cli/login.js')));
const { takeWarnings } = await import(pathToFileURL(join(root, 'dist/esm/cli/credentials.js')));
const browserMethod = { name: 'browser', label: 'Browser', kind: 'oauth', grant: 'authorizationCode',
  clientKey: 'apiKey', clientId: 'dedalus-cli', redirectPort: 0, scopes: ['dedalus:cli', 'offline_access'],
  authorizationUrl: '', tokenUrl: '', refreshUrl: '' };

test('invariant_public_browser_flow_contains_production_provider_configuration', () => {
  const method = auth.methods.find(method => method.kind === 'oauth');
  assert.equal(method.name, 'oauth-browser');
  assert.equal(method.clientKey, 'browserToken');
  assert.equal(method.issuer, 'https://clerk.dedaluslabs.ai');
  assert.equal(method.clientId, 'j7A9ArTlXXvR2ocG');
  assert.equal(method.authorizationUrl, method.issuer + '/oauth/authorize');
  assert.equal(method.tokenUrl, method.issuer + '/oauth/token');
  assert.equal(method.refreshUrl, method.tokenUrl);
  assert.equal(method.revocationUrl, method.issuer + '/oauth/token/revoke');
  assert.deepEqual(method.resource, ['https://dcs.dedaluslabs.ai']);
  assert.deepEqual(method.scopes, ['offline_access', 'user:org:read']);
  assert.equal(method.redirectPort, 0);
  // Browser sign-in is the only login flow, so `dedalus login` never shows a picker. API keys
  // remain flags and environment variables, and a saved browser session outranks a saved key.
  assert.deepEqual(auth.methods.map(method => method.name), ['oauth-browser']);
  assert.deepEqual(auth.requirements, [['browserToken'], ['apiKey'], ['xAPIKey']]);
});

for (const callbackCase of ['valid', 'wrong-issuer', 'missing-issuer', 'duplicate-issuer', 'wrong-state', 'duplicate-state', 'duplicate-code', 'duplicate-error']) {
  const invalid = callbackCase !== 'valid';
  test(invalid ? `invariant_unbound_callback_never_exchanges_or_stores_tokens (${callbackCase})` : 'invariant_browser_session_persists_refreshes_and_revokes_credentials', {
    skip: process.platform === 'win32', timeout: 15000,
  }, async (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'dedalus-browser-test-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    // Capture the printed URL instead of opening a real account in the test.
    for (const opener of ['open', 'xdg-open']) {
      writeFileSync(join(directory, opener), '#!/bin/sh\nexit 0\n', { mode: 0o700 });
    }
    let authorization;
    const exchanges = [];
    const requests = [];
    const revocations = [];
    let rejectRevocation = false;
    const server = createServer(async (req, res) => {
      if (req.url.startsWith('/oauth2/auth?')) {
        authorization = new URL(req.url, origin).searchParams;
        const callback = new URL(authorization.get('redirect_uri'));
        callback.searchParams.set('code', 'test-code');
        callback.searchParams.set('state', authorization.get('state'));
        callback.searchParams.set('iss', origin);
        if (callbackCase === 'wrong-issuer') callback.searchParams.set('iss', 'https://other.invalid');
        if (callbackCase === 'missing-issuer') callback.searchParams.delete('iss');
        if (callbackCase === 'duplicate-issuer') callback.searchParams.append('iss', origin);
        if (callbackCase === 'duplicate-code') callback.searchParams.append('code', 'other-code');
        if (callbackCase === 'duplicate-error') {
          callback.searchParams.append('error', 'access_denied');
          callback.searchParams.append('error', 'server_error');
        }
        if (callbackCase === 'wrong-state') callback.searchParams.set('state', 'unbound-state');
        if (callbackCase === 'duplicate-state') callback.searchParams.append('state', authorization.get('state'));
        res.writeHead(302, { location: callback.href }).end();
      } else if (req.url === '/oauth2/revoke') {
        let body = '';
        for await (const chunk of req) body += chunk;
        const form = new URLSearchParams(body);
        revocations.push(Object.fromEntries(form));
        res.writeHead(rejectRevocation ? 503 : form.get('client_id') !== 'dedalus-cli' ? 400 : 200).end();
      } else if (req.url === '/oauth2/token') {
        let body = '';
        for await (const chunk of req) body += chunk;
        const form = new URLSearchParams(body);
        exchanges.push(form);
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
          access_token: exchanges.length === 1 ? 'test-access' : 'test-refreshed',
          refresh_token: exchanges.length === 1 ? 'test-refresh' : 'test-rotated',
          token_type: 'Bearer', expires_in: 3600,
        }));
      } else {
        requests.push(req.headers.authorization);
        res.writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify({ items: [], next_cursor: null }));
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => { server.closeAllConnections(); server.close(); });
    const origin = 'http://127.0.0.1:' + server.address().port;
    const store = join(directory, 'credentials.json');
    const env = { ...process.env, PATH: directory + ':' + process.env.PATH,
      DEDALUS_CREDENTIALS_FILE: store, TEST_API_ORIGIN: origin };
    for (const key of ['DEDALUS_API_KEY', 'DEDALUS_X_API_KEY', 'DEDALUS_BASE_URL', 'DEDALUS_CUSTOM_HEADERS', 'DEDALUS_BROWSER_TOKEN']) delete env[key];
    const run = (args, browser = false) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', `
        import { auth, getProgram } from './dist/esm/commands/index.js';
        const origin = process.env.TEST_API_ORIGIN;
        auth.backend = 'file';
        auth.defaultBaseUrl = origin;
        auth.methods = [{ ...${JSON.stringify(browserMethod)}, resource: [origin], issuer: origin,
          authorizationUrl: origin + '/oauth2/auth', tokenUrl: origin + '/oauth2/token',
          refreshUrl: origin + '/oauth2/token', revocationUrl: origin + '/oauth2/revoke' }];
        await getProgram().parseAsync(JSON.parse(process.env.TEST_ARGS), { from: 'user' });
      `], { cwd: root, env: { ...env, TEST_ARGS: JSON.stringify([...args, '--base-url', origin]) }, stdio: ['ignore', 'pipe', 'pipe'] });
      t.after(() => { if (child.exitCode === null) child.kill(); });
      let stdout = '', stderr = '', opened = false;
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
        const match = stderr.match(/  (http:\/\/127\.0\.0\.1:[^\s]+)/);
        if (browser && match && !opened) {
          opened = true;
          fetch(match[1]).then((response) => response.text()).catch(reject);
        }
      });
      child.on('error', reject);
      child.on('exit', (code) => resolve({ code, stdout, stderr }));
    });
    const login = await run(['login', '--flow', 'browser'], true);
    if (invalid) {
      assert.notEqual(login.code, 0);
      assert.equal(exchanges.length, 0);
      assert.throws(() => readFileSync(store), { code: 'ENOENT' });
      return;
    }
    assert.equal(login.code, 0, login.stderr);
    assert.equal(authorization.size, 8);
    assert.equal(authorization.get('resource'), origin);
    assert.equal(authorization.get('client_id'), 'dedalus-cli');
    assert.equal(authorization.get('scope'), 'dedalus:cli offline_access');
    assert.ok(Buffer.from(authorization.get('state'), 'base64url').length >= 16);
    assert.equal(authorization.get('code_challenge_method'), 'S256');
    assert.equal(createHash('sha256').update(exchanges[0].get('code_verifier')).digest('base64url'),
      authorization.get('code_challenge'));
    assert.equal(exchanges[0].get('redirect_uri'), authorization.get('redirect_uri'));
    assert.deepEqual(exchanges[0].getAll('resource'), [origin]);
    assert.equal(statSync(store).mode & 0o777, 0o600);
    assert.equal((await run(['machines', 'list'])).code, 0);
    assert.equal(requests.at(-1), 'Bearer test-access');
    const saved = JSON.parse(readFileSync(store, 'utf8'));
    saved.profiles[origin].oauth.apiKey.expiresAt = 0;
    writeFileSync(store, JSON.stringify(saved));
    assert.equal((await run(['machines', 'list'])).code, 0);
    assert.equal(exchanges[1].get('grant_type'), 'refresh_token');
    assert.equal(exchanges[1].get('refresh_token'), 'test-refresh');
    assert.deepEqual(exchanges[1].getAll('resource'), [origin]);
    assert.equal(requests.at(-1), 'Bearer test-refreshed');
    assert.equal(JSON.parse(readFileSync(store, 'utf8')).profiles[origin].oauth.apiKey.refreshToken, 'test-rotated');
    assert.equal((await run(['machines', 'list', '--api-key', 'explicit'])).code, 0);
    assert.equal(requests.at(-1), 'Bearer explicit');
    const logout = await run(['logout']);
    assert.equal(logout.code, 0, logout.stderr);
    assert.equal(logout.stderr, '', 'provider must accept the revocation request');
    assert.deepEqual(revocations, [
      { token: 'test-rotated', token_type_hint: 'refresh_token', client_id: 'dedalus-cli' },
      { token: 'test-refreshed', token_type_hint: 'access_token', client_id: 'dedalus-cli' },
    ]);
    assert.equal(JSON.parse(readFileSync(store, 'utf8')).profiles[origin], undefined);
    assert.equal(login.stdout.includes('test-access'), false);
  });
}

test('design_logout_clears_local_credentials_despite_revocation_failure', { timeout: 20000 }, async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'dedalus-logout-test-'));
  const store = join(directory, 'credentials.json');
  const variable = 'DEDALUS_LOGOUT_TEST_STORE';
  process.env[variable] = store;
  t.after(() => { delete process.env[variable]; rmSync(directory, { recursive: true, force: true }); });
  const config = { ...auth, methods: [browserMethod], backend: 'file', storeEnv: variable };
  let behavior = 'success';
  let warnings = '';
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push(Object.fromEntries(new URLSearchParams(body)));
    if (behavior === 'offline') { req.socket.destroy(); return; }
    if (behavior === 'timeout') return;
    if (behavior === 'replace') {
      const data = { version: 1, profiles: { [origin]: { credentials: { apiKey: 'new-access' } } } };
      writeFileSync(store, JSON.stringify(data));
    }
    res.writeHead(behavior === 'failure' ? 503 : 204).end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const oauth = { credentials: { apiKey: 'access-secret' }, oauth: { apiKey: {
    refreshToken: 'refresh-secret', clientId: 'client', revocationUrl: origin + '/revoke',
  } } };
  const save = (profile = oauth) => {
    warnings = '';
    takeWarnings();
    requests.length = 0;
    writeFileSync(store, JSON.stringify({ version: 1, profiles: {
      [origin]: profile, 'https://manual.example': { credentials: { apiKey: 'manual' } },
    } }));
  };
  const profiles = () => JSON.parse(readFileSync(store, 'utf8')).profiles;
  for (behavior of ['success', 'failure', 'offline', 'timeout', 'replace']) {
    save();
    const started = Date.now();
    await runLogout(config, origin, true);
    warnings = takeWarnings().join('\n');
    if (behavior === 'replace') assert.equal(profiles()[origin].credentials.apiKey, 'new-access');
    else assert.throws(() => readFileSync(store), { code: 'ENOENT' });
    assert.deepEqual(requests, [
      { token: 'refresh-secret', token_type_hint: 'refresh_token', client_id: 'client' },
      ...(['success', 'replace'].includes(behavior)
        ? [{ token: 'access-secret', token_type_hint: 'access_token', client_id: 'client' }] : []),
    ]);
    if (['failure', 'offline', 'timeout'].includes(behavior)) assert.match(warnings, /could not revoke|not revoked/);
    else assert.equal(warnings, '');
    assert.doesNotMatch(warnings, /access-secret|refresh-secret/);
    if (behavior === 'timeout') assert.ok(Date.now() - started < 9000, 'revocation must finish near its 5-second timeout');
  }
  behavior = 'success';
  const accessOnly = structuredClone(oauth);
  delete accessOnly.oauth.apiKey.refreshToken;
  save(accessOnly);
  await runLogout(config, origin, false);
  assert.deepEqual(requests, [{ token: 'access-secret', token_type_hint: 'access_token', client_id: 'client' }]);
  assert.equal(profiles()[origin], undefined);
  assert.ok(profiles()['https://manual.example']);
  const legacy = structuredClone(oauth);
  delete legacy.oauth.apiKey.revocationUrl;
  save(legacy);
  await runLogout(config, origin, true);
  assert.deepEqual(requests, []);
  assert.deepEqual(takeWarnings(), []);
  assert.throws(() => readFileSync(store), { code: 'ENOENT' });
  writeFileSync(store, '{corrupt');
  await runLogout(config, origin, true);
  assert.throws(() => readFileSync(store), { code: 'ENOENT' });
  // Local removal failures must still fail logout, even when no revocation is possible.
  const { mkdirSync } = await import('node:fs');
  mkdirSync(store);
  await assert.rejects(runLogout(config, origin, true));
});
