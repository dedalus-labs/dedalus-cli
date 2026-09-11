// @custom start
/** A real loopback callback yields its outcome only after closing the listener. */
import assert from "node:assert/strict";
import test from "node:test";
import { OAuthError } from "../../src/auth/errors.js";
import { listenForOAuthCallback } from "../../src/auth/oauth/callback.js";

test("invariant a valid callback survives bad state and closes before returning its code", async (context) => {
	const listener = await listenForOAuthCallback("https://issuer.example.com", "expected-state");
	context.after(listener.cancel);
	listener.startTimeout(5_000);
	const callback = new URL(listener.redirectURI);
	assert.equal(callback.hostname, "127.0.0.1");
	callback.search = new URLSearchParams({
		state: "wrong-state",
		iss: "https://issuer.example.com",
		code: "private-code",
	}).toString();
	const rejected = await fetch(callback);
	assert.equal(rejected.status, 400);
	await rejected.text();
	callback.searchParams.set("state", "expected-state");
	const accepted = await fetch(callback);
	assert.equal(accepted.status, 200);
	assert.doesNotMatch(await accepted.text(), /private-code|expected-state/u);
	assert.deepEqual(await listener.result, { code: "private-code" });
	await assert.rejects(fetch(listener.redirectURI));
});

test("invariant cancellation closes the callback before returning a terminal failure", async (context) => {
	const listener = await listenForOAuthCallback("https://issuer.example.com", "expected-state");
	context.after(listener.cancel);
	listener.startTimeout(5_000);
	await listener.cancel();
	const outcome = await listener.result;
	assert.ok("error" in outcome);
	assert.ok(outcome.error instanceof OAuthError);
	assert.equal(outcome.error.code, "login_cancelled");
	await assert.rejects(fetch(listener.redirectURI));
});
// @custom end
