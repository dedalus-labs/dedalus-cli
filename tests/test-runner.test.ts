// @custom start
/** Test discovery and packaged JavaScript use their intended Node loaders. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
// Each probe is an independent CLI invocation, outside this runner's IPC protocol.
const RUNNER_ENVIRONMENT = { ...process.env };
delete RUNNER_ENVIRONMENT["NODE_TEST_CONTEXT"];

const fixture = async (context: TestContext): Promise<string> => {
	const directory = await mkdtemp(join(tmpdir(), "cli-runner-test-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	await mkdir(join(directory, "tests", "nested"), { recursive: true });
	await writeFile(join(directory, "package.json"), JSON.stringify({ type: "module" }));
	await symlink(join(ROOT, "node_modules"), join(directory, "node_modules"), "junction");
	return directory;
};

test("invariant_runner_discovers_nested_typescript_suites", async (context) => {
	const directory = await fixture(context);
	await writeFile(
		join(directory, "tests", "nested", "probe.test.ts"),
		`
		import test from "node:test";
		const value: number = 1;
		test("nested-typescript-probe", () => {
			if (value !== 1) throw new Error("typed fixture");
			if (process.env.HOME === ${JSON.stringify(RUNNER_ENVIRONMENT["HOME"])}) throw new Error("shared home");
			if (process.env.USERPROFILE !== process.env.HOME) throw new Error("split home");
		});
	`,
	);
	const result = spawnSync(
		process.execPath,
		["--import", "tsx", join(ROOT, "scripts/run-tests.ts")],
		{
			cwd: directory,
			encoding: "utf8",
			env: RUNNER_ENVIRONMENT,
		},
	);
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /nested-typescript-probe/u);
});

test("invariant_packaged_javascript_cannot_use_typescript_resolution", async (context) => {
	const directory = await fixture(context);
	await writeFile(join(directory, "tests", "available.js"), "export const value = 1;");
	await writeFile(
		join(directory, "tests", "probe.test.mjs"),
		`
		import test from "node:test";
		import { value } from "./available";
		test("packaged-js-probe", () => { if (value !== 1) throw new Error("JS fixture"); });
	`,
	);
	const result = spawnSync(
		process.execPath,
		["--import", "tsx", join(ROOT, "scripts/run-tests.ts")],
		{
			cwd: directory,
			encoding: "utf8",
			env: RUNNER_ENVIRONMENT,
		},
	);
	assert.notEqual(result.status, 0, "native ESM must reject an extensionless relative import");
	assert.match(result.stdout + result.stderr, /ERR_MODULE_NOT_FOUND/u);
});
// @custom end
