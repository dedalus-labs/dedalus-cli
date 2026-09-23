import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
const { default: SDK } = await import(pathToFileURL(join(resolve(process.env.FEEDBACK_PACKAGE_ROOT ?? '.'), 'dist/esm/sdk/index.js')));
test('invariant automatic retries preserve a valid feedback identity', async () => {
  const keys = [];
  const uuid7 = /^[0-9a-f]{12}7[0-9a-f]{3}[89ab][0-9a-f]{15}$/;
  const client = new SDK({ baseURL: 'https://feedback.invalid', apiKey: 'fixture-key', maxRetries: 1, logLevel: 'off',
    fetch: async (_url, options) => {
      const key = new Headers(options.headers).get('Idempotency-Key');
      keys.push(key);
      assert.match(key, uuid7, 'automatic feedback key must match the API contract');
      if (keys.length === 1) return Response.json({}, {status: 503, headers: {'retry-after-ms': '1'}});
      return Response.json({id: 'fb_' + key}, {status: 201});
    },
  });
  await client.post('/v1/feedback', {body: {message: 'fixture', source: 'cli'}});
  await client.post('/v1/feedback', {body: {message: 'new submission', source: 'cli'}});
  assert.equal(keys.length, 3);
  assert.equal(keys[0], keys[1], 'automatic retry must preserve identity');
  assert.notEqual(keys[1], keys[2], 'new submission must receive its own identity');
});
