// @custom start
// Preserve each OAuth transport and cleanup failure without exposing credentials.
import assert from "node:assert/strict";
import test from "node:test";
import { requestTokenSet } from "../../src/auth/oauth/http.js";
import { authMetadata } from "./fixtures.js";

const tokenRequest = (response: Response) =>
	requestTokenSet({
		metadata: authMetadata(),
		body: new URLSearchParams(),
		request: async () => response,
		now: Date.now,
		operation: "token_exchange_failed",
	});

test("OAuth response read failures retain their original cause", async () => {
	const cause = new Error("stream failed");
	const body = new ReadableStream({
		start(controller) {
			controller.error(cause);
		},
	});
	await assert.rejects(
		tokenRequest(new Response(body)),
		(error) =>
			error instanceof AggregateError &&
			error.errors.every((failure: unknown) => failure instanceof Error && failure.cause === cause),
	);
});

test("OAuth malformed JSON retains the parser failure", async () => {
	await assert.rejects(
		tokenRequest(new Response("{")),
		(error) => error instanceof Error && error.cause instanceof SyntaxError,
	);
});

test("OAuth oversize rejection preserves cancellation failure", async () => {
	const cause = new Error("cancel failed");
	const body = new ReadableStream({
		cancel() {
			throw cause;
		},
	});
	await assert.rejects(
		tokenRequest(new Response(body, { headers: { "content-length": "524289" } })),
		(error) =>
			error instanceof AggregateError &&
			error.errors.some((failure: unknown) => failure instanceof Error && failure.cause === cause),
	);
});
// @custom end
