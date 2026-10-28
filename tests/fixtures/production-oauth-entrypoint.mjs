// The installed CLI keeps its production configuration. Only network and OS-keyring I/O are replaced.
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const originalSpawn = childProcess.spawnSync;
childProcess.spawnSync = (file, ...args) => {
  if (file === '/usr/bin/security' || file === 'secret-tool') {
    return { status: 1, stdout: '', stderr: 'fixture keyring unavailable' };
  }
  return originalSpawn(file, ...args);
};
syncBuiltinESMExports();

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json' },
});
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const form = new URLSearchParams(await request.clone().text());
  const record = { url: request.url, method: request.method,
    authorization: request.headers.get('authorization'), form: Object.fromEntries(form) };
  appendFileSync(process.env.TEST_REQUESTS, JSON.stringify(record) + '\n');
  if (request.url === 'https://clerk.dedaluslabs.ai/oauth/token') {
    assert.equal(request.method, 'POST');
    assert.equal(request.redirect, 'error');
    assert.equal(form.get('client_id'), 'j7A9ArTlXXvR2ocG');
    assert.deepEqual(form.getAll('resource'), ['https://dcs.dedaluslabs.ai']);
    const refresh = form.get('grant_type') === 'refresh_token';
    assert.equal(form.get('grant_type'), refresh ? 'refresh_token' : 'authorization_code');
    if (refresh) assert.equal(form.get('refresh_token'), 'fixture-refresh');
    else assert.equal(form.get('code'), 'fixture-code');
    return json({ access_token: refresh ? 'fixture-renewed' : 'fixture-access',
      refresh_token: refresh ? 'fixture-rotated' : 'fixture-refresh',
      token_type: 'Bearer', expires_in: 3600 });
  }
  if (request.url === 'https://clerk.dedaluslabs.ai/oauth/token/revoke') {
    assert.equal(request.method, 'POST');
    assert.equal(request.redirect, 'error');
    assert.equal(form.get('client_id'), 'j7A9ArTlXXvR2ocG');
    const revoked = JSON.parse(readFileSync(process.env.TEST_REVOKED, 'utf8'));
    revoked.push(form.get('token'));
    writeFileSync(process.env.TEST_REVOKED, JSON.stringify(revoked));
    return new Response(null, { status: 200 });
  }
  assert.equal(request.url, 'https://dcs.dedaluslabs.ai/v1/machines');
  assert.equal(request.method, 'GET');
  const revoked = JSON.parse(readFileSync(process.env.TEST_REVOKED, 'utf8'));
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  return revoked.includes(token)
    ? json({ error_code: 'UNAUTHORIZED', message: 'fixture rejected revoked token' }, 401)
    : json({ items: [], next_cursor: null });
};

process.argv = [process.execPath, 'dedalus', ...JSON.parse(process.env.TEST_ARGS)];
await import(pathToFileURL(join(process.env.CLI_PACKAGE_ROOT, 'dist/esm/bin.js')).href);
