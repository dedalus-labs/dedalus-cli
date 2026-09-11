// @custom start
/** Session output exposes identity without credential values. */
import assert from "node:assert/strict";
import test from "node:test";
import { loginOutput, logoutOutput, statusOutput } from "../../src/auth/output.js";
import { commandSession } from "./fixtures.js";

test("invariant authentication output contains only public session metadata", () => {
	const session = commandSession();
	const outputs = [
		loginOutput({ status: "logged_in", session }),
		statusOutput({ source: "oauth_session", session, offline: true }),
	];
	for (const output of outputs) {
		const serialized = JSON.stringify(output);
		assert.equal(serialized.includes(session.accessToken), false);
		assert.equal(serialized.includes(session.refreshToken), false);
		assert.equal(serialized.includes(session.organizationId), true);
	}
	assert.deepEqual(logoutOutput({ status: "logged_out" }).value, {
		status: "logged_out",
		local_tokens_removed: true,
		revocation_confirmed: true,
	});
});
// @custom end
