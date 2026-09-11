// @custom start
/** Login owns each issued grant until it returns a usable session. */
import assert from "node:assert/strict";
import test from "node:test";

import { revokeTokenSet } from "../../src/auth/oauth/revoke.js";
import { authMetadata, authSession } from "./fixtures.js";

test("invariant_revocation_attempts_both_tokens_and_preserves_each_failure", async () => {
	const causes = [new Error("refresh unavailable"), new Error("access unavailable")];
	let calls = 0;
	await assert.rejects(
		revokeTokenSet(
			authMetadata(),
			authSession({ refreshToken: "refresh", accessToken: "access" }),
			async () => {
				throw causes[calls++];
			},
		),
		(error: unknown) => {
			assert.ok(error instanceof AggregateError);
			assert.deepEqual(
				error.errors.map((failure: Error) => failure.cause),
				causes,
			);
			return true;
		},
	);
	assert.equal(calls, 2);
});
// @custom end
