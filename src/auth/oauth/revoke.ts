// @custom start
/** Revoke both parts of a token grant before reporting success. */
import { OAuthError } from "../errors.js";
import type { TokenSet } from "./payload.js";
import type { AuthMetadata } from "../schema.js";

const REQUEST_TIMEOUT_MS = 30_000;

/** Attempt both token revocations and preserve every failure before returning. */
export const revokeTokenSet = async (
	metadata: AuthMetadata,
	tokens: Pick<TokenSet, "accessToken" | "refreshToken">,
	request: typeof globalThis.fetch,
): Promise<void> => {
	const failures: unknown[] = [];
	for (const [token, hint] of [
		[tokens.refreshToken, "refresh_token"],
		[tokens.accessToken, "access_token"],
	] as const) {
		try {
			await revokeToken(metadata, { token, hint }, request);
		} catch (error: unknown) {
			failures.push(error);
		}
	}
	if (failures.length === 1) throw failures[0];
	if (failures.length > 1) throw new AggregateError(failures, "Token revocation failed");
};

const revokeToken = async (
	metadata: AuthMetadata,
	token: { readonly token: string; readonly hint: string },
	request: typeof globalThis.fetch,
): Promise<void> => {
	let response: Response;
	try {
		response = await request(metadata.revocationURL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: metadata.clientId,
				token: token.token,
				token_type_hint: token.hint,
			}),
			redirect: "manual",
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
	} catch (cause: unknown) {
		throw new OAuthError("revocation_failed", { cause, stage: "network" });
	}
	const rejected = new OAuthError("revocation_failed", {
		stage: "provider",
		status: response.status,
	});
	try {
		await response.body?.cancel();
	} catch (cause: unknown) {
		const cleanup = new OAuthError("response_cleanup_failed", { cause });
		if (response.status !== 200) {
			throw new AggregateError([rejected, cleanup], "Revocation and cleanup failed");
		}
		throw cleanup;
	}
	if (response.status !== 200) throw rejected;
};
// @custom end
