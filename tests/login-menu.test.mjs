import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

test('login shows two interactive choices and preserves explicit flows', {
  skip: process.platform === 'win32' && 'requires a POSIX pseudo-terminal',
}, () => {
  const cli = resolve(process.env.CLI_PACKAGE_ROOT ?? '.', 'dist/esm/bin.js');
  execFileSync('python3', [fileURLToPath(new URL('./fixtures/login-menu.py', import.meta.url)), process.execPath, cli],
    { timeout: 30000 });
});

test('login help and invalid-flow errors advertise only the two public choices', () => {
  const cli = resolve(process.env.CLI_PACKAGE_ROOT ?? '.', 'dist/esm/bin.js');
  const help = execFileSync(process.execPath, [cli, 'login', '--help'], { encoding: 'utf8' });
  assert.match(help, /Sign-in flows:\s+oauth-browser  Sign in with a browser\s+api-key  Use an API key\s*$/);
  assert.doesNotMatch(help, /x-api-key/);
  const bad = spawnSync(process.execPath, [cli, 'login', '--flow', 'unknown'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /Available: oauth-browser, api-key\./);
  assert.doesNotMatch(bad.stderr, /x-api-key/);
});
