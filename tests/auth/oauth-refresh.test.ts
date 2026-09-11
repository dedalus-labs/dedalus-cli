// @custom start
/** Public OAuth protocol invariants. */
import assert from "node:assert/strict";
import test from "node:test";
import { createDedalusAuthProvider, OAuthError } from "../../src/auth/oauth/index.js";
import { commandMetadata, commandSession as session } from "./fixtures.js";
import { tokenResponse } from "./oauth-fixtures.js";

test("invariant OAuth refresh preserves verified metadata without a userinfo request", async () => {
	const requests: { input: string; init: RequestInit | undefined }[] = [];
	const provider = createDedalusAuthProvider(commandMetadata(), {
		now: () => 10_000,
		fetch: async (input, init) => {
			requests.push({ input: String(input), init });
			if (String(input).endsWith("/oauth2/token")) {
				return Response.json(
					tokenResponse({
						access_token: "refreshed-access-token",
						refresh_token: "rotated-refresh-token",
						expires_in: 3_600,
					}),
				);
			}
			throw new Error("userinfo is unavailable");
		},
	});
	const refreshed = await provider.refresh(
		session({
			version: 2,
			issuer: "https://issuer.example.com",
			clientId: "client_cli",
			resource: "https://dcs.dedaluslabs.ai",
			accessToken: "expired-access-token",
			accessTokenExpiresAt: 1,
			refreshToken: "original-refresh-token",
			userId: "user_cli",
			organizationId: "org_cli",
			grantedScopes: ["offline_access", "dedalus:cli"],
		}),
	);

	assert.equal(refreshed.accessToken, "refreshed-access-token");
	assert.equal(refreshed.refreshToken, "rotated-refresh-token");
	assert.equal(refreshed.accessTokenExpiresAt, 3_610_000);
	assert.equal(refreshed.userId, "user_cli");
	assert.equal(refreshed.organizationId, "org_cli");
	assert.equal(requests.length, 1);
	assert(requests[0]?.init);
	assert(requests[0].init.body instanceof URLSearchParams);
	const body = new URLSearchParams(String(requests[0].init.body));
	assert.equal(body.get("grant_type"), "refresh_token");
	assert.equal(body.get("refresh_token"), "original-refresh-token");
	assert.equal(requests[0].init.redirect, "manual");
});

test("invariant a malformed returned refresh token cannot masquerade as omission", async () => {
	const authProvider = createDedalusAuthProvider(commandMetadata(), {
		fetch: async () => Response.json(tokenResponse({ refresh_token: "malformed token" })),
	});

	await assert.rejects(
		authProvider.refresh(
			session({
				version: 2,
				issuer: "https://issuer.example.com",
				clientId: "client_cli",
				resource: "https://dcs.dedaluslabs.ai",
				accessToken: "expired-access-token",
				accessTokenExpiresAt: 1,
				refreshToken: "original-refresh-token",
				userId: "user_cli",
				organizationId: "org_cli",
				grantedScopes: ["offline_access", "dedalus:cli"],
			}),
		),
		(error) =>
			error instanceof OAuthError &&
			error.code === "invalid_token_response" &&
			error.status === 200,
	);
});

test("invariant OAuth revocation confirms refresh and access token revocation", async () => {
	const requests: { input: string; init: RequestInit | undefined }[] = [];
	const provider = createDedalusAuthProvider(commandMetadata(), {
		fetch: async (input, init) => {
			requests.push({ input: String(input), init });
			return new Response(null, { status: 200 });
		},
	});
	await provider.revoke(
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
	);

	assert.equal(requests.length, 2);
	assert.deepEqual(
		requests.map((request) => new URLSearchParams(String(request.init?.body)).get("token")),
		["refresh-token", "access-token"],
	);
	for (const request of requests) {
		assert(request.init);
		assert.equal(request.input, "https://issuer.example.com/oauth2/revoke");
		assert.equal(request.init.redirect, "manual");
	}
});
// @custom end
