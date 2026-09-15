// @custom start
// Check local credential storage and serialization.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { EventEmitter, once } from "node:events";
import { serializeOAuthSession } from "../../src/auth/credential-contract.js";

import {
	CredentialStorageError,
	withLifecycleLock,
	keyringCredentialStore,
	resolveCredential,
} from "../../src/auth/credentials.js";

import { commandSession as session } from "./fixtures.js";

test("invariant workload flags win without reading lower-priority sources", async () => {
	let storedReads = 0;
	const credential = await resolveCredential({
		flags: { apiKey: "flag-key" },
		environment: { DEDALUS_API_KEY: "environment-key" },
		storedAccessToken: async () => {
			storedReads += 1;
			return "oauth-token";
		},
	});

	assert.deepEqual(credential, {
		value: "flag-key",
		source: "flag",
		transport: "bearer",
	});
	assert.equal(storedReads, 0);
});

test("invariant custom headers cannot replace the selected credential", async () => {
	for (const header of ["Authorization: Bearer bypass-token", "x-API-key: bypass-token"]) {
		await assert.rejects(
			resolveCredential({
				flags: { apiKey: "selected-key" },
				environment: { DEDALUS_CUSTOM_HEADERS: header },
				storedAccessToken: async () => "stored-token",
			}),
			(error) => error instanceof CredentialStorageError && error.code === "unsupported_credential",
		);
	}
});

test("invariant a workload flag ignores a lower-priority Bearer environment override", async () => {
	let storedReads = 0;
	const credential = await resolveCredential({
		flags: { apiKey: "flag-key" },
		environment: { DEDALUS_BEARER_AUTH: "unsupported-lower-priority-token" },
		storedAccessToken: async () => {
			storedReads += 1;
			return "oauth-token";
		},
	});

	assert.deepEqual(credential, {
		value: "flag-key",
		source: "flag",
		transport: "bearer",
	});
	assert.equal(storedReads, 0);
});

test("invariant workload environment credentials win without reading OAuth storage", async () => {
	let storedReads = 0;
	const credential = await resolveCredential({
		flags: {},
		environment: { DEDALUS_X_API_KEY: "environment-key" },
		storedAccessToken: async () => {
			storedReads += 1;
			return "oauth-token";
		},
	});

	assert.deepEqual(credential, {
		value: "environment-key",
		source: "environment",
		transport: "x-api-key",
	});
	assert.equal(storedReads, 0);
});

test("invariant credential sources never merge within one priority", async () => {
	await assert.rejects(
		resolveCredential({
			flags: { apiKey: "first-key", xApiKey: "second-key" },
			environment: {},
			storedAccessToken: async () => null,
		}),
		(error) => error instanceof CredentialStorageError && error.code === "ambiguous_credential",
	);
});

test("invariant a stored OAuth token is selected only without a workload override", async () => {
	assert.deepEqual(
		await resolveCredential({
			flags: {},
			environment: {},
			storedAccessToken: async () => "oauth-token",
		}),
		{
			value: "oauth-token",
			source: "oauth_session",
			transport: "bearer",
		},
	);
});

test("invariant credential lifecycle mutations are serialized across callers", async (context) => {
	const root = await mkdtemp(join(tmpdir(), "dedalus-credentials-"));
	context.after(() => rm(root, { recursive: true, force: true }));
	const credentialPath = join(root, "credentials");
	const firstStore = {
		withLifecycleLock: <T>(operation: () => Promise<T>) =>
			withLifecycleLock(credentialPath, operation),
	};
	const secondStore = {
		withLifecycleLock: <T>(operation: () => Promise<T>) =>
			withLifecycleLock(credentialPath, operation),
	};
	const events: string[] = [];
	const entered = new EventEmitter();
	const released = new EventEmitter();
	const firstEntered = once(entered, "ready");
	const holdFirst = once(released, "ready");

	const first = firstStore.withLifecycleLock(async () => {
		events.push("first:start");
		entered.emit("ready");
		await holdFirst;
		events.push("first:end");
	});
	await firstEntered;
	const second = secondStore.withLifecycleLock(async () => {
		events.push("second");
	});
	await new Promise((resolve) => setImmediate(resolve));

	assert.deepEqual(events, ["first:start"]);
	released.emit("ready");
	await Promise.all([first, second]);
	assert.deepEqual(events, ["first:start", "first:end", "second"]);
});

test("invariant legacy raw-key storage cannot be interpreted as an OAuth session", async () => {
	let stored = JSON.stringify({ version: 1, current: "legacy-api-key" });
	const store = keyringCredentialStore(async () => ({
		getPassword: async () => stored,
		setPassword: async (value) => {
			stored = value;
		},
		deleteCredential: async () => true,
	}));

	await assert.rejects(
		store.read(),
		(error) => error instanceof CredentialStorageError && error.code === "invalid_credential",
	);
});

test("invariant the keyring adapter owns OAuth session read, write, and removal", async () => {
	let stored: string | undefined;
	const store = keyringCredentialStore(async () => ({
		getPassword: async () => stored,
		setPassword: async (value) => {
			stored = value;
		},
		deleteCredential: async () => {
			const existed = stored !== undefined;
			stored = undefined;
			return existed;
		},
	}));

	assert.equal(await store.read(), null);
	await store.write(session());
	assert.deepEqual(await store.read(), session());
	assert.equal(await store.remove(), true);
	assert.equal(await store.read(), null);
});

test("invariant a missing native keyring entry is not a corrupt credential", async () => {
	const store = keyringCredentialStore(async () => ({
		getPassword: async () => null,
		setPassword: async () => {},
		deleteCredential: async () => false,
	}));

	assert.equal(await store.read(), null);
});

test("invariant malformed or oversized keyring records fail closed", async () => {
	for (const raw of ["", " ".repeat(513 * 1024)]) {
		const store = keyringCredentialStore(async () => ({
			getPassword: async () => raw,
			setPassword: async () => {},
			deleteCredential: async () => false,
		}));
		await assert.rejects(
			store.read(),
			(error) => error instanceof CredentialStorageError && error.code === "invalid_credential",
		);
	}
});

test("invariant stored expiry must be printable as an ISO timestamp", async () => {
	const invalid = serializeOAuthSession(session()).replace("2000000000000", "8700000000000000");
	const store = keyringCredentialStore(async () => ({
		getPassword: async () => invalid,
		setPassword: async () => {},
		deleteCredential: async () => false,
	}));
	await assert.rejects(store.read(), { code: "invalid_credential" });
});

// @custom end
