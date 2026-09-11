// @custom start
/** Read bounded OAuth response bytes without losing transport or cleanup failures. */
import { OAuthError } from "../errors.js";

const RESPONSE_BYTES_MAX = 512 * 1024;

/** Decode untrusted JSON for the endpoint-specific schema. */
export const readOAuthJSON = async (response: Response): Promise<unknown> => {
	const raw = await readResponseText(response);
	try {
		return JSON.parse(raw);
	} catch (cause: unknown) {
		throw new OAuthError("invalid_json_response", { cause, status: response.status });
	}
};

const readResponseText = async (response: Response): Promise<string> => {
	if (responseTooLarge(response)) {
		const failure = new OAuthError("response_too_large", { status: response.status });
		try {
			await response.body?.cancel();
		} catch (cause: unknown) {
			throw new AggregateError(
				[failure, new OAuthError("response_cleanup_failed", { cause })],
				"OAuth response rejection and cleanup failed",
			);
		}
		throw failure;
	}
	if (response.body === null) return "";
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	// Stream implementations may reject with any JavaScript value.
	const failures: unknown[] = [];
	try {
		while (true) {
			const next = await reader.read();
			if (next.done) break;
			total += next.value.byteLength;
			if (total > RESPONSE_BYTES_MAX)
				throw new OAuthError("response_too_large", { status: response.status });
			chunks.push(next.value);
		}
	} catch (cause: unknown) {
		failures.push(
			cause instanceof OAuthError ? cause : new OAuthError("response_read_failed", { cause }),
		);
		try {
			await reader.cancel();
		} catch (cause: unknown) {
			failures.push(new OAuthError("response_cleanup_failed", { cause }));
		}
	}
	try {
		reader.releaseLock();
	} catch (cause: unknown) {
		failures.push(new OAuthError("response_cleanup_failed", { cause }));
	}
	if (failures.length === 1) throw failures[0];
	if (failures.length > 1) throw new AggregateError(failures, "OAuth response cleanup failed");
	try {
		return decodeChunks(chunks, total);
	} catch (cause: unknown) {
		throw new OAuthError("invalid_response_encoding", { cause, status: response.status });
	}
};

const responseTooLarge = (response: Response): boolean => {
	const length = response.headers.get("content-length");
	return length !== null && Number(length) > RESPONSE_BYTES_MAX;
};

const decodeChunks = (chunks: readonly Uint8Array[], length: number): string => {
	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
};
// @custom end
