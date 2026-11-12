import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const installer = new URL('../scripts/install.sh', import.meta.url);

function fixture(t, { os = 'Darwin', arch = 'arm64', failure = '', version = 'v0.7.0' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'dedalus-installer-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'tools');
  const destination = join(root, 'custom bin');
  const payload = join(root, 'payload');
  for (const path of [bin, destination, payload]) mkdirSync(path);
  writeFileSync(join(destination, 'dedalus'), 'old executable');
  const executable = (path, content) => {
    writeFileSync(path, content);
    chmodSync(path, 0o755);
  };
  executable(join(payload, 'dedalus'), failure === 'timeout'
    ? '#!/bin/sh\nwhile :; do :; done\n'
    : failure === 'cannot-run'
    ? '#!/bin/sh\nexit 126\n'
    : `#!/bin/sh\nprintf '%s\\n' '${failure === 'wrong-version' ? '9.9.9' : '0.7.0'}'\n`);
  const archive = join(root, 'archive.tar.gz');
  if (failure === 'missing-binary') rmSync(join(payload, 'dedalus'));
  const packed = spawnSync('tar', ['-czf', archive, '-C', payload, failure === 'missing-binary' ? '.' : 'dedalus']);
  assert.equal(packed.status, 0);
  if (failure === 'corrupt') writeFileSync(archive, 'not an archive');
  executable(join(bin, 'uname'), `#!/bin/sh\ncase "$1" in -s) echo '${os}';; -m) echo '${arch}';; esac\n`);
  executable(join(bin, 'curl'), `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const url = args.find(arg => arg.startsWith('https://'));
fs.appendFileSync(process.env.INSTALL_TEST_LOG, url + '\\n');
if (process.env.INSTALL_TEST_FAILURE === 'download') process.exit(22);
if (url.endsWith('/releases/latest')) {
  console.log('https://github.com/dedalus-labs/dedalus-cli/releases/tag/v0.7.0');
} else {
  fs.copyFileSync(process.env.INSTALL_TEST_ARCHIVE, args[args.indexOf('-o') + 1]);
}
`);
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    DEDALUS_INSTALL_DIR: destination,
    DEDALUS_VERSION: version,
    INSTALL_TEST_LOG: join(root, 'requests'),
    INSTALL_TEST_ARCHIVE: archive,
    INSTALL_TEST_FAILURE: failure,
  };
  return {
    destination,
    run: () => spawnSync('bash', ['-c', 'bash < "$1"', 'installer-test', installer.pathname], { env, encoding: 'utf8', timeout: 20000 }),
    requests: () => readFileSync(env.INSTALL_TEST_LOG, 'utf8'),
  };
}

for (const [os, arch, target] of [
  ['Darwin', 'arm64', 'darwin-arm64'],
  ['Darwin', 'x86_64', 'darwin-x64'],
  ['Linux', 'aarch64', 'linux-arm64'],
  ['Linux', 'x86_64', 'linux-x64'],
]) {
  test(`legacy installer replaces the pinned ${target} executable in its original directory`, t => {
    const f = fixture(t, { os, arch });
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(f.requests(), `https://github.com/dedalus-labs/dedalus-cli/releases/download/v0.7.0/dedalus-${target}.tar.gz\n`);
    assert.equal(spawnSync(join(f.destination, 'dedalus'), ['--version'], { encoding: 'utf8' }).stdout.trim(), '0.7.0');
    assert.deepEqual(readdirSync(f.destination), ['dedalus']);
  });
}

for (const failure of ['download', 'corrupt', 'missing-binary', 'cannot-run', 'wrong-version', 'timeout']) {
  test(`legacy installer preserves the working binary after ${failure} failure`, t => {
    const f = fixture(t, { failure });
    const result = f.run();
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(join(f.destination, 'dedalus'), 'utf8'), 'old executable');
    assert.deepEqual(readdirSync(f.destination), ['dedalus']);
    assert.doesNotMatch(result.stdout, /Installed/);
  });
}

test('an unpinned install resolves latest before choosing its archive', t => {
  const f = fixture(t, { version: '' });
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(f.requests(), /releases\/latest\n.*\/v0\.7\.0\/dedalus-darwin-arm64.tar.gz\n/);
});

test('an unsupported platform fails without replacing the executable', t => {
  const f = fixture(t, { os: 'FreeBSD' });
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(join(f.destination, 'dedalus'), 'utf8'), 'old executable');
});

test('installer refuses a package-manager symlink', t => {
  const f = fixture(t);
  const managed = join(f.destination, 'managed');
  writeFileSync(managed, 'managed executable');
  rmSync(join(f.destination, 'dedalus'));
  symlinkSync(managed, join(f.destination, 'dedalus'));
  assert.notEqual(f.run().status, 0);
  assert.equal(readFileSync(managed, 'utf8'), 'managed executable');
});

test('installer rejects invalid release tags before downloading', t => {
  const f = fixture(t, { version: '../../latest' });
  assert.notEqual(f.run().status, 0);
  assert.throws(f.requests, { code: 'ENOENT' });
});
