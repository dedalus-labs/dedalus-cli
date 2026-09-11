// @custom start
/** Public OAuth protocol invariants. */
import assert from "node:assert/strict";
import test from "node:test";
import { beginDedalusOAuth, OAuthError } from "../../src/auth/oauth/index.js";
import { commandMetadata } from "./fixtures.js";
import { tokenResponse, finishAuthorization } from "./oauth-fixtures.js";

test("invariant incomplete OAuth token sets cannot authenticate", async () => {
	const attempt = await beginDedalusOAuth(commandMetadata(), {
		fetch: async () => Response.json(tokenResponse({ refresh_token: undefined })),
	});
	const authorization = new URL(attempt.authorizationURL);
	await finishAuthorization(attempt, authorization);

	await assert.rejects(
		attempt.complete(),
		(error) =>
			error instanceof OAuthError &&
			error.code === "invalid_token_response" &&
			error.stage === "local" &&
			error.status === 200,
	);
});

test("invariant OAuth responses are decoded within a fixed memory bound", async () => {
	const attempt = await beginDedalusOAuth(commandMetadata(), {
		fetch: async () => new Response(" ".repeat(513 * 1024)),
	});
	const authorization = new URL(attempt.authorizationURL);
	await finishAuthorization(attempt, authorization);

	await assert.rejects(
		attempt.complete(),
		(error) =>
			error instanceof OAuthError &&
			error.code === "response_too_large" &&
			error.stage === "local" &&
			error.status === 200,
	);
});

test("invariant OAuth cannot grant scopes outside the requested scope bundle", async () => {
	const attempt = await beginDedalusOAuth(commandMetadata(), {
		fetch: async () =>
			Response.json(
				tokenResponse({
					scope: "offline_access dedalus:cli admin:all",
				}),
			),
	});
	const authorization = new URL(attempt.authorizationURL);
	await finishAuthorization(attempt, authorization);

	await assert.rejects(
		attempt.complete(),
		(error) =>
			error instanceof OAuthError && error.code === "invalid_scope" && error.status === 200,
	);
});

test("invariant a present OAuth scope value must be a string", async () => {
	const attempt = await beginDedalusOAuth(commandMetadata(), {
		fetch: async () =>
			Response.json(
				tokenResponse({
					scope: ["offline_access", "dedalus:cli"],
				}),
			),
	});
	const authorization = new URL(attempt.authorizationURL);
	await finishAuthorization(attempt, authorization);

	await assert.rejects(
		attempt.complete(),
		(error) =>
			error instanceof OAuthError && error.code === "invalid_scope" && error.status === 200,
	);
});

test("invariant OAuth credentials are never normalized or accepted with whitespace", async () => {
	const attempt = await beginDedalusOAuth(commandMetadata(), {
		fetch: async () => Response.json(tokenResponse({ access_token: " altered-token" })),
	});
	const authorization = new URL(attempt.authorizationURL);
	await finishAuthorization(attempt, authorization);

	await assert.rejects(
		attempt.complete(),
		(error) =>
			error instanceof OAuthError &&
			error.code === "invalid_token_response" &&
			error.status === 200,
	);
});

test("invariant token endpoint errors retain the provider code and HTTP status", async () => {
	const attempt = await beginDedalusOAuth(commandMetadata(), {
		fetch: async () => Response.json({ error: "provider_specific_error" }, { status: 400 }),
	});
	const authorization = new URL(attempt.authorizationURL);
	await finishAuthorization(attempt, authorization);

	await assert.rejects(
		attempt.complete(),
		(error) =>
			error instanceof OAuthError &&
			error.code === "provider_specific_error" &&
			error.stage === "provider" &&
			error.status === 400,
	);
});

test("invariant unsafe OAuth error codes cannot inject terminal control characters", async () => {
	const attempt = await beginDedalusOAuth(commandMetadata(), {
		fetch: async () => Response.json({ error: "\u001b[31mprovider_error" }, { status: 400 }),
	});
	const authorization = new URL(attempt.authorizationURL);
	await finishAuthorization(attempt, authorization);

	await assert.rejects(
		attempt.complete(),
		(error) => error instanceof OAuthError && error.code === "oauth_error" && error.status === 400,
	);
});

test("invariant token expiry must fit in a safe timestamp", async () => {
	const attempt = await beginDedalusOAuth(commandMetadata(), {
		now: () => Number.MAX_SAFE_INTEGER - 100,
		fetch: async () => Response.json(tokenResponse({ expires_in: 1 })),
	});
	const authorization = new URL(attempt.authorizationURL);
	await finishAuthorization(attempt, authorization);

	await assert.rejects(
		attempt.complete(),
		(error) =>
			error instanceof OAuthError &&
			error.code === "invalid_token_response" &&
			error.status === 200,
	);
});

test("invariant token expiry must fit in the JavaScript date range", async () => {
	const attempt = await beginDedalusOAuth(commandMetadata(), {
		now: () => 0,
		fetch: async () => Response.json(tokenResponse({ expires_in: 8_700_000_000_000 })),
	});
	const authorization = new URL(attempt.authorizationURL);
	await finishAuthorization(attempt, authorization);

	await assert.rejects(
		attempt.complete(),
		(error) =>
			error instanceof OAuthError &&
			error.code === "invalid_token_response" &&
			error.status === 200,
	);
});
// @custom end
