import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { Command } from 'commander';

const root = process.env.CLI_PACKAGE_ROOT ?? new URL('..', import.meta.url).pathname;
const { addUpgradeCommands } = await import(pathToFileURL(join(root, 'dist/esm/cli/upgrade.js')));

test('invariant_homebrew_owns_upgrades_of_its_node_package_installation', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'dedalus-homebrew-node-'));
  const bin = join(directory, 'bin');
  const script = join(directory, 'Cellar/dedalus/0.9.2/libexec/node_modules/dedalus-cli/dist/esm/bin.js');
  mkdirSync(bin);
  const log = join(directory, 'commands');
  const brew = join(bin, 'brew');
  writeFileSync(brew, `#!${process.execPath}
const fs = require('node:fs');
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)) + '\\n');
if (process.argv[2] === 'list') console.log('dedalus 0.9.3');
`);
  chmodSync(brew, 0o755);
  const original = process.argv[1];
  process.argv[1] = script;
  t.after(() => { process.argv[1] = original; rmSync(directory, { recursive: true, force: true }); });
  const program = new Command();
  addUpgradeCommands(program, 'dedalus', '0.9.2');
  await program.parseAsync(['node', 'dedalus', 'upgrade']);
  assert.deepEqual(readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse), [
    ['update'], ['upgrade', 'dedalus'], ['list', '--versions', 'dedalus'],
  ]);
});

for (const [location, manager] of [['prefix', 'npm'], ['node-keg', 'npm'], ['pnpm-global', 'pnpm']]) {
  test(`invariant_package_managers_keep_ownership_under_homebrews_prefix (${location})`, async (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'dedalus-package-ownership-'));
    const prefix = join(directory, 'opt/homebrew');
    const bin = join(prefix, 'bin');
    const packageRoot = location === 'node-keg'
      ? join(prefix, 'Cellar/node/24.0.0/lib/node_modules')
      : location === 'pnpm-global'
        ? join(prefix, 'pnpm/global/5/node_modules')
        : join(prefix, 'lib/node_modules');
    const script = join(packageRoot, 'dedalus-cli/dist/esm/bin.js');
    const log = join(directory, 'commands');
    mkdirSync(bin, { recursive: true });
    for (const name of ['npm', 'pnpm', 'brew']) {
      const executable = join(bin, name);
      writeFileSync(executable, `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify([${JSON.stringify(name)}, ...args]) + '\\n');
if (args[0] === 'root') console.log(${JSON.stringify(packageRoot)});
if (args[0] === 'list') console.log('dedalus 0.9.3');
`);
      chmodSync(executable, 0o755);
    }
    const original = { script: process.argv[1], executable: process.execPath, path: process.env.PATH, stderr: process.stderr.write };
    let output = '';
    t.after(() => {
      process.argv[1] = original.script;
      process.execPath = original.executable;
      process.env.PATH = original.path;
      process.stderr.write = original.stderr;
      rmSync(directory, { recursive: true, force: true });
    });
    process.argv[1] = script;
    process.execPath = join(bin, 'node');
    process.env.PATH = `${bin}${delimiter}${original.path}`;
    process.stderr.write = (chunk) => { output += String(chunk); return true; };
    for (const command of ['upgrade', 'uninstall']) {
      const program = new Command();
      addUpgradeCommands(program, 'dedalus', '0.9.2');
      await program.parseAsync(['node', 'dedalus', command]);
    }
    assert.match(output, new RegExp(`installed with ${manager}`));
    assert.doesNotMatch(output, /installed with Homebrew|brew uninstall|brew upgrade/);
    assert.ok(output.includes(manager === 'npm' ? 'npm uninstall -g dedalus-cli' : 'pnpm remove -g dedalus-cli'));
    const commands = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse) : [];
    assert.deepEqual(commands, manager === 'npm' ? [
      ['npm', 'root', '-g'], ['npm', 'i', '-g', 'dedalus-cli@latest'], ['npm', 'root', '-g'],
    ] : [['pnpm', 'add', '-g', 'dedalus-cli@latest']]);
  });
}
