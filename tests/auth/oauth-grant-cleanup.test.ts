// @custom start
/** Login owns each issued grant until it returns a usable session. */
import assert from "node:assert/strict";
import test from "node:test";

import { beginDedalusOAuth } from "../../src/auth/oauth/index.js";
import { revokeTokenSet } from "../../src/auth/oauth/revoke.js";
import { authMetadata, authSession } from "./fixtures.js";

test("invariant_failed_identity_validation_revokes_issued_tokens", async () => {
	const issuer = "https://issuer.example.com";
	const revoked: string[] = [];
	const attempt = await beginDedalusOAuth(authMetadata({ issuer }), {
		fetch: async (input, options) => {
			const path = new URL(String(input)).pathname;
			if (path === "/oauth2/token") {
				return Response.json({
					access_token: "fresh-access",
					refresh_token: "fresh-refresh",
					expires_in: 3600,
					token_type: "Bearer",
					scope: "offline_access dedalus:cli",
				});
			}
			if (path === "/oauth2/revoke") {
				assert.ok(options?.body instanceof URLSearchParams);
				const token = options.body.get("token");
				assert.ok(token);
				revoked.push(token);
				return new Response(null, { status: 200 });
			}
			assert.equal(path, "/oauth2/userinfo");
			return Response.json({});
		},
	});
	const authorization = new URL(attempt.authorizationURL);
	const state = authorization.searchParams.get("state");
	assert.ok(state);
	const callback = new URL(attempt.redirectURI);
	callback.search = new URLSearchParams({ code: "test-code", state, iss: issuer }).toString();
	await (await fetch(callback)).text();
	await assert.rejects(attempt.complete(), { code: "invalid_userinfo_response" });
	assert.deepEqual(revoked, ["fresh-refresh", "fresh-access"]);
});

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
