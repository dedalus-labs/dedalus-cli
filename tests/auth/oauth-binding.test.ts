// @custom start
// Bind AS sessions to their resource and preserve revocation and callback failures.
import assert from "node:assert/strict";
import { Server } from "node:http";
import test from "node:test";
import { beginDedalusOAuth, createDedalusAuthProvider } from "../../src/auth/oauth/index.js";
import { fetchUserInfo, requestTokenSet } from "../../src/auth/oauth/http.js";
import { accessTokenForCommand } from "../../src/auth/workflow.js";
import { authMetadata, authSession } from "./fixtures.js";

const configuration = authMetadata({
	issuer: "https://issuer.example.com",
	clientId: "dedalus-cli",
	resource: "https://dcs.dedaluslabs.ai",
});
const session = authSession({
	issuer: configuration.issuer,
	clientId: configuration.clientId,
	resource: configuration.resource,
	accessToken: "access",
	refreshToken: "refresh",
	userId: "user_one",
	organizationId: "org_one",
});
const USER_INFO = {
	iss: configuration.issuer,
	sub: session.userId,
	org_id: session.organizationId,
	client_id: configuration.clientId,
	aud: configuration.resource,
	scope: "offline_access dedalus:cli",
	exp: 2_000_000_000,
};

test("AS identity requires the configured issuer, client, resource, scope and expiry", async () => {
	for (const replacement of [
		{ iss: "https://other.example.com" },
		{ client_id: "other" },
		{ aud: "https://other.example.com" },
		{ scope: "offline_access" },
		{ exp: 1 },
	]) {
		await assert.rejects(
			fetchUserInfo(configuration, session.accessToken, {
				request: async () => Response.json({ ...USER_INFO, ...replacement }),
				now: Date.now,
			}),
		);
	}
	assert.deepEqual(
		await fetchUserInfo(configuration, session.accessToken, {
			request: async () => Response.json(USER_INFO),
			now: Date.now,
		}),
		{ userId: session.userId, organizationId: session.organizationId },
	);
});

test("stored tokens cannot move to another resource or issuer", async () => {
	for (const replacement of [
		{ resource: "https://other.example.com" },
		{ issuer: "https://other.example.com" },
	]) {
		let calls = 0;
		const provider = createDedalusAuthProvider(
			authMetadata({
				issuer: configuration.issuer,
				clientId: configuration.clientId,
				resource: configuration.resource,
				...replacement,
			}),
			{
				fetch: async () => {
					calls++;
					throw new Error("must not request");
				},
			},
		);
		await assert.rejects(
			accessTokenForCommand(
				{
					read: async () => session,
					write: async () => {},
					remove: async () => false,
					withLifecycleLock: async (operation) => operation(),
				},
				provider,
			),
			{ code: "cli_session_provider_mismatch" },
		);
		await assert.rejects(provider.revoke(session), { code: "session_provider_mismatch" });
		assert.equal(calls, 0);
	}
});

test("AS refresh cannot silently reuse a missing rotated token or scope", async () => {
	for (const replacement of [{ refresh_token: undefined }, { scope: undefined }]) {
		await assert.rejects(
			requestTokenSet({
				metadata: configuration,
				body: new URLSearchParams(),
				now: Date.now,
				operation: "refresh_failed",
				request: async () =>
					Response.json({
						access_token: "access",
						refresh_token: "rotated",
						scope: "offline_access dedalus:cli",
						token_type: "Bearer",
						expires_in: 900,
						...replacement,
					}),
			}),
		);
	}
});

test("revocation preserves the exact network failure without confirming success", async () => {
	const cause = new Error("revocation transport failed");
	for (const failAt of [1, 2]) {
		let calls = 0;
		const provider = createDedalusAuthProvider(configuration, {
			fetch: async () => {
				calls++;
				if (calls === failAt) throw cause;
				return new Response(null, { status: 200 });
			},
		});
		await assert.rejects(
			provider.revoke(session),
			(error) => error instanceof Error && error.cause === cause,
		);
		assert.equal(calls, 2);
	}
});

test("callback cleanup failure prevents code exchange", async (context) => {
	const cause = new Error("listener close failed");
	const close = Server.prototype.close;
	context.mock.method(
		Server.prototype,
		"close",
		function (this: Server, callback?: (error?: Error) => void) {
			return close.call(this, () => callback?.(cause));
		},
	);
	let tokenCalls = 0;
	const attempt = await beginDedalusOAuth(configuration, {
		fetch: async () => {
			tokenCalls++;
			throw new Error("must not exchange");
		},
	});
	const authorization = new URL(attempt.authorizationURL);
	const callback = new URL(attempt.redirectURI);
	const state = authorization.searchParams.get("state");
	assert.ok(state);
	callback.search = new URLSearchParams({
		code: "authorization-code",
		state,
		iss: configuration.issuer,
	}).toString();
	const response = await fetch(callback);
	await response.text();
	await assert.rejects(
		attempt.complete(),
		(error) => error instanceof Error && error.cause === cause,
	);
	assert.equal(tokenCalls, 0);
});
// @custom end
