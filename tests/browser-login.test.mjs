import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { auth } from '../dist/esm/commands/index.js';
import { runLogin } from '../dist/esm/cli/login.js';

test('browser login refuses to store a public session for another API', async () => {
  await assert.rejects(runLogin(auth, 'https://other.invalid', 'browser'), /unavailable for this API/);
});

test('browser configuration uses the public native client contract', () => {
  const method = auth.methods.find((entry) => entry.name === 'browser');
  assert.equal(method.clientId, 'dedalus-cli');
  assert.equal(method.resource, auth.defaultBaseUrl);
  assert.equal(method.issuer, auth.defaultBaseUrl);
  assert.equal(method.authorizationUrl, auth.defaultBaseUrl + '/oauth2/auth');
  assert.equal(method.tokenUrl, auth.defaultBaseUrl + '/oauth2/token');
  assert.deepEqual(method.scopes, ['dedalus:cli', 'offline_access']);
});

for (const invalid of [false, true]) {
  test(`browser login ${invalid ? 'rejects another issuer before exchange' : 'persists, refreshes and forgets credentials'}`, {
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
    const server = createServer(async (req, res) => {
      if (req.url.startsWith('/oauth2/auth?')) {
        authorization = new URL(req.url, origin).searchParams;
        const callback = new URL(authorization.get('redirect_uri'));
        callback.searchParams.set('code', 'test-code');
        callback.searchParams.set('state', authorization.get('state'));
        callback.searchParams.set('iss', invalid ? 'https://other.invalid' : origin);
        res.writeHead(302, { location: callback.href }).end();
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
    for (const key of ['DEDALUS_API_KEY', 'DEDALUS_X_API_KEY', 'DEDALUS_BASE_URL', 'DEDALUS_CUSTOM_HEADERS']) delete env[key];
    const run = (args, browser = false) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', `
        import { auth, getProgram } from './dist/esm/commands/index.js';
        const origin = process.env.TEST_API_ORIGIN;
        auth.backend = 'file';
        auth.defaultBaseUrl = origin;
        Object.assign(auth.methods[0], { resource: origin, issuer: origin,
          authorizationUrl: origin + '/oauth2/auth', tokenUrl: origin + '/oauth2/token',
          refreshUrl: origin + '/oauth2/token' });
        await getProgram().parseAsync(JSON.parse(process.env.TEST_ARGS), { from: 'user' });
      `], { env: { ...env, TEST_ARGS: JSON.stringify([...args, '--base-url', origin]) }, stdio: ['ignore', 'pipe', 'pipe'] });
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
    assert.equal(Buffer.from(authorization.get('state'), 'base64url').length, 32);
    assert.equal(authorization.get('code_challenge_method'), 'S256');
    assert.equal(createHash('sha256').update(exchanges[0].get('code_verifier')).digest('base64url'),
      authorization.get('code_challenge'));
    assert.equal(exchanges[0].get('redirect_uri'), authorization.get('redirect_uri'));
    assert.equal(statSync(store).mode & 0o777, 0o600);
    assert.equal((await run(['machines', 'list'])).code, 0);
    assert.equal(requests.at(-1), 'Bearer test-access');
    const saved = JSON.parse(readFileSync(store, 'utf8'));
    saved.profiles[origin].oauth.apiKey.expiresAt = 0;
    writeFileSync(store, JSON.stringify(saved));
    assert.equal((await run(['machines', 'list'])).code, 0);
    assert.equal(exchanges[1].get('grant_type'), 'refresh_token');
    assert.equal(exchanges[1].get('refresh_token'), 'test-refresh');
    assert.equal(requests.at(-1), 'Bearer test-refreshed');
    assert.equal(JSON.parse(readFileSync(store, 'utf8')).profiles[origin].oauth.apiKey.refreshToken, 'test-rotated');
    assert.equal((await run(['machines', 'list', '--api-key', 'explicit'])).code, 0);
    assert.equal(requests.at(-1), 'Bearer explicit');
    assert.equal((await run(['logout'])).code, 0);
    assert.equal(JSON.parse(readFileSync(store, 'utf8')).profiles[origin], undefined);
    assert.equal(login.stdout.includes('test-access'), false);
  });
}
