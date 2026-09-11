// @custom start
/** Scan the actual pnpm archive, including emitted maps and declarations. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { inspectArchive, packArchive } from "./package-archive.js";

const REQUIRED_FILES = [
	"dist/cjs/index.js",
	"dist/esm/bin.js",
	"dist/esm/index.d.ts",
	"dist/esm/index.js",
];
const directory = mkdtempSync(join(tmpdir(), "cli-package-check-"));
try {
	const archive = packArchive(process.cwd(), directory);
	const missing = REQUIRED_FILES.filter((path) => !archive.files.includes(path));
	if (missing.length > 0) throw new Error(`Package missing runtime files: ${missing.join(", ")}`);
	inspectArchive(archive);
	process.stdout.write(`Package checked: ${archive.files.length} files\n`);
} finally {
	rmSync(directory, { recursive: true, force: true });
}
// @custom end
