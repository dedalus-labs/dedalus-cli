import { chmod, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RELATIVE_SPECIFIER_RE = /(from\s+["']|import\(\s*["'])(\.{1,2}\/[^"']+)(["'])/g;

await Promise.all([
  rewriteRelativeSpecifiers(resolve(root, 'dist/esm')),
  markCommonJsOutput(resolve(root, 'dist/cjs')),
]);
await chmod(resolve(root, 'dist/esm/bin.js'), 0o755).catch(() => {});

async function rewriteRelativeSpecifiers(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return;
    throw error;
  }

  await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        await rewriteRelativeSpecifiers(path);
        return;
      }
      if (!path.endsWith('.js') && !path.endsWith('.d.ts')) return;
      const source = await readFile(path, 'utf8');
      await writeFile(path, source.replace(RELATIVE_SPECIFIER_RE, addJsExtension), 'utf8');
    }),
  );
}

async function markCommonJsOutput(dir) {
  try {
    await readdir(dir);
    await writeFile(resolve(dir, 'package.json'), '{\n  "type": "commonjs"\n}\n', 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return;
    throw error;
  }
}

function addJsExtension(match, prefix, specifier, suffix) {
  if (extname(specifier)) return match;
  return `${prefix}${specifier}.js${suffix}`;
}
