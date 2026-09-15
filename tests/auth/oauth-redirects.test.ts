// @custom start
/** Public OAuth protocol invariants. */
import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import {
	beginDedalusOAuth,
	createDedalusAuthProvider,
	OAuthError,
} from "../../src/auth/oauth/index.js";
import { commandMetadata, commandSession as session } from "./fixtures.js";
import {
	tokenResponse,
	userInfo,
	finishAuthorization,
	listen,
	close,
	serverURL,
} from "./oauth-fixtures.js";

test("invariant OAuth token exchange never follows redirects", async () => {
	let forwardedRequests = 0;
	const receiver = createServer((_request, response) => {
		forwardedRequests += 1;
		response.end(JSON.stringify(tokenResponse()));
	});
	await listen(receiver);
	const tokenEndpoint = createServer((_request, response) => {
		response.writeHead(307, { Location: serverURL(receiver) });
		response.end();
	});
	await listen(tokenEndpoint);

	try {
		const attempt = await beginDedalusOAuth(commandMetadata(), {
			fetch: (_input, init) => fetch(serverURL(tokenEndpoint), init),
		});
		const authorization = new URL(attempt.authorizationURL);
		await finishAuthorization(attempt, authorization);

		await assert.rejects(
			attempt.complete(),
			(error) =>
				error instanceof OAuthError &&
				error.code === "invalid_json_response" &&
				error.status === 307 &&
				error.cause instanceof SyntaxError,
		);
		assert.equal(forwardedRequests, 0);
	} finally {
		await close(tokenEndpoint);
		await close(receiver);
	}
});

test("invariant OAuth userinfo requests never forward access tokens across redirects", async () => {
	let forwardedRequests = 0;
	const receiver = createServer((_request, response) => {
		forwardedRequests += 1;
		response.end(JSON.stringify(userInfo()));
	});
	await listen(receiver);
	const userinfoEndpoint = createServer((_request, response) => {
		response.writeHead(307, { Location: serverURL(receiver) });
		response.end();
	});
	await listen(userinfoEndpoint);

	try {
		const attempt = await beginDedalusOAuth(commandMetadata(), {
			fetch: async (input, init) => {
				if (String(input).endsWith("/oauth2/token")) return Response.json(tokenResponse());
				if (String(input).endsWith("/oauth2/revoke")) return new Response(null, { status: 200 });
				return fetch(serverURL(userinfoEndpoint), init);
			},
		});
		const authorization = new URL(attempt.authorizationURL);
		await finishAuthorization(attempt, authorization);

		await assert.rejects(
			attempt.complete(),
			(error) =>
				error instanceof OAuthError &&
				error.code === "invalid_json_response" &&
				error.status === 307 &&
				error.cause instanceof SyntaxError,
		);
		assert.equal(forwardedRequests, 0);
	} finally {
		await close(userinfoEndpoint);
		await close(receiver);
	}
});

test("invariant OAuth revocation never forwards a refresh token across redirects", async () => {
	let forwardedRequests = 0;
	const receiver = createServer((_request, response) => {
		forwardedRequests += 1;
		response.writeHead(200);
		response.end();
	});
	await listen(receiver);
	const revocationEndpoint = createServer((_request, response) => {
		response.writeHead(307, { Location: serverURL(receiver) });
		response.end();
	});
	await listen(revocationEndpoint);

	try {
		const authProvider = createDedalusAuthProvider(commandMetadata(), {
			fetch: (_input, init) => fetch(serverURL(revocationEndpoint), init),
		});
		await assert.rejects(
			authProvider.revoke(
				session({
					version: 2,
					issuer: "https://issuer.example.com",
					clientId: "client_cli",
					resource: "https://dcs.dedaluslabs.ai",
					accessToken: "access-token",
					accessTokenExpiresAt: 2_000_000_000_000,
					refreshToken: "refresh-token",
					userId: "user_cli",
					organizationId: "org_cli",
					grantedScopes: ["offline_access", "dedalus:cli"],
				}),
			),
			(error) =>
				error instanceof AggregateError &&
				error.errors.length === 2 &&
				error.errors.every(
					(failure: unknown) =>
						failure instanceof OAuthError &&
						failure.code === "revocation_failed" &&
						failure.status === 307,
				),
		);
		assert.equal(forwardedRequests, 0);
	} finally {
		await close(revocationEndpoint);
		await close(receiver);
	}
});
// @custom end
