import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root = resolve(process.env.CLI_PACKAGE_ROOT ?? '.');
const { default: Dedalus } = await import(pathToFileURL(join(root, 'dist/esm/sdk/index.js')));
const { importImage, pollImage } = await import(pathToFileURL(join(root, 'dist/esm/sdk/helpers/images.js')));

const id = '01994a10-1234-7000-8000-000000000001';
const bytes = Buffer.from('fixture docker-save archive');
const digest = createHash('sha256').update(bytes).digest('hex');
const image = (state) => ({ image_id: id, state });
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
function fixture(states = ['ready'], mutate = () => {}, retryReservation = false) {
  const requests = [],
    uploads = [],
    keys = [];
  const grant = {
    source: { kind: 'docker_archive', upload_id: id, sha256: digest },
    upload: {
      url: 'https://storage.example/image?signature=secret',
      method: 'PUT',
      expires_at: '2099-01-01T00:00:00Z',
      headers: {
        'content-length': [String(bytes.length)],
        'if-none-match': ['*'],
        'x-amz-checksum-sha256': [Buffer.from(digest, 'hex').toString('base64')],
      },
    },
  };
  mutate(grant);
  const client = new Dedalus({
    apiKey: 'fixture-api-secret',
    baseURL: 'https://api.example',
    maxRetries: 1,
    fetch: async (url, options) => {
      requests.push(new URL(url).pathname);
      assert.match(new Headers(options.headers).get('authorization'), /fixture-api-secret/);
      if (options.method === 'POST') keys.push(new Headers(options.headers).get('idempotency-key'));
      if (new URL(url).pathname.endsWith('/uploads')) {
        if (retryReservation && keys.length === 1)
          return new Response('{}', { status: 503, headers: { 'retry-after-ms': '1' } });
        return json(grant);
      }
      if (options.method === 'POST') return json(image('submitted'), 202);
      return json(image(states.shift() ?? 'ready'));
    },
  });
  const uploadFetch = async (url, options) => {
    uploads.push(String(url));
    assert.equal(options.redirect, 'error');
    assert.equal(new Headers(options.headers).has('authorization'), false);
    const chunks = [];
    for await (const chunk of options.body) chunks.push(chunk);
    assert.deepEqual(Buffer.concat(chunks), bytes);
    return new Response(null, { status: 200 });
  };
  return { client, requests, uploads, keys, uploadFetch };
}
async function archive(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'image-import-'));
  const path = join(dir, 'image.tar');
  await writeFile(path, bytes);
  try {
    return await fn(path);
  } finally {
    await rm(dir, { recursive: true });
  }
}
test('import waits by default, streams once, preserves retry identity and reports progress', () =>
  archive(async (path) => {
    const f = fixture(['preparing', 'ready'], () => {}, true),
      progress = [];
    const result = await importImage(f.client, path, {
      uploadFetch: f.uploadFetch,
      pollIntervalMs: 1,
      onProgress: (value) => progress.push(value.state),
    });
    assert.equal(result.state, 'ready');
    assert.deepEqual(progress, ['submitted', 'preparing', 'ready']);
    assert.equal(f.uploads.length, 1);
    assert.equal(f.keys.length, 3);
    assert.ok(f.keys[0]);
    assert.ok(f.keys.every((key) => key === f.keys[0]));
  }));
test('no-wait returns the accepted image without a status request', () =>
  archive(async (path) => {
    const f = fixture();
    assert.equal(
      (await importImage(f.client, path, { wait: false, uploadFetch: f.uploadFetch })).state,
      'submitted',
    );
    assert.deepEqual(f.requests, ['/v1/images/uploads', '/v1/images']);
  }));
test('unsafe upload grants fail before storage or registration', async () => {
  for (const change of [
    (g) => (g.upload.url = 'http://storage.example/x'),
    (g) => (g.upload.method = 'POST'),
    (g) => (g.upload.expires_at = 'invalid'),
    (g) => (g.source.sha256 = 'wrong'),
    (g) => (g.upload.headers.authorization = ['secret']),
    (g) => (g.upload.headers['content-length'] = ['1']),
  ]) {
    await archive(async (path) => {
      const f = fixture([], change);
      await assert.rejects(
        importImage(f.client, path, { uploadFetch: f.uploadFetch }),
        /Invalid image upload/,
      );
      assert.equal(f.uploads.length, 0);
      assert.equal(f.requests.length, 1);
    });
  }
});
test('terminal failures identify the image and never become success', async () => {
  for (const state of ['failed', 'rejected', 'revoked']) {
    const f = fixture([state]);
    await assert.rejects(
      pollImage(f.client, id),
      (error) => error.image.image_id === id && error.message.includes(state),
    );
  }
});
test('unknown states keep polling; wrong IDs fail closed', async () => {
  const f = fixture(['future-state', 'ready']);
  assert.equal((await pollImage(f.client, id, { pollIntervalMs: 1 })).state, 'ready');
  const client = new Dedalus({
    apiKey: 'fixture',
    fetch: async () => json({ image_id: 'wrong', state: 'ready' }),
  });
  await assert.rejects(pollImage(client, id), /mismatched/);
});
test('deadline and caller cancellation stop polling without deleting the image', async () => {
  const f = fixture(Array(100).fill('preparing'));
  await assert.rejects(
    pollImage(f.client, id, { timeoutMs: 15, pollIntervalMs: 5 }),
    /Preparation continues/,
  );
  assert.ok(f.requests.every((path) => path === `/v1/images/${id}`));
  const controller = new AbortController();
  controller.abort(new Error('cancelled'));
  const before = f.requests.length;
  await assert.rejects(pollImage(f.client, id, { signal: controller.signal }), /cancelled/);
  assert.equal(f.requests.length, before);
});
test('failed uploads never register an image; a repeated immutable PUT can proceed', () =>
  archive(async (path) => {
    for (const status of [500, 412]) {
      const f = fixture();
      const result = importImage(f.client, path, {
        wait: false,
        uploadFetch: async (_url, options) => {
          for await (const _ of options.body) {
          }
          return new Response(null, { status });
        },
      });
      if (status === 500) {
        await assert.rejects(result, /HTTP 500/);
        assert.equal(f.requests.length, 1);
      } else assert.equal((await result).state, 'submitted');
    }
  }));
