// @custom start
/** Stored OAuth lifecycle contracts. */
import assert from "node:assert/strict";
import test from "node:test";
import {
	accessTokenForCommand,
	status,
	login,
	CLIAuthWorkflowError,
} from "../../src/auth/workflow.js";
import { keyringCredentialStore } from "../../src/auth/credentials.js";
import { createDedalusAuthProvider } from "../../src/auth/oauth/index.js";
import {
	commandSession as session,
	commandMetadata,
	memoryStore as store,
	commandProvider as provider,
} from "./fixtures.js";

test("invariant workload overrides do not read or refresh OAuth storage", async () => {
	let storeConstructions = 0;
	let storedReads = 0;
	let refreshes = 0;
	const result = await status(
		{ flags: { apiKey: "override-key" }, environment: {} },
		() => {
			storeConstructions += 1;
			return {
				...store(session()),
				read: async () => {
					storedReads += 1;
					return session();
				},
			};
		},
		() =>
			provider({
				refresh: async (value) => {
					refreshes += 1;
					return value;
				},
			}),
		false,
	);

	assert.deepEqual(result, { source: "flag" });
	assert.equal(storeConstructions, 0);
	assert.equal(storedReads, 0);
	assert.equal(refreshes, 0);
});

test("invariant offline status returns local metadata without provider calls", async () => {
	let providerCalls = 0;
	const result = await status(
		{ flags: {}, environment: {} },
		() => store(session({ accessTokenExpiresAt: 1 })),
		() => {
			providerCalls += 1;
			throw new Error("provider configuration must not be read");
		},
		true,
	);

	assert.equal(result.source, "oauth_session");
	assert.equal(result.offline, true);
	assert.equal(result.session.organizationId, "org_cli");
	assert.equal(providerCalls, 0);
	assert.equal(JSON.stringify(result).includes("oauth-access-token"), false);
});

test("invariant refresh persists before any unrelated provider request", async () => {
	const existing = store(session({ accessTokenExpiresAt: 1 }));
	const requests: string[] = [];
	const authProvider = createDedalusAuthProvider(commandMetadata(), {
		now: () => 1_000,
		fetch: async (input) => {
			requests.push(String(input));
			if (!String(input).endsWith("/oauth2/token")) throw new Error("userinfo is unavailable");
			return Response.json({
				access_token: "refreshed-access-token",
				refresh_token: "oauth-refresh-token",
				expires_in: 3_600,
				scope: "offline_access dedalus:cli",
				token_type: "Bearer",
			});
		},
	});
	const token = await accessTokenForCommand(existing, authProvider, () => 1_000);

	assert.equal(token, "refreshed-access-token");
	assert.deepEqual(requests, ["https://issuer.example.com/oauth2/token"]);
	assert.deepEqual(
		await existing.read(),
		session({
			accessToken: "refreshed-access-token",
			accessTokenExpiresAt: 3_601_000,
		}),
	);
});

test("invariant concurrent commands refresh one expired session once", async () => {
	let refreshes = 0;
	const serializedStore = store(session({ accessTokenExpiresAt: 1 }));
	const authProvider = provider({
		refresh: async () => {
			refreshes += 1;
			return session({ accessToken: "refreshed-access-token", accessTokenExpiresAt: 5_000_000 });
		},
	});

	const tokens = await Promise.all([
		accessTokenForCommand(serializedStore, authProvider, () => 1_000),
		accessTokenForCommand(serializedStore, authProvider, () => 1_000),
	]);

	assert.deepEqual(tokens, ["refreshed-access-token", "refreshed-access-token"]);
	assert.equal(refreshes, 1);
});

test("invariant refresh cannot silently change user or organization", async () => {
	const original = session({ accessTokenExpiresAt: 1 });
	const existing = store(original);

	await assert.rejects(
		accessTokenForCommand(
			existing,
			provider({ refresh: async () => session({ userId: "other_user" }) }),
			() => 1_000,
		),
		(error) =>
			error instanceof CLIAuthWorkflowError && error.code === "cli_session_identity_changed",
	);
	assert.deepEqual(await existing.read(), original);
});

test("invariant an issuer migration requires a fresh login", async () => {
	await assert.rejects(
		accessTokenForCommand(store(session()), provider({ issuer: "https://dedalus-as.example.com" })),
		(error) =>
			error instanceof CLIAuthWorkflowError && error.code === "cli_session_provider_mismatch",
	);
});

test("invariant canonical issuer survives native record serialization", async () => {
	let serialized: string | null = null;
	const entry = {
		getPassword: async () => serialized,
		setPassword: async (value: string) => {
			serialized = value;
		},
		deleteCredential: async () => {
			const existed = serialized !== null;
			serialized = null;
			return existed;
		},
	};
	const firstStore = keyringCredentialStore(async () => entry);
	const configured = createDedalusAuthProvider({
		...commandMetadata(),
		issuer: "https://issuer.example.com/",
	});
	await login({
		provider: { ...configured, login: async () => session({ issuer: configured.issuer }) },
		store: firstStore,
	});

	const nextStore = keyringCredentialStore(async () => entry);
	const nextProvider = createDedalusAuthProvider({
		...commandMetadata(),
		issuer: "https://issuer.example.com/",
	});
	const result = await status(
		{ flags: {}, environment: {} },
		() => nextStore,
		() => nextProvider,
		true,
	);

	assert.equal(nextProvider.issuer, "https://issuer.example.com");
	assert.equal(result.source, "oauth_session");
	assert.equal(result.session.issuer, "https://issuer.example.com");
});
// @custom end
