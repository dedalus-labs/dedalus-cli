// @custom start
/** Auth command contracts retain credential selection and safe output. */
import assert from "node:assert/strict";
import test from "node:test";
import { Command } from "commander";
import { addDedalusCommands } from "../../src/auth/commands.js";
import { OAuthError } from "../../src/auth/errors.js";
import type { OAuthSession } from "../../src/auth/types.js";
import { commandSession as session } from "./fixtures.js";
import { commandStore as store, SESSION_METADATA } from "./command-fixtures.js";

test.afterEach(() => {
	process.exitCode = undefined;
});

test("invariant logout reports confirmed revocation and cleanup", async () => {
	let output = "";
	const program = new Command();
	addDedalusCommands(program, {
		auth: () => ({
			login: async () => ({ status: "logged_in", session: SESSION_METADATA }),
			status: async () => ({ source: "none" }),
			logout: async () => ({ status: "logged_out" }),
		}),
		writeOutput: (value) => {
			output += value;
		},
	});

	await program.parseAsync(["node", "dedalus", "auth", "logout", "--json"]);

	assert.deepEqual(JSON.parse(output), {
		status: "logged_out",
		local_tokens_removed: true,
		revocation_confirmed: true,
	});
});

test("invariant logout reports configuration failure without deleting credentials", async () => {
	let output = "";
	let errors = "";
	let stored: OAuthSession | null = session();
	const credentialStore = {
		...store(),
		read: async () => stored,
		remove: async () => {
			stored = null;
			return true;
		},
	};
	const program = new Command();
	addDedalusCommands(program, {
		environment: {},
		authProvider: () => {
			throw new OAuthError("invalid_configuration");
		},
		credentialStore: () => credentialStore,
		writeOutput: (value) => {
			output += value;
		},
		writeError: (value) => {
			errors += value;
		},
	});

	const previousExitCode = process.exitCode;
	try {
		await program.parseAsync(["node", "dedalus", "auth", "logout", "--json"]);
		assert.equal(process.exitCode, 1);
		assert.equal(output, "");
		assert.equal(JSON.parse(errors).error.code, "cli_invalid_configuration");
		assert.deepEqual(stored, session());
	} finally {
		process.exitCode = previousExitCode;
	}
});
// @custom end
