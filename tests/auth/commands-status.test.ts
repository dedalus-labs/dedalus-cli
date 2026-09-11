// @custom start
/** Auth command contracts retain credential selection and safe output. */
import assert from "node:assert/strict";
import test from "node:test";
import { Command } from "commander";
import { addDedalusCommands } from "../../src/auth/commands.js";
import { commandSession as session } from "./fixtures.js";
import { commandStore as store, SESSION_METADATA } from "./command-fixtures.js";

test.afterEach(() => {
	process.exitCode = undefined;
});

test("invariant auth status JSON exposes source metadata without secrets", async () => {
	let output = "";
	let offline;
	const program = new Command();
	addDedalusCommands(program, {
		auth: () => ({
			login: async () => {
				throw new Error("unused");
			},
			status: async (_flags, value) => {
				offline = value;
				return { source: "oauth_session", offline: value, session: SESSION_METADATA };
			},
			logout: async () => ({ status: "not_logged_in" }),
		}),
		writeOutput: (value) => {
			output += value;
		},
	});

	await program.parseAsync(["node", "dedalus", "auth", "status", "--offline", "--json"]);

	assert.deepEqual(JSON.parse(output), {
		status: "logged_in",
		credential_source: "oauth_session",
		offline: true,
		issuer: "https://issuer.example.com",
		user_id: "user_cli",
		organization: { id: "org_cli" },
		access_token_expires_at: new Date(2_000_000_000_000).toISOString(),
	});
	assert.equal(offline, true);
	assert.equal(output.includes("oauth-access-token"), false);
	assert.equal(output.includes("oauth-refresh-token"), false);
});

test("invariant auth status does not inspect a lower-priority Bearer environment override", async () => {
	let output = "";
	let reads = 0;
	const program = new Command();
	addDedalusCommands(program, {
		environment: { DEDALUS_BEARER_AUTH: "unsupported-lower-priority-token" },
		credentialStore: () => ({
			...store(),
			read: async () => {
				reads += 1;
				return session();
			},
		}),
		writeOutput: (value) => {
			output += value;
		},
	});

	await program.parseAsync([
		"node",
		"dedalus",
		"auth",
		"status",
		"--api-key",
		"flag-key",
		"--json",
	]);

	assert.deepEqual(JSON.parse(output), { status: "configured", credential_source: "flag" });
	assert.equal(reads, 0);
});

test("invariant workload-key status does not construct a lower-priority OAuth provider", async () => {
	let output = "";
	let providerCalls = 0;
	const program = new Command();
	addDedalusCommands(program, {
		environment: {},
		authProvider: () => {
			providerCalls += 1;
			throw new Error("must not construct provider");
		},
		writeOutput: (value) => {
			output += value;
		},
	});

	await program.parseAsync([
		"node",
		"dedalus",
		"auth",
		"status",
		"--api-key",
		"flag-key",
		"--json",
	]);

	assert.deepEqual(JSON.parse(output), { status: "configured", credential_source: "flag" });
	assert.equal(providerCalls, 0);
});

test("invariant environment-key status does not construct a lower-priority credential store", async () => {
	let output = "";
	const program = new Command();
	addDedalusCommands(program, {
		credentialStore: () => {
			throw new Error("must not construct credential store");
		},
		environment: { DEDALUS_API_KEY: "environment-key" },
		writeOutput: (value) => {
			output += value;
		},
	});

	await program.parseAsync(["node", "dedalus", "auth", "status", "--json"]);

	assert.deepEqual(JSON.parse(output), { status: "configured", credential_source: "environment" });
});

test("invariant workload-key human status reports configuration without claiming authentication", async () => {
	let output = "";
	const program = new Command();
	addDedalusCommands(program, {
		environment: { DEDALUS_API_KEY: "environment-key" },
		writeOutput: (value) => {
			output += value;
		},
	});

	await program.parseAsync(["node", "dedalus", "auth", "status"]);

	assert.equal(output, "Credential configured from environment.\n");
});

test("invariant OAuth human status identifies the active principal", async () => {
	let output = "";
	const program = new Command();
	addDedalusCommands(program, {
		auth: () => ({
			login: async () => ({ status: "already_signed_in", session: SESSION_METADATA }),
			status: async () => ({ source: "oauth_session", offline: false, session: SESSION_METADATA }),
			logout: async () => ({ status: "not_logged_in" }),
		}),
		writeOutput: (value) => {
			output += value;
		},
	});

	await program.parseAsync(["node", "dedalus", "auth", "status"]);

	assert.equal(output, "Signed in as user_cli to organization org_cli.\n");
});

test("invariant offline status is independent of current provider configuration", async () => {
	let output = "";
	let providerCalls = 0;
	const program = new Command();
	addDedalusCommands(program, {
		environment: {},
		credentialStore: () => store(),
		authProvider: () => {
			providerCalls += 1;
			throw new Error("must not construct provider");
		},
		writeOutput: (value) => {
			output += value;
		},
	});

	await program.parseAsync(["node", "dedalus", "auth", "status", "--offline", "--json"]);

	assert.equal(JSON.parse(output).credential_source, "oauth_session");
	assert.equal(JSON.parse(output).offline, true);
	assert.equal(providerCalls, 0);
});

test("invariant root JSON override also applies to auth commands", async () => {
	let output = "";
	const program = new Command();
	addDedalusCommands(program, {
		auth: () => ({
			login: async () => ({ status: "already_signed_in", session: SESSION_METADATA }),
			status: async () => ({ source: "none" }),
			logout: async () => ({ status: "not_logged_in" }),
		}),
		writeOutput: (value) => {
			output += value;
		},
	});

	await program.parseAsync(["node", "dedalus", "--json", "auth", "status"]);

	assert.deepEqual(JSON.parse(output), { status: "not_logged_in", credential_source: "none" });
});
test("invariant repeat login reports provider-neutral session metadata", async () => {
	let output = "";
	const program = new Command();
	addDedalusCommands(program, {
		auth: () => ({
			login: async () => ({ status: "already_signed_in", session: SESSION_METADATA }),
			status: async () => ({ source: "none" }),
			logout: async () => ({ status: "not_logged_in" }),
		}),
		writeOutput: (value) => {
			output += value;
		},
	});

	await program.parseAsync(["node", "dedalus", "auth", "login", "--json"]);

	assert.equal(JSON.parse(output).credential_source, "oauth_session");
	assert.equal(JSON.parse(output).organization.id, "org_cli");
	assert.equal(output.includes("oauth-access-token"), false);
});
// @custom end
