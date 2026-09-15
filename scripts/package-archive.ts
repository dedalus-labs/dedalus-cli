// @custom start
/** Create and inspect one pnpm archive without running package lifecycle hooks. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { artifactFiles, scanPublicFiles } from "./check-public.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANAGER_SCHEMA = z.object({ packageManager: z.string().regex(/^pnpm@\d+\.\d+\.\d+$/u) });
const PACK_REPORT_SCHEMA = z.object({
	name: z.string().min(1),
	version: z.string().min(1),
	filename: z.string().min(1),
	files: z.array(z.object({ path: z.string().min(1) })).min(1),
});
const PACKED_MANIFEST_SCHEMA = z.object({
	name: z.string().min(1),
	version: z.string().min(1),
	private: z.boolean().optional(),
	bin: z.object({ dedalus: z.string().min(1) }),
});

/** Archive bytes and inventory returned by the pinned package manager. */
export type PackageArchive = {
	readonly path: string;
	readonly filename: string;
	readonly name: string;
	readonly version: string;
	readonly files: readonly string[];
	readonly sha256: string;
};

/** Require the package.json pin before invoking the single packaging implementation. */
export function runPnpm(args: readonly string[], cwd: string): string {
	const manifest = MANAGER_SCHEMA.parse(
		JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")),
	);
	const expected = manifest.packageManager.slice("pnpm@".length);
	const actual = execFileSync("pnpm", ["--version"], { cwd: ROOT, encoding: "utf8" }).trim();
	if (actual !== expected)
		throw new Error(`Packaging requires pnpm ${expected}, received ${actual}`);
	return execFileSync("pnpm", args, { cwd, encoding: "utf8", stdio: "pipe" });
}

/** Pack the supplied project once, preserving pnpm's actual file inventory. */
export function packArchive(project: string, destination: string): PackageArchive {
	mkdirSync(destination, { recursive: true });
	const report = PACK_REPORT_SCHEMA.parse(
		JSON.parse(
			runPnpm(
				[
					"pack",
					"--config.ignore-scripts=true",
					"--json",
					"--pack-destination",
					resolve(destination),
				],
				project,
			),
		),
	);
	const path = resolve(project, report.filename);
	if (dirname(path) !== resolve(destination))
		throw new Error("Archive was written outside its output directory");
	return {
		path,
		filename: basename(path),
		name: report.name,
		version: report.version,
		files: report.files.map((file) => file.path),
		sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
	};
}

/** Inspect extracted bytes and return only the package identity needed by callers. */
export function inspectArchive(archive: PackageArchive): z.infer<typeof PACKED_MANIFEST_SCHEMA> {
	const directory = mkdtempSync(join(tmpdir(), "cli-archive-check-"));
	try {
		execFileSync("tar", ["-xzf", archive.path, "-C", directory]);
		const root = join(directory, "package");
		const errors = scanPublicFiles(artifactFiles(root));
		if (errors.length > 0) throw new Error(errors.join("\n"));
		return PACKED_MANIFEST_SCHEMA.parse(
			JSON.parse(readFileSync(join(root, "package.json"), "utf8")),
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}
// @custom end
