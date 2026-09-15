// @custom start
/** Run typed suites with tsx and verify packaged JavaScript with native Node resolution. */
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEST_MODES = [
	{ suffix: ".test.ts", loader: ["--import", "tsx"] },
	{ suffix: ".test.mjs", loader: [] },
] as const;
const TEST_FILES = readdirSync("tests", { recursive: true, encoding: "utf8" })
	.filter((path) => TEST_MODES.some((mode) => path.endsWith(mode.suffix)))
	.sort()
	.map((path) => join("tests", path));
if (TEST_FILES.length === 0) throw new Error("No test suites were discovered");

type ProcessExit = { code: number | null; signal: NodeJS.Signals | null };

const run = async (files: readonly string[], loader: readonly string[]): Promise<ProcessExit> => {
	const testDirectory = mkdtempSync(join(tmpdir(), "cli-test-user-"));
	try {
		return await new Promise((resolve, reject) => {
			const child = spawn(
				process.execPath,
				[...loader, "--test", ...process.argv.slice(2), ...files],
				{
					stdio: "inherit",
					// Feedback fixtures must never record into the developer's diagnostics.
					env: { ...process.env, HOME: testDirectory, USERPROFILE: testDirectory },
				},
			);
			child.once("error", (cause: Error) => {
				reject(new Error("Could not start the test runner", { cause }));
			});
			child.once("exit", (code, signal) => resolve({ code, signal }));
		});
	} finally {
		rmSync(testDirectory, { recursive: true, force: true });
	}
};

for (const mode of TEST_MODES) {
	const files = TEST_FILES.filter((path) => path.endsWith(mode.suffix));
	if (files.length === 0) continue;
	const { code, signal } = await run(files, mode.loader);
	if (signal !== null) {
		process.kill(process.pid, signal);
		break;
	}
	if (code === null) throw new Error("Test runner exited without a status");
	if (code !== 0) process.exitCode = code;
}
// @custom end
