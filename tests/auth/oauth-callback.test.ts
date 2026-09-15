// @custom start
/** Public OAuth protocol invariants. */
import assert from "node:assert/strict";
import test from "node:test";
import { request as httpRequest } from "node:http";
import { connect } from "node:net";
import { once } from "node:events";
import { beginDedalusOAuth, OAuthError } from "../../src/auth/oauth/index.js";
import { commandMetadata } from "./fixtures.js";
import { tokenResponse, userInfo, finishAuthorization } from "./oauth-fixtures.js";

test("invariant a partial loopback request cannot stall OAuth cancellation", async () => {
	const attempt = await beginDedalusOAuth(commandMetadata());
	const callback = new URL(attempt.redirectURI);
	const socket = connect(Number(callback.port), callback.hostname);
	await once(socket, "connect");
	socket.write("GET /callback HTTP/1.1\r\nHost: 127.0.0.1");
	socket.on("error", () => undefined);
	const closed = new Promise((resolve) => socket.once("close", resolve));

	await attempt.cancel();
	await closed;
	await assert.rejects(
		attempt.complete(),
		(error) => error instanceof OAuthError && error.code === "login_cancelled",
	);
});

test("invariant an invalid OAuth state cannot reach token exchange", async () => {
	let tokenRequests = 0;
	const attempt = await beginDedalusOAuth(commandMetadata(), {
		fetch: async (input) => {
			if (String(input).endsWith("/oauth2/token")) {
				tokenRequests += 1;
				return Response.json(tokenResponse());
			}
			return Response.json(userInfo());
		},
	});
	const authorization = new URL(attempt.authorizationURL);
	const callback = new URL(attempt.redirectURI);
	callback.searchParams.set("code", "intercepted-code");
	callback.searchParams.set("state", "wrong-state");

	const response = await fetch(callback);
	await response.text();

	assert.equal(response.status, 400);
	assert.equal(tokenRequests, 0);

	await finishAuthorization(attempt, authorization);
	assert.equal((await attempt.complete()).organizationId, "org_cli");
	assert.equal(tokenRequests, 1);
});

test("invariant an authorization response from another issuer cannot reach token exchange", async () => {
	let tokenRequests = 0;
	const attempt = await beginDedalusOAuth(commandMetadata(), {
		fetch: async () => {
			tokenRequests += 1;
			return Response.json(tokenResponse());
		},
	});
	const authorization = new URL(attempt.authorizationURL);
	const callback = new URL(attempt.redirectURI);
	callback.searchParams.set("code", "authorization-code");
	callback.searchParams.set("iss", "https://attacker.example.com");
	callback.searchParams.set(
		"state",
		authorization.searchParams.get("state") ?? assert.fail("Missing OAuth state"),
	);

	const response = await fetch(callback);
	await response.text();

	assert.equal(response.status, 400);
	await assert.rejects(
		attempt.complete(),
		(error) => error instanceof OAuthError && error.code === "issuer_mismatch",
	);
	assert.equal(tokenRequests, 0);
});

test("invariant a malformed local request cannot terminate the OAuth callback", async () => {
	const attempt = await beginDedalusOAuth(commandMetadata(), {
		fetch: async (input) =>
			String(input).endsWith("/oauth2/token")
				? Response.json(tokenResponse())
				: Response.json(userInfo()),
	});
	const authorization = new URL(attempt.authorizationURL);
	const redirect = new URL(attempt.redirectURI);
	const status = await new Promise((resolve, reject) => {
		const request = httpRequest(
			{
				hostname: redirect.hostname,
				method: "GET",
				path: "http://[",
				port: redirect.port,
			},
			(response) => {
				response.resume();
				response.once("end", () => resolve(response.statusCode));
			},
		);
		request.once("error", reject);
		request.end();
	});

	assert.equal(status, 400);
	await finishAuthorization(attempt, authorization);
	assert.equal((await attempt.complete()).organizationId, "org_cli");
});

test("invariant OAuth provider denial cannot reach token exchange", async () => {
	let tokenRequests = 0;
	const attempt = await beginDedalusOAuth(commandMetadata(), {
		fetch: async () => {
			tokenRequests += 1;
			return Response.json({});
		},
	});
	const authorization = new URL(attempt.authorizationURL);
	const callback = new URL(attempt.redirectURI);
	callback.searchParams.set("error", "access_denied");
	callback.searchParams.set("error_description", "<script>providerDetail()</script>");
	callback.searchParams.set("iss", authorization.origin);
	callback.searchParams.set(
		"state",
		authorization.searchParams.get("state") ?? assert.fail("Missing OAuth state"),
	);

	const response = await fetch(callback);
	const page = await response.text();
	assert.equal(response.status, 400);
	assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
	assert.match(page, /Login was not completed/u);
	assert(!page.includes("providerDetail"));
	assert(!page.includes("Authorization received"));

	await assert.rejects(
		attempt.complete(),
		(error) =>
			error instanceof OAuthError &&
			error.code === "access_denied" &&
			error.stage === "provider" &&
			error.message === "access_denied",
	);
	assert.equal(tokenRequests, 0);
});
// @custom end
