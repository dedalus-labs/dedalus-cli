// @custom start
// Exercise the distributable package, including its runtime dependencies and public defaults.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const run = (file, args, options = {}) =>
  execFileSync(file, args, { cwd: root, encoding: 'utf8', ...options });
const base = run(process.execPath, ['dist/esm/bin.js', '--version']).trim();
const build = process.env.GITHUB_RUN_NUMBER ?? String(Date.now());
const attempt = process.env.GITHUB_RUN_ATTEMPT ?? '1';
const version = `${base}-preview.ci.${build}.${attempt}`;
const record = JSON.parse(run(process.execPath, ['scripts/package-preview.mjs', version]));
const directory = mkdtempSync(join(tmpdir(), 'dedalus-installed-package-'));
try {
  const unpacked = join(directory, 'unpacked');
  mkdirSync(unpacked);
  run('tar', ['-xzf', record.path, '-C', unpacked]);
  run(process.execPath, ['--import', 'tsx', 'scripts/check-public.ts', unpacked]);
  writeFileSync(join(directory, 'package.json'), '{"private":true}\n');
  run('pnpm', ['add', '--ignore-scripts', record.path], { cwd: directory, stdio: 'inherit' });
  const installed = join(directory, 'node_modules/dedalus-cli');
  const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
  assert.equal(manifest.private, true);
  assert.equal(manifest.version, version);
  const binary = resolve(installed, manifest.bin.dedalus);
  const cleanEnv = { PATH: process.env.PATH, HOME: directory, USERPROFILE: directory };
  assert.equal(run(process.execPath, [binary, '--version'], { env: cleanEnv }).trim(), version);
  const doctor = JSON.parse(run(process.execPath, [binary, 'doctor', '--json'], { env: cleanEnv }));
  assert.equal(doctor.api_origin, 'https://dcs.dedaluslabs.ai');
  const sdkModule = JSON.stringify(pathToFileURL(join(installed, 'dist/esm/sdk/index.js')).href);
  const sdkOrigin = run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import SDK from ${sdkModule}; process.stdout.write(new SDK({apiKey:'test-key'}).baseURL);`,
    ],
    { env: cleanEnv },
  );
  assert.equal(sdkOrigin, 'https://dcs.dedaluslabs.ai');
  run(
    process.execPath,
    [
      '--test',
      ...readdirSync('tests')
        .filter((name) => /^feedback-.*\.test\.mjs$/.test(name))
        .map((name) => join('tests', name)),
    ],
    {
      env: { ...process.env, ...cleanEnv, FEEDBACK_PACKAGE_ROOT: installed },
      stdio: 'inherit',
    },
  );
  process.stdout.write(`Verified ${record.filename}\nSHA256 ${record.sha256}\n`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
// @custom end
