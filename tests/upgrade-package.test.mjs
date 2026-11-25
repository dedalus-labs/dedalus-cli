import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
