// @custom start
/** Stored OAuth lifecycle contracts. */
import assert from "node:assert/strict";
import test from "node:test";
import { logout } from "../../src/auth/workflow.js";
import { CredentialStorageError } from "../../src/auth/credentials.js";
import {
	commandSession as session,
	memoryStore as store,
	commandProvider as provider,
} from "./fixtures.js";

test("invariant logout removes local tokens after confirmed provider revocation", async () => {
	const existing = store(session());
	assert.deepEqual(await logout(existing, () => provider()), {
		status: "logged_out",
	});
	assert.equal(await existing.read(), null);
});

test("invariant failed revocation preserves its error and credentials for retry", async () => {
	const existing = store(session());
	const failure = new Error("offline");
	await assert.rejects(
		logout(existing, () =>
			provider({
				revoke: async () => {
					throw failure;
				},
			}),
		),
		(error) => error === failure,
	);
	assert.deepEqual(await existing.read(), session());
});

test("invariant logout preserves credentials when provider configuration is unavailable", async () => {
	const existing = store(session());
	const failure = new Error("invalid provider configuration");
	await assert.rejects(
		logout(existing, () => {
			throw failure;
		}),
		(error) => error === failure,
	);
	assert.deepEqual(await existing.read(), session());
});

test("invariant logout never sends a session to a different provider", async () => {
	const existing = store(session());
	let revocations = 0;
	const otherProvider = provider({
		issuer: "https://dedalus-as.example.com",
		clientId: "client_v2",
		resource: "https://dcs.dedaluslabs.ai",
		revoke: async () => {
			revocations += 1;
		},
	});

	await assert.rejects(
		logout(existing, () => otherProvider),
		{
			code: "cli_session_provider_mismatch",
		},
	);
	assert.equal(revocations, 0);
	assert.deepEqual(await existing.read(), session());
});

test("invariant logout is idempotent without a local OAuth session", async () => {
	assert.deepEqual(await logout(store(), () => provider()), {
		status: "not_logged_in",
	});
});

test("invariant logout cannot claim revocation of an unreadable credential", async () => {
	let removed = false;
	const obsolete = {
		...store(),
		read: async () => {
			throw new CredentialStorageError("invalid_credential");
		},
		remove: async () => {
			removed = true;
			return true;
		},
	};

	await assert.rejects(
		logout(obsolete, () => provider()),
		{ code: "invalid_credential" },
	);
	assert.equal(removed, false);
});

test("invariant logout verifies local absence after acknowledged deletion", async () => {
	for (const removed of [false, true]) {
		await assert.rejects(
			logout({ ...store(session()), remove: async () => removed }, () => provider()),
			{ code: "cli_credential_store_failed" },
		);
	}
});

test("invariant logout preserves cleanup and verification failures", async () => {
	const failure = new Error("keyring locked");
	await assert.rejects(
		logout(
			{
				...store(session()),
				remove: async () => {
					throw failure;
				},
			},
			() => provider(),
		),
		(error) => error === failure,
	);

	let removed = false;
	await assert.rejects(
		logout(
			{
				...store(session()),
				read: async () => {
					if (removed) throw failure;
					return session();
				},
				remove: async () => {
					removed = true;
					return true;
				},
			},
			() => provider(),
		),
		(error) => error === failure,
	);
});
// @custom end
