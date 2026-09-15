// @custom start
/** Public OAuth protocol invariants. */
import assert from "node:assert/strict";
import test from "node:test";
import { beginDedalusOAuth, pkceChallenge } from "../../src/auth/oauth/index.js";
import { commandMetadata } from "./fixtures.js";
import { tokenResponse, userInfo, finishAuthorization } from "./oauth-fixtures.js";

test("invariant PKCE uses the RFC 7636 S256 transform", () => {
	assert.equal(
		pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
		"E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
	);
});

test("invariant OAuth stores the complete organization-bound token set", async () => {
	const requests: { input: string; init: RequestInit | undefined }[] = [];
	const attempt = await beginDedalusOAuth(commandMetadata(), {
		now: () => 1_000,
		randomBytes: () => Buffer.alloc(32, 7),
		fetch: async (input, init) => {
			requests.push({ input: String(input), init });
			if (String(input).endsWith("/oauth2/token")) return Response.json(tokenResponse());
			return Response.json(userInfo());
		},
	});
	const authorization = new URL(attempt.authorizationURL);
	const redirect = new URL(attempt.redirectURI);

	assert.equal(
		authorization.origin + authorization.pathname,
		"https://issuer.example.com/oauth2/auth",
	);
	assert.equal(authorization.searchParams.get("response_type"), "code");
	assert.equal(authorization.searchParams.get("client_id"), "client_cli");
	assert.equal(authorization.searchParams.get("redirect_uri"), attempt.redirectURI);
	assert.equal(authorization.searchParams.get("scope"), "offline_access dedalus:cli");
	assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
	assert.equal(redirect.hostname, "127.0.0.1");
	assert.notEqual(redirect.port, "");
	assert.equal(redirect.pathname, "/callback");

	await finishAuthorization(attempt, authorization);
	const result = await attempt.complete();

	assert.deepEqual(result, {
		version: 2,
		issuer: "https://issuer.example.com",
		clientId: "client_cli",
		resource: "https://dcs.dedaluslabs.ai",
		accessToken: "oauth-access-token",
		accessTokenExpiresAt: 86_401_000,
		refreshToken: "oauth-refresh-token",
		userId: "user_cli",
		organizationId: "org_cli",
		grantedScopes: ["offline_access", "dedalus:cli"],
	});
	assert(requests[0]?.init);
	assert.equal(requests[0].input, "https://issuer.example.com/oauth2/token");
	assert.equal(requests[0].init.redirect, "manual");
	assert(requests[0]?.init);
	assert(requests[0].init.body instanceof URLSearchParams);
	const body = new URLSearchParams(String(requests[0].init.body));
	assert.equal(body.get("grant_type"), "authorization_code");
	assert.equal(body.get("client_secret"), null);
	assert.equal(body.get("code_verifier")?.length, 43);
	assert(requests[1]?.init);
	assert.equal(requests[1].input, "https://issuer.example.com/oauth2/userinfo");
	assert.equal(
		new Headers(requests[1].init.headers).get("Authorization"),
		"Bearer oauth-access-token",
	);
	assert.equal(requests[1].init.redirect, "manual");
});

test("invariant_browser_entry_uses_only_public_protocol_metadata", async () => {
	const metadata = commandMetadata();
	const attempt = await beginDedalusOAuth(metadata);
	try {
		const url = new URL(attempt.authorizationURL);
		assert.equal(url.origin + url.pathname, metadata.authorizationURL);
		assert.equal(url.hash, "");
		assert.equal(url.searchParams.get("redirect_uri"), attempt.redirectURI);
		assert.equal(url.searchParams.size, 8);
	} finally {
		await attempt.cancel();
	}
});

test("invariant_authorization_requests_fit_the_browser_contract", async () => {
	const issuer = `https://${"a".repeat(3_900)}.example.com`;
	await assert.rejects(
		beginDedalusOAuth({
			...commandMetadata(),
			issuer,
			authorizationURL: `${issuer}/oauth2/auth`,
			tokenURL: `${issuer}/oauth2/token`,
			userInfoURL: `${issuer}/oauth2/userinfo`,
			revocationURL: `${issuer}/oauth2/revoke`,
			clientId: "c".repeat(1_024),
		}),
		{ code: "invalid_configuration" },
	);
});

test("invariant_oauth_requires_valid_public_endpoint_metadata", async () => {
	for (const replacement of [
		{ issuer: "http://issuer.example.com" },
		{ issuer: " https://issuer.example.com" },
		{ clientId: " client_cli" },
		{ tokenURL: "https://other.example.com/oauth2/token" },
		{ authorizationURL: "http://website.example.com/oauth2/auth" },
	]) {
		await assert.rejects(beginDedalusOAuth({ ...commandMetadata(), ...replacement }), {
			code: "invalid_configuration",
		});
	}
});

test("invariant_oauth_rejects_unrecognized_configuration_fields", async () => {
	for (const fields of [
		{ signInURL: "http://localhost:3000/cli/sign-in" },
		{ gatewayURL: "https://other.example.com" },
	]) {
		const unsupported = { ...commandMetadata(), ...fields };
		await assert.rejects(beginDedalusOAuth(unsupported), { code: "invalid_configuration" });
	}
});
// @custom end
