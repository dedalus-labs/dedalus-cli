import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Command } from 'commander';

const root = resolve(process.env.CLI_PACKAGE_ROOT ?? '.');
const { sdkClientOptions } = await import(pathToFileURL(join(root, 'dist/esm/cli/runtime.js')));
const clientOptions = [
  { clientKey: 'browserToken', sdkKey: 'browserToken', name: 'browser-token', optionKey: 'browserToken', auth: true },
  { clientKey: 'apiKey', sdkKey: 'apiKey', name: 'api-key', optionKey: 'apiKey', auth: true, env: 'DEDALUS_API_KEY' },
  { clientKey: 'xAPIKey', sdkKey: 'xAPIKey', name: 'x-api-key', optionKey: 'xApiKey', auth: true, env: 'DEDALUS_X_API_KEY' },
];
const cleanEnvironment = (t) => {
  for (const key of ['DEDALUS_API_KEY', 'DEDALUS_X_API_KEY', 'DEDALUS_BASE_URL', 'DEDALUS_BROWSER_TOKEN']) {
    const previous = process.env[key];
    delete process.env[key];
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
};
const options = (values, environment) => sdkClientOptions(values,
  new Command('dedalus').version('test'), clientOptions, undefined, [], environment);

test('invariant_browser_credentials_are_routed_only_to_the_production_api', async (t) => {
  cleanEnvironment(t);
  for (const baseUrl of [undefined, 'https://dcs.dedaluslabs.ai', 'https://dcs.dedaluslabs.ai/']) {
    const result = await options({ browserToken: 'fixture-browser-token', baseUrl });
    assert.equal(result.baseURL, 'https://dcs.dedaluslabs.ai');
    assert.equal(result.browserToken, 'fixture-browser-token');
  }
  for (const baseUrl of ['https://gateway.invalid/dcs', 'https://other.invalid', 'http://dcs.dedaluslabs.ai',
    'https://dcs.dedaluslabs.ai.attacker.invalid', 'https://dcs.dedaluslabs.ai/private']) {
    await assert.rejects(options({ browserToken: 'fixture-browser-token', baseUrl }), /production DCS API/);
  }
  process.env.DEDALUS_BASE_URL = 'https://other.invalid';
  await assert.rejects(options({ browserToken: 'fixture-browser-token' }), /production DCS API/);
});

test('invariant_mixed_authentication_and_other_environments_fail_before_request_construction', async (t) => {
  cleanEnvironment(t);
  for (const credential of [{ apiKey: 'fixture-key' }, { xApiKey: 'fixture-key' }]) {
    await assert.rejects(options({ browserToken: 'fixture-browser-token', ...credential }), /not both/);
  }
  for (const key of ['DEDALUS_API_KEY', 'DEDALUS_X_API_KEY']) {
    process.env[key] = 'fixture-key';
    await assert.rejects(options({ browserToken: 'fixture-browser-token' }), /not both/);
    delete process.env[key];
  }
  await assert.rejects(options({ browserToken: 'fixture-browser-token' }, 'staging'), /production environment/);
  assert.equal((await options({ browserToken: 'fixture-browser-token' }, 'production')).baseURL,
    'https://dcs.dedaluslabs.ai');
});
