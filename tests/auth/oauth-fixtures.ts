// @custom start
/** Synthetic public OAuth responses and real loopback test helpers. */
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { DedalusOAuthAttempt } from "../../src/auth/oauth/index.js";

// Overrides intentionally model malformed upstream JSON.
export const tokenResponse = (
	overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
	access_token: "oauth-access-token",
	refresh_token: "oauth-refresh-token",
	expires_in: 86_400,
	scope: "offline_access dedalus:cli",
	token_type: "Bearer",
	...overrides,
});

// Overrides intentionally model malformed upstream JSON.
export const userInfo = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
	iss: "https://issuer.example.com",
	client_id: "client_cli",
	aud: "https://dcs.dedaluslabs.ai",
	scope: "offline_access dedalus:cli",
	exp: 2_000_000_000,
	sub: "user_cli",
	org_id: "org_cli",
	...overrides,
});

/** Complete the real loopback request and verify its browser page contains no grant. */
export const finishAuthorization = async (
	attempt: DedalusOAuthAttempt,
	authorization: URL,
): Promise<void> => {
	const callback = new URL(attempt.redirectURI);
	callback.searchParams.set("code", "authorization-code");
	callback.searchParams.set("iss", authorization.origin);
	callback.searchParams.set(
		"state",
		authorization.searchParams.get("state") ?? assert.fail("Missing OAuth state"),
	);
	const response = await fetch(callback);
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
	assert.equal(response.headers.get("cache-control"), "no-store");
	const page = await response.text();
	assert.match(page, /<!doctype html>/u);
	assert.match(page, /Authorization received\./u);
	assert.match(page, /Return to your terminal to check the login result/u);
	assert.match(page, /close this window/u);
	assert(!page.includes("authorization-code"));
	assert(!page.includes(callback.searchParams.get("state") ?? assert.fail("Missing state")));
};

/** Listen only on an OS-assigned loopback port. */
export const listen = (server: Server): Promise<void> =>
	new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});

/** Close the exact test server after its scenario. */
export const close = (server: Server): Promise<void> =>
	new Promise((resolve, reject) => {
		server.close((error) => {
			if (error) reject(error);
			else resolve();
		});
	});

/** Return the address assigned to the running loopback server. */
export const serverURL = (server: Server): string => {
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	return `http://127.0.0.1:${address.port}`;
};
// @custom end
