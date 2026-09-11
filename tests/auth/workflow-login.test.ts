// @custom start
/** Stored OAuth lifecycle contracts. */
import assert from "node:assert/strict";
import test from "node:test";
import { login, CLIAuthWorkflowError } from "../../src/auth/workflow.js";
import {
	commandSession as session,
	memoryStore as store,
	commandProvider as provider,
} from "./fixtures.js";

test("invariant an existing OAuth login performs no provider work", async () => {
	const events: string[] = [];
	const existing = store(session());
	const result = await login({
		provider: provider({
			login: async () => {
				events.push("login");
				throw new Error("must not run");
			},
		}),
		store: existing,
	});

	assert.equal(result.status, "already_signed_in");
	assert.equal(result.session.organizationId, "org_cli");
	assert.deepEqual(events, []);
	assert.deepEqual(await existing.read(), session());
});

test("invariant login refreshes an existing grant instead of abandoning its tokens", async () => {
	const events: string[] = [];
	const expired = store(
		session({
			accessToken: "expired-access-token",
			accessTokenExpiresAt: 1_000,
			refreshToken: "expired-refresh-token",
		}),
	);
	const fresh = session({ accessToken: "fresh-access-token", refreshToken: "fresh-refresh-token" });

	const result = await login({
		provider: provider({
			refresh: async () => {
				events.push("refresh");
				return fresh;
			},
		}),
		store: expired,
		now: () => 2_000,
	});

	assert.equal(result.status, "logged_in");
	assert.deepEqual(events, ["refresh"]);
	assert.deepEqual(await expired.read(), fresh);
});

test("invariant login durably stores the OAuth token set without returning secrets", async () => {
	const events: string[] = [];
	const empty = store();
	const result = await login({
		provider: provider({
			login: async () => {
				events.push("provider");
				return session();
			},
		}),
		store: {
			...empty,
			write: async (value) => {
				events.push("store");
				await empty.write(value);
			},
		},
	});

	assert.equal(result.status, "logged_in");
	assert.equal(JSON.stringify(result).includes("oauth-access-token"), false);
	assert.equal(JSON.stringify(result).includes("oauth-refresh-token"), false);
	assert.deepEqual(await empty.read(), session());
	assert.deepEqual(events, ["provider", "store"]);
});

test("invariant login success is not reported after a failed durable write", async () => {
	let revocations = 0;
	await assert.rejects(
		login({
			provider: provider({
				revoke: async () => {
					revocations++;
				},
			}),
			store: {
				...store(),
				write: async () => {
					throw new Error("keychain locked");
				},
			},
		}),
		(error) =>
			error instanceof CLIAuthWorkflowError && error.code === "cli_credential_store_failed",
	);
	assert.equal(revocations, 1);
});
// @custom end
