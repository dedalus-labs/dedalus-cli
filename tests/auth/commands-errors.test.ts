// @custom start
/** Auth errors preserve safe causes at the public output boundary. */
import assert from "node:assert/strict";
import test from "node:test";
import { Command } from "commander";
import { OAuthError } from "../../src/auth/errors.js";
import { CredentialStorageError } from "../../src/auth/credentials.js";
import { formatDedalusError } from "./command-fixtures.js";

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
// @custom end
