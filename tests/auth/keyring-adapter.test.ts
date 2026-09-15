// @custom start
// Require native credential storage and preserve storage failure causes.
import assert from "node:assert/strict";
import test from "node:test";
import lockfile from "proper-lockfile";
import { CredentialStorageError, keyringCredentialStore } from "../../src/auth/credentials.js";

import { commandSession as session } from "./fixtures.js";

test("invariant native keyring failures retain their causes", async () => {
	const failure = new Error("native keyring unavailable");
	const store = keyringCredentialStore(async () => ({
		getPassword: async () => {
			throw failure;
		},
		setPassword: async () => {
			throw failure;
		},
		deleteCredential: async () => {
			throw failure;
		},
	}));
	for (const action of [() => store.read(), () => store.write(session()), () => store.remove()]) {
		await assert.rejects(
			action,
			(error) =>
				error instanceof CredentialStorageError &&
				error.code === "storage_unavailable" &&
				error.cause === failure,
		);
	}
});

test("invariant releasing a lifecycle lock preserves an earlier operation failure", async (context) => {
	const operationFailure = new Error("credential operation failed");
	const releaseFailure = new Error("lock release failed");
	context.mock.method(lockfile, "lock", async () => async () => {
		throw releaseFailure;
	});
	await assert.rejects(
		keyringCredentialStore().withLifecycleLock(async () => {
			throw operationFailure;
		}),
		(error) =>
			error instanceof AggregateError &&
			error.errors.includes(operationFailure) &&
			error.errors.some(
				(failure) => failure instanceof CredentialStorageError && failure.cause === releaseFailure,
			),
	);
});
// @custom end
