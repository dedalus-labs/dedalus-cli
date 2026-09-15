// @custom start
// Exercise the host's credential store with an isolated disposable entry.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { AsyncEntry } from "@napi-rs/keyring";

test(
	"invariant native credential storage persists and removes an isolated secret",
	{
		skip: process.env["CLI_NATIVE_KEYRING_TEST"] !== "1",
	},
	async () => {
		const entry = new AsyncEntry(`dedalus-cli-test-${randomUUID()}`, "test-only");
		let written = false;
		try {
			await entry.setPassword("disposable-test-value");
			written = true;
			assert.equal(await entry.getPassword(), "disposable-test-value");
			assert.equal(await entry.deleteCredential(), true);
			written = false;
			assert.equal(await entry.getPassword(), null);
		} finally {
			if (written) await entry.deleteCredential();
		}
	},
);
// @custom end
