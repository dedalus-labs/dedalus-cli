// @custom start
/** Public endpoint and stored-session boundaries reject invalid identity fields. */
import assert from "node:assert/strict";
import test from "node:test";
import { AUTH_METADATA_SCHEMA, OAUTH_SESSION_SCHEMA } from "../../src/auth/schema.js";
import { authMetadata, authSession } from "./fixtures.js";

test("invariant every public OAuth endpoint belongs to its declared issuer", () => {
	const metadata = authMetadata();
	assert.deepEqual(AUTH_METADATA_SCHEMA.parse(metadata), metadata);
	for (const field of ["authorizationURL", "tokenURL", "userInfoURL", "revocationURL"]) {
		assert.equal(
			AUTH_METADATA_SCHEMA.safeParse({ ...metadata, [field]: "https://other.example.com" }).success,
			false,
		);
	}
});

test("invariant stored sessions contain bounded opaque tokens and printable expiry", () => {
	const session = authSession();
	assert.deepEqual(OAUTH_SESSION_SCHEMA.parse(session), session);
	for (const fields of [
		{ version: 1 },
		{ accessToken: "" },
		{ accessToken: "token\nforged" },
		{ refreshToken: "token with spaces" },
		{ accessTokenExpiresAt: 0 },
		{ accessTokenExpiresAt: 8_640_000_000_000_001 },
		{ grantedScopes: ["scope", "scope"] },
		{ issuer: "http://issuer.example.com" },
		{ resource: "https://api.example.com/path" },
		{ unexpected: true },
	])
		assert.equal(OAUTH_SESSION_SCHEMA.safeParse({ ...session, ...fields }).success, false);
});
// @custom end
