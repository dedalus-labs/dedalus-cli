import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

test('invariant_port_password_updates_validate_before_sending_without_logging_secrets', async (t) => {
  const requests = [];
  let status = 200;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requests.push({ method: req.method, path: req.url, body: JSON.parse(Buffer.concat(chunks).toString()) });
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(status === 200 ? '{}' : '{"message":"password update conflicted"}');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  );
  const home = mkdtempSync(join(tmpdir(), 'dedalus-password-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const machine = '017f22e2-79b0-7cc3-98c4-dc0c0c07398f';
  const invoke = (flags = [], input = '') =>
    new Promise((finish) => {
      const child = execFile(
        process.execPath,
        [
          resolve(process.env.CLI_PACKAGE_ROOT ?? '.', 'dist/esm/bin.js'),
          '--base-url',
          `http://127.0.0.1:${server.address().port}`,
          '--api-key',
          'fixture',
          '--max-retries',
          '0',
          'machines',
          'ports',
          'update',
          '--machine-id',
          machine,
          '--port-id',
          'port-3000',
          ...flags,
        ],
        { timeout: 10000, env: { HOME: home, USERPROFILE: home, PATH: process.env.PATH } },
        (error, stdout, stderr) => finish({ code: error?.code ?? 0, stdout, stderr }),
      );
      child.stdin.end(input);
    });

  // Setting and replacing use the same endpoint. Omission must send no password.
  for (const password of ['aB12cD34', 'zY98xW76']) {
    const result = await invoke(['--visibility', 'key_required', '--password', password, '--debug']);
    assert.equal(result.code, 0, result.stderr);
    assert.ok(!result.stdout.includes(password) && !result.stderr.includes(password));
    assert.deepEqual(requests.at(-1), {
      method: 'PATCH',
      path: `/v1/machines/${machine}/ports/port-3000`,
      body: { visibility: 'key_required', password },
    });
  }
  assert.equal((await invoke(['--visibility', 'key_required'])).code, 0);
  assert.deepEqual(requests.at(-1).body, { visibility: 'key_required' });

  const file = join(home, 'password');
  writeFileSync(file, '01234567');
  assert.equal((await invoke(['--visibility', 'key_required', '--password', `@${file}`])).code, 0);
  assert.deepEqual(requests.at(-1).body, { visibility: 'key_required', password: '01234567' });
  assert.equal(
    (await invoke([], JSON.stringify({ visibility: 'key_required', password: 'AbCdEfGh' }))).code,
    0,
  );
  assert.deepEqual(requests.at(-1).body, { visibility: 'key_required', password: 'AbCdEfGh' });

  const sent = requests.length;
  for (const password of ['', 'short12', 'toolong12', 'abc!1234', 'abcd ef1', 'ébc12345', 'abc1234\n']) {
    const result = await invoke(['--visibility', 'key_required', '--password', password]);
    assert.equal(result.code, 2, result.stderr);
    assert.match(result.stderr, /exactly 8 ASCII letters or digits/);
  }
  for (const password of [null, 12345678, ['aB12cD34'], 'bad']) {
    assert.equal((await invoke([], JSON.stringify({ visibility: 'key_required', password }))).code, 2);
  }
  for (const visibility of ['private', 'public']) {
    const result = await invoke(['--visibility', visibility, '--password', 'aB12cD34']);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /key_required/);
  }
  writeFileSync(file, 'bad');
  assert.equal((await invoke(['--visibility', 'key_required', '--password', `@${file}`])).code, 2);
  assert.equal(requests.length, sent, 'invalid input reached the API');

  status = 409;
  const conflict = await invoke(['--visibility', 'key_required', '--password', 'Qw12Er34']);
  assert.equal(conflict.code, 13);
  assert.match(conflict.stderr, /password update conflicted/);
  const logs = readdirSync(join(home, '.dedalus', 'debug'))
    .map((name) => readFileSync(join(home, '.dedalus', 'debug', name), 'utf8'))
    .join('');
  for (const password of ['aB12cD34', 'zY98xW76', '01234567', 'AbCdEfGh', 'Qw12Er34']) {
    assert.ok(!logs.includes(password), 'diagnostics retained a password');
  }
});
