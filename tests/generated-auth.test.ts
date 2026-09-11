// @custom start
// Prove OAuth metadata is derived only from the approved public API contract.
import assert from "node:assert/strict";
import test from "node:test";
import { generateAuthMetadata } from "../scripts/generate-auth.js";

const ORIGIN = "https://dcs.dedaluslabs.ai";
const SCHEME = {
	type: "oauth2",
	flows: {
		authorizationCode: {
			authorizationUrl: `${ORIGIN}/oauth2/auth`,
			tokenUrl: `${ORIGIN}/oauth2/token`,
			refreshUrl: `${ORIGIN}/oauth2/token`,
			scopes: { "dedalus:cli": "CLI", offline_access: "Refresh" },
		},
	},
	"x-issuer": ORIGIN,
	"x-userinfo-url": `${ORIGIN}/oauth2/userinfo`,
	"x-revocation-url": `${ORIGIN}/oauth2/revoke`,
	"x-client-id": "dedalus-cli",
};
const DOCUMENT = {
	servers: [{ url: ORIGIN }],
	components: { securitySchemes: { cliOAuth: SCHEME } },
};

test("invariant metadata generation is deterministic and strips unrelated private fields", () => {
	const output = generateAuthMetadata(DOCUMENT);
	assert.equal(output, generateAuthMetadata({ ...DOCUMENT, unused: "not emitted" }));
	assert.ok(output.includes('"issuer": "https://dcs.dedaluslabs.ai"'));
	assert.ok(output.includes("export const PUBLIC_AUTH"));
	assert.ok(!output.includes("not emitted"));
});

test("invariant metadata generation fails closed on absent or unapproved contracts", () => {
	for (const value of [
		{},
		{ ...DOCUMENT, servers: [{ url: "https://example.com" }] },
		{
			...DOCUMENT,
			components: {
				securitySchemes: { cliOAuth: { ...SCHEME, "x-issuer": "https://example.com" } },
			},
		},
	])
		assert.throws(() => generateAuthMetadata(value), /public OAuth contract is invalid/);
});
// @custom end
