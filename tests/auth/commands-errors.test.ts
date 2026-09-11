// @custom start
/** Auth command contracts retain credential selection and safe output. */
import assert from "node:assert/strict";
import test from "node:test";
import { Command } from "commander";
import { addDedalusCommands } from "../../src/auth/commands.js";
import { OAuthError } from "../../src/auth/errors.js";
import { CredentialStorageError } from "../../src/auth/credentials.js";
import { formatDedalusError } from "./command-fixtures.js";

test.afterEach(() => {
	process.exitCode = undefined;
});

test("aggregate auth failures preserve safe causes without rendering secrets", () => {
	const secret = "private-access-token-must-not-print";
	const error = new AggregateError(
		[
			new OAuthError("revocation_failed", { cause: new Error(secret), stage: "network" }),
			new CredentialStorageError("storage_unavailable", { cause: new Error(secret) }),
		],
		secret,
	);
	const output = formatDedalusError(error, new Command());
	assert.equal(output.error.causes?.length, 2);
	assert.equal(JSON.stringify(output).includes(secret), false);
	assert.equal(output.error.causes?.[0]?.code, "cli_network_error");
	assert.equal(output.error.causes?.[1]?.code, "cli_credential_store_unavailable");
});

test("invariant unexpected auth failures never expose internal detail", async () => {
	let output = "";
	const program = new Command();
	addDedalusCommands(program, {
		auth: () => ({
			login: async () => {
				throw new Error("secret provider detail");
			},
			status: async () => ({ source: "none" }),
			logout: async () => ({ status: "not_logged_in" }),
		}),
		writeError: (value) => {
			output += value;
		},
	});

	await program.parseAsync(["node", "dedalus", "auth", "login", "--json"]);

	assert.equal(JSON.parse(output).error.code, "cli_authentication_failed");
	assert.equal(JSON.parse(output).error.credential_source, "oauth_session");
	assert.equal(output.includes("secret provider detail"), false);
	process.exitCode = 0;
});

test("invariant human auth errors retain their stable code", async () => {
	let output = "";
	const program = new Command();
	addDedalusCommands(program, {
		auth: () => ({
			login: async () => {
				throw new OAuthError("access_denied", { stage: "provider" });
			},
			status: async () => ({ source: "none" }),
			logout: async () => ({ status: "not_logged_in" }),
		}),
		writeError: (value) => {
			output += value;
		},
	});

	await program.parseAsync(["node", "dedalus", "auth", "login"]);

	assert.equal(output, "access_denied: Login was canceled or denied.\n");
	process.exitCode = 0;
});

test("invariant provider errors preserve safe codes and retry policy", async () => {
	let output = "";
	const program = new Command();
	addDedalusCommands(program, {
		auth: () => ({
			login: async () => {
				throw new OAuthError("temporarily_unavailable", { stage: "provider" });
			},
			status: async () => ({ source: "none" }),
			logout: async () => ({ status: "not_logged_in" }),
		}),
		writeError: (value) => {
			output += value;
		},
	});

	await program.parseAsync(["node", "dedalus", "auth", "login", "--json"]);

	assert.deepEqual(JSON.parse(output), {
		error: {
			code: "temporarily_unavailable",
			message: "Dedalus rejected the authentication request.",
			retryable: true,
			credential_source: "oauth_session",
		},
	});
	process.exitCode = 0;
});

test("invariant local OAuth failures use the CLI code namespace", async () => {
	let output = "";
	const program = new Command();
	addDedalusCommands(program, {
		auth: () => ({
			login: async () => {
				throw new OAuthError("state_mismatch");
			},
			status: async () => ({ source: "none" }),
			logout: async () => ({ status: "not_logged_in" }),
		}),
		writeError: (value) => {
			output += value;
		},
	});

	await program.parseAsync(["node", "dedalus", "auth", "login", "--json"]);
	assert.equal(JSON.parse(output).error.code, "cli_state_mismatch");
	process.exitCode = 0;
});

test("invariant OAuth requests without a response use the CLI network code", async () => {
	let output = "";
	const program = new Command();
	addDedalusCommands(program, {
		auth: () => ({
			login: async () => {
				throw new OAuthError("token_exchange_failed", { stage: "network" });
			},
			status: async () => ({ source: "none" }),
			logout: async () => ({ status: "not_logged_in" }),
		}),
		writeError: (value) => {
			output += value;
		},
	});

	await program.parseAsync(["node", "dedalus", "auth", "login", "--json"]);

	assert.deepEqual(JSON.parse(output).error, {
		code: "cli_network_error",
		message: "The authentication service could not be reached.",
		retryable: true,
		credential_source: "oauth_session",
	});
	process.exitCode = 0;
});

test("invariant provider HTTP errors preserve unknown provider codes exactly", async () => {
	let output = "";
	const program = new Command();
	addDedalusCommands(program, {
		auth: () => ({
			login: async () => {
				throw new OAuthError("new_provider_code", { stage: "provider", status: 418 });
			},
			status: async () => ({ source: "none" }),
			logout: async () => ({ status: "not_logged_in" }),
		}),
		writeError: (value) => {
			output += value;
		},
	});

	await program.parseAsync(["node", "dedalus", "auth", "login", "--json"]);

	const error = JSON.parse(output).error;
	assert.equal(error.code, "new_provider_code");
	assert.equal(error.http_status, 418);
	assert.equal(error.code.startsWith("cli_"), false);
	process.exitCode = 0;
});

test("invariant local response validation remains in the CLI error namespace", async () => {
	let output = "";
	const program = new Command();
	addDedalusCommands(program, {
		auth: () => ({
			login: async () => {
				throw new OAuthError("invalid_token_response", { status: 200 });
			},
			status: async () => ({ source: "none" }),
			logout: async () => ({ status: "not_logged_in" }),
		}),
		writeError: (value) => {
			output += value;
		},
	});

	await program.parseAsync(["node", "dedalus", "auth", "login", "--json"]);

	assert.deepEqual(JSON.parse(output).error, {
		code: "cli_invalid_token_response",
		message: "The authentication service returned an invalid token response.",
		retryable: false,
		http_status: 200,
		credential_source: "oauth_session",
	});
	process.exitCode = 0;
});

test("invariant invalid grants give a recoverable login sequence", async () => {
	let output = "";
	const program = new Command();
	addDedalusCommands(program, {
		auth: () => ({
			login: async () => {
				throw new OAuthError("invalid_grant", { stage: "provider", status: 400 });
			},
			status: async () => ({ source: "none" }),
			logout: async () => ({ status: "not_logged_in" }),
		}),
		writeError: (value) => {
			output += value;
		},
	});

	await program.parseAsync(["node", "dedalus", "auth", "login"]);

	assert.equal(output, "invalid_grant: The login expired or was revoked. Sign in again.\n");
	process.exitCode = 0;
});

test("invariant provider error codes cannot inject terminal control characters", async () => {
	let output = "";
	const program = new Command();
	addDedalusCommands(program, {
		auth: () => ({
			login: async () => {
				throw new OAuthError("\u001b[31mprovider_error", { stage: "provider", status: 400 });
			},
			status: async () => ({ source: "none" }),
			logout: async () => ({ status: "not_logged_in" }),
		}),
		writeError: (value) => {
			output += value;
		},
	});

	await program.parseAsync(["node", "dedalus", "auth", "login"]);

	assert.equal(output, "oauth_error: Dedalus rejected the authentication request.\n");
	process.exitCode = 0;
});
// @custom end
