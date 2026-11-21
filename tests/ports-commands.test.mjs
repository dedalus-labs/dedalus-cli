import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const run = promisify(execFile);
const bin = resolve(process.env.CLI_PACKAGE_ROOT ?? '.', 'dist/esm/bin.js');
const machine = '017f22e2-79b0-7cc3-98c4-dc0c0c07398f';
const port = 'port-3000';
const key = 'fixture-key';
const portFlags = ['--port-id', port];
const keyFlags = [...portFlags, '--access-key-id', key];
const keys = '/' + port + '/access-keys';
const cases = [
  ['list', [], 'GET', '', null],
  ['create', ['--port', '3000', '--expires', '300'], 'POST', '', { port: 3000, expires: 300 }],
  ['retrieve', portFlags, 'GET', '/' + port, null],
  ['update', [...portFlags, '--visibility', 'private'], 'PATCH', '/' + port, { visibility: 'private' }],
  ['delete', portFlags, 'DELETE', '/' + port, null],
  ['access-keys list', portFlags, 'GET', keys, null],
  ['access-keys mint', [...portFlags, '--expires-in', '120'], 'POST', keys, { expires_in: 120 }],
  [
    'access-keys rotate',
    [...keyFlags, '--expires-in', '120'],
    'POST',
    keys + '/' + key + '/rotate',
    { expires_in: 120 },
  ],
  ['access-keys revoke', keyFlags, 'DELETE', keys + '/' + key, null],
];

for (const [command, flags, method, suffix, body] of cases) {
  test('machines ports ' + command + ' sends the documented request', async (t) => {
    const requests = [];
    const server = createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString();
      requests.push({
        method: req.method,
        path: req.url,
        auth: req.headers.authorization,
        body: raw ? JSON.parse(raw) : null,
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))));
    await run(
      process.execPath,
      [
        bin,
        '--base-url',
        'http://127.0.0.1:' + server.address().port,
        '--api-key',
        'fixture',
        '--max-retries',
        '0',
        'machines',
        'ports',
        ...command.split(' '),
        '--machine-id',
        machine,
        ...flags,
      ],
      { timeout: 10000 },
    );
    assert.deepEqual(requests, [
      { method, path: '/v1/machines/' + machine + '/ports' + suffix, auth: 'Bearer fixture', body },
    ]);
  });
}
