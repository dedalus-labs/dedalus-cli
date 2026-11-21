import { execFileSync } from 'node:child_process';
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
