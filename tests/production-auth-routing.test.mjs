import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

const root = resolve(process.env.CLI_PACKAGE_ROOT ?? '.');

test('invariant_packaged_commands_route_each_credential_to_its_compatible_endpoint', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'dedalus-production-routing-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const store = join(directory, 'credentials.json');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('DEDALUS_')));
  const entry = pathToFileURL(join(root, 'dist/esm/bin.js')).href;
  // Exercise the packaged entrypoint and SDK. Only the transport is replaced:
  // no provider, auth definition, default URL, or command configuration is overridden.
  const script = `
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      process.stderr.write('REQUEST ' + JSON.stringify({url: request.url,
        authorization: request.headers.get('authorization'), apiKey: request.headers.get('x-api-key')}) + '\\n');
      return new Response(JSON.stringify({items: [], next_cursor: null}),
        {headers: {'content-type': 'application/json'}});
    };
    process.argv = [process.execPath, 'dedalus', 'machines', 'list', ...JSON.parse(process.env.TEST_ARGS)];
    await import(${JSON.stringify(entry)});
  `;
  for (const [saved, extraEnv, args, origin, bearer, apiKey] of [
    [{ browserToken: 'fixture-browser' }, {}, [], 'https://dcs.dedaluslabs.ai', 'fixture-browser', null],
    [{ apiKey: 'fixture-api-key' }, {}, [], 'https://dcs.dedaluslabs.ai', 'fixture-api-key', null],
    [{ xAPIKey: 'fixture-x-key' }, {}, [], 'https://dcs.dedaluslabs.ai', null, 'fixture-x-key'],
    [{}, { DEDALUS_BROWSER_TOKEN: 'fixture-browser' }, [], 'https://dcs.dedaluslabs.ai', 'fixture-browser', null],
    [{}, { DEDALUS_API_KEY: 'fixture-api-key', DEDALUS_BASE_URL: 'https://alternate-api.invalid' }, [], 'https://alternate-api.invalid', 'fixture-api-key', null],
    [{}, {}, ['--x-api-key', 'fixture-x-key', '--base-url', 'https://alternate-api.invalid'], 'https://alternate-api.invalid', null, 'fixture-x-key'],
    [{ browserToken: 'saved-browser' }, { DEDALUS_API_KEY: 'fixture-api-key' }, [], 'https://dcs.dedaluslabs.ai', 'fixture-api-key', null],
    [{ browserToken: 'saved-browser' }, { DEDALUS_X_API_KEY: 'fixture-x-key' }, [], 'https://dcs.dedaluslabs.ai', null, 'fixture-x-key'],
    [{ browserToken: 'saved-browser' }, {}, ['--api-key', 'fixture-api-key'], 'https://dcs.dedaluslabs.ai', 'fixture-api-key', null],
    [{ browserToken: 'saved-browser' }, {}, ['--x-api-key', 'fixture-x-key'], 'https://dcs.dedaluslabs.ai', null, 'fixture-x-key'],
  ]) {
    writeFileSync(store, JSON.stringify({ version: 1, profiles: {
      'https://dcs.dedaluslabs.ai': { credentials: saved, backend: 'file' },
    } }), { mode: 0o600 });
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...env, ...extraEnv, DEDALUS_CREDENTIALS_FILE: store, TEST_ARGS: JSON.stringify(args) },
      encoding: 'utf8', timeout: 10000,
    });
    assert.equal(result.status, 0, result.stderr);
    const requests = result.stderr.split('\n').filter(line => line.startsWith('REQUEST ')).map(line => JSON.parse(line.slice(8)));
    assert.equal(requests.length, 1, result.stderr);
    assert.deepEqual(requests[0], { url: origin + '/v1/machines', authorization: bearer && 'Bearer ' + bearer, apiKey });
  }
});
