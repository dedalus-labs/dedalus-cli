import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root = resolve(process.env.CLI_PACKAGE_ROOT ?? '.');
const { getProgram } = await import(pathToFileURL(join(root, 'dist/esm/index.js')));

const id = '01994a10-1234-7000-8000-000000000001';
test('public import help describes automatic waiting and its opt-out', () => {
  const result = spawnSync(process.execPath, [join(root, 'dist/esm/bin.js'), 'images', 'import', '--help'], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--no-wait/);
  assert.match(result.stdout, /--wait-timeout/);
  assert.match(result.stdout, /--platform/);
});

test('CLI default waits, no-wait skips GET, and terminal failures exit nonzero', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'image-command-'));
  const archive = join(dir, 'image.tar'),
    bytes = Buffer.from('fixture archive');
  await writeFile(archive, bytes);
  const originalFetch = globalThis.fetch,
    out = process.stdout.write,
    err = process.stderr.write;
  try {
    for (const [flags, finalState] of [
      [[], 'ready'],
      [['--no-wait'], 'submitted'],
      [[], 'failed'],
    ]) {
      let stdout = '',
        stderr = '',
        gets = 0;
      process.stdout.write = (value) => {
        stdout += value;
        return true;
      };
      process.stderr.write = (value) => {
        stderr += value;
        return true;
      };
      globalThis.fetch = async (url, options) => {
        const path = new URL(url).pathname;
        let body;
        if (new URL(url).hostname === 'storage.example') {
          assert.equal(new Headers(options.headers).has('authorization'), false);
          for await (const _ of options.body) {
          }
          return new Response(null, { status: 200 });
        }
        if (path.endsWith('/uploads')) {
          const digest = createHash('sha256').update(bytes).digest();
          body = {
            source: { kind: 'docker_archive', upload_id: id, sha256: digest.toString('hex') },
            upload: {
              method: 'PUT',
              url: 'https://storage.example/object',
              expires_at: '2099-01-01T00:00:00Z',
              headers: {
                'content-length': [String(bytes.length)],
                'if-none-match': ['*'],
                'x-amz-checksum-sha256': [digest.toString('base64')],
              },
            },
          };
        } else if (options.method === 'POST') body = { image_id: id, state: 'submitted' };
        else {
          gets++;
          body = { image_id: id, state: finalState };
        }
        return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
      };
      await getProgram().parseAsync(['images', 'import', archive, '--api-key', 'fixture', ...flags], {
        from: 'user',
      });
      if (finalState === 'failed') {
        assert.notEqual(process.exitCode, undefined);
        assert.match(stderr, /failed/);
        assert.equal(stdout, '');
      } else {
        assert.equal(JSON.parse(stdout).state, finalState);
        assert.equal(gets, finalState === 'ready' ? 1 : 0);
        assert.match(stderr, /submitted/);
      }
      assert.equal(process.listenerCount('SIGINT'), 0);
      process.exitCode = undefined;
    }
  } finally {
    globalThis.fetch = originalFetch;
    process.stdout.write = out;
    process.stderr.write = err;
    process.exitCode = undefined;
    await rm(dir, { recursive: true });
  }
});

test('machines create exposes --image-id and sends it unchanged', async () => {
  const originalFetch = globalThis.fetch,
    out = process.stdout.write;
  let sent;
  try {
    process.stdout.write = () => true;
    globalThis.fetch = async (url, options) => {
      sent = [new URL(url).pathname, options.method, JSON.parse(options.body)];
      return Response.json({ machine_id: 'fixture' });
    };
    await getProgram().parseAsync(['machines', 'create', '--image-id', id, '--api-key', 'fixture'], {
      from: 'user',
    });
    assert.deepEqual(sent, ['/v1/machines', 'POST', { image_id: id }]);
  } finally {
    globalThis.fetch = originalFetch;
    process.stdout.write = out;
  }
});
