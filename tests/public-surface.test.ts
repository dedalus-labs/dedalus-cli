// @custom start
// Verify private literals stay blocked across source and publication encodings.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { artifactFiles, publicViolations, scanPublicFiles } from "../scripts/check-public.js";

const PROHIBITED = ["private", "dedaluslabs", "ai"].join(".");

test("invariant public scans reject raw and encoded deployment values", () => {
	for (const value of [
		PROHIBITED,
		PROHIBITED.toUpperCase(),
		Array.from(PROHIBITED, (char) => `%${char.charCodeAt(0).toString(16)}`).join(""),
		Array.from(PROHIBITED, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`).join(
			"",
		),
		Buffer.from(`https://${PROHIBITED}`).toString("base64"),
		["test-deployment", "clerk", "accounts", "dev"].join("."),
		["DEDALUS", "AUTH", "CONFIG"].join("_"),
	])
		assert.ok(publicViolations(value) > 0);
});

test("design approved public origins and external reference links are allowed", () => {
	for (const value of [
		"https://dcs.dedaluslabs.ai/v1/machines",
		"https://www.dedaluslabs.ai",
		"https://issuer.example.com",
		"https://www.rfc-editor.org/rfc/rfc9207",
		"https://registry.npmjs.org/zod",
		"https://github.com/dedalus-labs/dedalus-cli",
	])
		assert.equal(publicViolations(value), 0);
});

test("invariant artifact checks include emitted maps and declarations without echoing values", () => {
	const directory = mkdtempSync(join(tmpdir(), "cli-public-test-"));
	try {
		for (const name of ["entry.js", "entry.cjs", "entry.d.ts", "entry.js.map", "README.md"]) {
			writeFileSync(join(directory, name), JSON.stringify({ value: PROHIBITED }));
		}
		const diagnostics = scanPublicFiles(artifactFiles(directory));
		assert.equal(diagnostics.length, 5);
		assert.ok(diagnostics.every((line) => !line.includes(PROHIBITED)));
		writeFileSync(join(directory, "archive.tgz"), "compressed");
		assert.throws(() => artifactFiles(directory), /extract compressed artifacts/);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
// @custom end
