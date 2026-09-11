import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Command } from 'commander';
import { test } from 'node:test';

const root = resolve(process.env.FEEDBACK_PACKAGE_ROOT ?? '.');
const { sdkClientOptions, writeError } = await import(pathToFileURL(join(root, 'dist/esm/cli/runtime.js')));
const { default: SDK } = await import(pathToFileURL(join(root, 'dist/esm/sdk/index.js')));

test('invariant error formatting preserves errors with an explicit response body', async (t) => {
  let output = '';
  t.mock.method(process.stderr, 'write', (chunk) => { output += chunk; return true; });
  const body = { error_code: 'INVALID_REQUEST', message: 'fixture rejection', retryable: false };
  await writeError({ message: body.message, status: 422, body }, { format: 'json' }, [], SDK);
  assert.deepEqual(JSON.parse(output).body, body);
});

test('invariant SDK requests preserve organization scope without forwarding receipts', async (t) => {
  const previous = process.env.DEDALUS_CUSTOM_HEADERS;
  process.env.DEDALUS_CUSTOM_HEADERS = 'x-request-id: 01973f7b7cf6726a9a9f4f37d4b47a21';
  t.after(() => {
    if (previous === undefined) delete process.env.DEDALUS_CUSTOM_HEADERS;
    else process.env.DEDALUS_CUSTOM_HEADERS = previous;
  });
  const command = new Command('dedalus').version('1.0.0').command('machines').command('create');
  const options = sdkClientOptions({
    baseUrl: 'https://staging.invalid', apiKey: 'test-key', xDedalusOrgId: 'org-current',
  }, command, [{ name: 'api-key', optionKey: 'apiKey', sdkKey: 'apiKey' }]);
  let headers;
  const client = new SDK({
    ...options,
    fetch: async (_url, init) => {
      headers = new Headers(init.headers);
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    },
  });
  await client.get('/v1/machines');
  assert.equal(headers.get('x-dedalus-org-id'), 'org-current');
  assert.equal(headers.get('x-request-id'), null);
  assert.equal(headers.get('x-dedalus-cli-command'), 'dedalus machines create');
  assert.equal(headers.get('user-agent'), 'Dedalus/CLI 1.0.0');
});
