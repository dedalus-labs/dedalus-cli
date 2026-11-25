import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'dedalus-standalone-'));
try {
  const binary = join(directory, process.platform === 'win32' ? 'dedalus.exe' : 'dedalus');
  execFileSync('bun', ['build', 'src/bin.ts', '--compile', '--minify', '--outfile', binary], { stdio: 'inherit' });
  if (process.platform === 'darwin') {
    execFileSync('codesign', ['--verify', '--strict', '--verbose=2', binary], { stdio: 'inherit' });
  }
  const output = execFileSync(binary, ['doctor', '--json'], {
    env: { PATH: process.env.PATH, HOME: directory, USERPROFILE: directory }, encoding: 'utf8',
  });
  assert.equal(JSON.parse(output).install_method, 'standalone');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
