// @custom start
// Build first, then package an isolated, non-publishable CLI for preview validation.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+-preview\.[a-zA-Z0-9.-]+$/.test(version)) {
  throw new Error('usage: node scripts/package-preview.mjs X.Y.Z-preview.ID [output-directory]');
}
const output = resolve(process.argv[3] ?? join(root, 'artifacts'));
const staging = mkdtempSync(join(tmpdir(), 'dedalus-preview-package-'));
mkdirSync(output, { recursive: true });

const patchBuild = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      patchBuild(path);
      continue;
    }
    if (!/\.(js|map)$/.test(entry.name)) continue;
    const source = readFileSync(path, 'utf8');
    const staged = source.replace(
      /(['"])[0-9]+\.[0-9]+\.[0-9]+\1(?=;?,?\s*\/\/ x-release-please-version)/g,
      (_, quote) => quote + version + quote,
    );
    writeFileSync(path, staged);
  }
};

try {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  for (const name of ['dist', 'api.md', 'man', 'SKILL.md', 'README.md', 'LICENSE']) {
    const source = join(root, name);
    if (existsSync(source)) cpSync(source, join(staging, name), { recursive: true });
  }
  if (!existsSync(join(staging, 'dist/esm/bin.js')))
    throw new Error('build the CLI before packaging');
  patchBuild(join(staging, 'dist'));
  manifest.version = version;
  manifest.private = true;
  delete manifest.scripts;
  delete manifest.devDependencies;
  writeFileSync(join(staging, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  execFileSync('pnpm', ['pack', '--pack-destination', output], { cwd: staging, stdio: 'pipe' });
  const filename = manifest.name.replace('@', '').replace('/', '-') + '-' + version + '.tgz';
  const path = join(output, filename);
  const bytes = readFileSync(path);
  const record = {
    filename,
    version,
    private: true,
    default_api: 'https://dcs.dedaluslabs.ai',
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  writeFileSync(path + '.json', JSON.stringify(record, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ path, ...record }, null, 2) + '\n');
} finally {
  rmSync(staging, { recursive: true, force: true });
}
// @custom end
