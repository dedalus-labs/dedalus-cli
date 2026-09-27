import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { auth } from '../dist/esm/commands/index.js';
import { runLogin } from '../dist/esm/cli/login.js';

test('invariant_device_session_is_bound_to_its_api', async () => {
  await assert.rejects(runLogin(auth, 'https://other.invalid', 'device'), /unavailable for this API/);
});

for (const scenario of ['approved', 'denied', 'expired', 'wrong-issuer', 'unsupported', 'missing-endpoint', 'insecure-endpoint']) {
  test(`invariant_device_authorization_${scenario}`, { timeout: 15000 }, async (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'dedalus-device-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const store = join(directory, 'credentials.json');
    let polls = 0, deviceRequests = 0;
    const grants = [], requests = [];
    const server = createServer(async (req, res) => {
      const reply = (status, body) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
      if (req.url === '/.well-known/oauth-authorization-server') {
        reply(200, { issuer: scenario === 'wrong-issuer' ? 'https://other.invalid' : origin,
          grant_types_supported: scenario === 'unsupported' ? [] : ['urn:ietf:params:oauth:grant-type:device_code'],
          device_authorization_endpoint: scenario === 'missing-endpoint' ? undefined : origin + '/device',
          token_endpoint: scenario === 'insecure-endpoint' ? 'http://other.invalid/token' : origin + '/token' });
      } else if (req.url === '/device' || req.url === '/token') {
        let body = '';
        for await (const chunk of req) body += chunk;
        const form = new URLSearchParams(body);
        assert.equal(form.get('client_id'), 'dedalus-cli');
        assert.equal(form.has('client_secret'), false);
        if (req.url === '/device') {
          deviceRequests++;
          assert.equal(form.get('scope'), 'dedalus:cli offline_access');
          reply(200, { device_code: 'private-device-code', user_code: 'TEST-CODE',
            verification_uri: origin + '/verify', expires_in: 600, interval: 0.2 });
        } else {
          grants.push(form.get('grant_type'));
          if (form.get('grant_type') === 'refresh_token') {
            assert.equal(form.get('refresh_token'), 'saved-refresh');
            reply(200, { access_token: 'renewed-access', refresh_token: 'rotated-refresh', expires_in: 3600 });
          } else {
            assert.equal(form.get('device_code'), 'private-device-code');
            polls++;
            if (scenario === 'denied' || scenario === 'expired') {
              reply(400, { error: scenario === 'denied' ? 'access_denied' : 'expired_token' });
            } else if (polls === 1) reply(400, { error: 'authorization_pending' });
            else reply(200, { access_token: 'saved-access', refresh_token: 'saved-refresh', expires_in: 3600 });
          }
        }
      } else {
        requests.push(req.headers.authorization);
        reply(200, { items: [], next_cursor: null });
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => { server.closeAllConnections(); server.close(); });
    const origin = 'http://127.0.0.1:' + server.address().port;
    const env = { ...process.env, DEDALUS_CREDENTIALS_FILE: store, TEST_API_ORIGIN: origin };
    for (const key of ['DEDALUS_API_KEY', 'DEDALUS_X_API_KEY', 'DEDALUS_BASE_URL', 'DEDALUS_CUSTOM_HEADERS']) delete env[key];
    const run = (args) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', `
        import { auth, getProgram } from './dist/esm/commands/index.js';
        const origin = process.env.TEST_API_ORIGIN;
        auth.backend = 'file';
        auth.defaultBaseUrl = origin;
        Object.assign(auth.methods.find(method => method.name === 'device'), {
          resource: origin, issuer: origin, discoveryUrl: origin + '/.well-known/oauth-authorization-server'
        });
        await getProgram().parseAsync(JSON.parse(process.env.TEST_ARGS), { from: 'user' });
      `], { env: { ...env, TEST_ARGS: JSON.stringify([...args, '--base-url', origin]) }, stdio: ['ignore', 'pipe', 'pipe'] });
      t.after(() => { if (child.exitCode === null) child.kill(); });
      let stdout = '', stderr = '';
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', reject);
      child.on('exit', code => resolve({ code, stdout, stderr }));
    });
    const login = await run(['login', '--flow', 'device']);
    assert.equal((login.stdout + login.stderr).includes('private-device-code'), false);
    if (scenario !== 'approved') {
      assert.notEqual(login.code, 0);
      assert.throws(() => readFileSync(store), { code: 'ENOENT' });
      assert.equal(deviceRequests, ['denied', 'expired'].includes(scenario) ? 1 : 0);
      return;
    }
    assert.equal(login.code, 0, login.stderr);
    assert.match(login.stderr, /TEST-CODE/);
    assert.ok(login.stderr.includes(origin + '/verify'));
    assert.equal(polls, 2);
    assert.equal(grants[0], 'urn:ietf:params:oauth:grant-type:device_code');
    assert.equal((await run(['machines', 'list'])).code, 0);
    assert.equal(requests.at(-1), 'Bearer saved-access');
    const saved = JSON.parse(readFileSync(store, 'utf8'));
    saved.profiles[origin].oauth.apiKey.expiresAt = 0;
    writeFileSync(store, JSON.stringify(saved));
    assert.equal((await run(['machines', 'list'])).code, 0);
    assert.equal(requests.at(-1), 'Bearer renewed-access');
    assert.equal(JSON.parse(readFileSync(store, 'utf8')).profiles[origin].oauth.apiKey.refreshToken, 'rotated-refresh');
    assert.equal((await run(['logout'])).code, 0);
    assert.equal(JSON.parse(readFileSync(store, 'utf8')).profiles[origin], undefined);
  });
}
