// @custom start
/** Public OAuth protocol invariants. */
import assert from "node:assert/strict";
import test from "node:test";
import { beginDedalusOAuth, OAuthError } from "../../src/auth/oauth/index.js";
import { commandMetadata } from "./fixtures.js";
import { tokenResponse, userInfo, finishAuthorization } from "./oauth-fixtures.js";

test("invariant oversized userinfo identifiers cannot enter credential storage", async () => {
	const attempt = await beginDedalusOAuth(commandMetadata(), {
		fetch: async (input) =>
			String(input).endsWith("/oauth2/token")
				? Response.json(tokenResponse())
				: Response.json(userInfo({ sub: "u".repeat(1025) })),
	});
	const authorization = new URL(attempt.authorizationURL);
	await finishAuthorization(attempt, authorization);

	await assert.rejects(
		attempt.complete(),
		(error) =>
			error instanceof OAuthError &&
			error.code === "invalid_userinfo_response" &&
			error.stage === "local" &&
			error.status === 200,
	);
});

test("invariant login requires OAuth organization identity", async () => {
	const attempt = await beginDedalusOAuth(commandMetadata(), {
		fetch: async (input) =>
			String(input).endsWith("/oauth2/token")
				? Response.json(tokenResponse())
				: Response.json(userInfo({ org_id: undefined })),
	});
	const authorization = new URL(attempt.authorizationURL);
	await finishAuthorization(attempt, authorization);

	await assert.rejects(
		attempt.complete(),
		(error) =>
			error instanceof OAuthError &&
			error.code === "invalid_userinfo_response" &&
			error.status === 200,
	);
});

test("invariant login requires OAuth userinfo sub without an alternate identity fallback", async () => {
	const attempt = await beginDedalusOAuth(commandMetadata(), {
		fetch: async (input) =>
			String(input).endsWith("/oauth2/token")
				? Response.json(tokenResponse())
				: Response.json(userInfo({ sub: undefined, user_id: "alternate_user" })),
	});
	const authorization = new URL(attempt.authorizationURL);
	await finishAuthorization(attempt, authorization);

	await assert.rejects(
		attempt.complete(),
		(error) =>
			error instanceof OAuthError &&
			error.code === "invalid_userinfo_response" &&
			error.status === 200,
	);
});

test("invariant opaque access tokens with dot separators remain supported", async () => {
	const attempt = await beginDedalusOAuth(commandMetadata(), {
		fetch: async (input) =>
			String(input).endsWith("/oauth2/token")
				? Response.json(tokenResponse({ access_token: "opaque.access.token" }))
				: Response.json(userInfo()),
	});
	const authorization = new URL(attempt.authorizationURL);
	await finishAuthorization(attempt, authorization);

	assert.equal((await attempt.complete()).accessToken, "opaque.access.token");
});
// @custom end
