import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const installer = new URL('../scripts/install.sh', import.meta.url);

function fixture(t, { failure = '', version = 'v0.9.2', legacy = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'dedalus-pnpm-installer-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'tools');
  const destination = join(root, 'custom bin');
  const globalBin = join(root, "pnpm's bin");
  for (const path of [bin, destination, globalBin]) mkdirSync(path);
  writeFileSync(join(destination, 'dedalus'), 'old executable');
  const executable = (path, content) => {
    writeFileSync(path, content);
    chmodSync(path, 0o755);
  };
  if (failure === 'old-node') executable(join(bin, 'node'), '#!/bin/sh\nexit 1\n');
  else if (failure !== 'missing-node') symlinkSync(process.execPath, join(bin, 'node'));
  if (failure !== 'missing-pnpm') executable(join(bin, 'pnpm'), `#!${process.execPath}
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.INSTALL_TEST_LOG, JSON.stringify(args) + '\\n');
if (args[0] === 'bin') {
  assert.deepEqual(args, ['bin', '--global']);
  if (process.env.INSTALL_TEST_FAILURE === 'unconfigured') process.exit(1);
  console.log(process.env.INSTALL_TEST_GLOBAL_BIN);
} else {
  assert.deepEqual(args.slice(0, 3), ['add', '--global', '--ignore-scripts']);
  if (process.env.INSTALL_TEST_FAILURE === 'install') process.exit(1);
  const binary = path.join(process.env.INSTALL_TEST_GLOBAL_BIN, 'dedalus');
  const version = process.env.INSTALL_TEST_FAILURE === 'wrong-version' ? '9.9.9' : '0.9.2';
  fs.writeFileSync(binary, '#!/bin/sh\\nif [ "$1" = --version ]; then echo ' + version + '; else printf "%s\\\\n" "$@"; fi\\n');
  fs.chmodSync(binary, 0o755);
}
`);
  const log = join(root, 'commands');
  const env = {
    ...process.env,
    PATH: ['missing-node', 'missing-pnpm'].includes(failure) ? bin : `${bin}:${process.env.PATH}`,
    DEDALUS_VERSION: version,
    INSTALL_TEST_LOG: log,
    INSTALL_TEST_GLOBAL_BIN: globalBin,
    INSTALL_TEST_FAILURE: failure,
  };
  delete env.DEDALUS_INSTALL_DIR;
  if (legacy) env.DEDALUS_INSTALL_DIR = destination;
  return {
    destination, globalBin,
    run: () => spawnSync('/bin/bash', ['-c', '/bin/bash < "$1"', 'installer-test', installer.pathname], {
      env, encoding: 'utf8', timeout: 20000,
    }),
    commands: () => existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse) : [],
  };
}

test('invariant_installer_delegates_the_pinned_version_to_pnpm_and_preserves_legacy_command_paths', (t) => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(f.commands(), [['bin', '--global'], ['add', '--global', '--ignore-scripts', 'dedalus-cli@0.9.2']]);
  assert.equal(spawnSync(join(f.destination, 'dedalus'), ['--version'], { encoding: 'utf8' }).stdout.trim(), '0.9.2');
  assert.equal(spawnSync(join(f.destination, 'dedalus'), ['two words', '$literal'], { encoding: 'utf8' }).stdout, 'two words\n$literal\n');
  assert.deepEqual(readdirSync(f.destination), ['dedalus']);
});

test('invariant_new_installs_use_the_pnpm_global_command', (t) => {
  const f = fixture(t, { version: '', legacy: false });
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(f.commands()[1], ['add', '--global', '--ignore-scripts', 'dedalus-cli@latest']);
  assert.equal(readFileSync(join(f.destination, 'dedalus'), 'utf8'), 'old executable');
});

for (const failure of ['missing-node', 'old-node', 'missing-pnpm', 'unconfigured', 'install', 'wrong-version']) {
  test(`invariant_failed_install_preserves_the_legacy_executable (${failure})`, (t) => {
    const f = fixture(t, { failure });
    const result = f.run();
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(join(f.destination, 'dedalus'), 'utf8'), 'old executable');
    assert.deepEqual(readdirSync(f.destination), ['dedalus']);
    assert.doesNotMatch(result.stdout, /Installed dedalus/);
    if (failure === 'missing-node' || failure === 'old-node') assert.match(result.stderr, /Node.js 20/);
    if (failure === 'missing-pnpm') assert.match(result.stderr, /pnpm is required/);
    if (failure === 'unconfigured') assert.match(result.stderr, /pnpm setup/);
  });
}

test('invariant_installer_rejects_invalid_versions_before_running_pnpm', (t) => {
  const f = fixture(t, { version: '../../latest' });
  assert.notEqual(f.run().status, 0);
  assert.deepEqual(f.commands(), []);
});

test('invariant_installer_does_not_replace_another_package_managers_symlink', (t) => {
  const f = fixture(t);
  const managed = join(f.destination, 'managed');
  writeFileSync(managed, 'managed executable');
  rmSync(join(f.destination, 'dedalus'));
  symlinkSync(managed, join(f.destination, 'dedalus'));
  assert.notEqual(f.run().status, 0);
  assert.deepEqual(f.commands(), []);
  assert.equal(readFileSync(managed, 'utf8'), 'managed executable');
});
