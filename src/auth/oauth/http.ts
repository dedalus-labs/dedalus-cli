// @custom start
/** Execute public OAuth HTTP operations and parse their endpoint contracts. */
import { z } from "zod";

import { OAuthError, type NetworkOAuthCode } from "../errors.js";
import type { AuthMetadata, OAuthSession } from "../schema.js";
import { parseTokenSet, parseUserInfo, type TokenSet, type UserInfo } from "./payload.js";
import { readOAuthJSON } from "./response.js";

export { OAuthError } from "../errors.js";
export type { TokenSet, UserInfo } from "./payload.js";

const REQUEST_TIMEOUT_MS = 30_000;
const TOKEN_LENGTH_MAX = 128 * 1024;
const OAUTH_ERROR_PAYLOAD_SCHEMA = z.object({ error: z.string() });

/** One exchange or refresh bound to validated public endpoint metadata. */
export type TokenRequest = {
	readonly metadata: AuthMetadata;
	readonly body: URLSearchParams;
	readonly request: typeof globalThis.fetch;
	readonly now: () => number;
	readonly operation: NetworkOAuthCode;
};

/** Exchange or refresh through the endpoint declared by the public API. */
export const requestTokenSet = async ({
	metadata,
	body,
	request,
	now,
	operation,
}: TokenRequest): Promise<TokenSet> => {
	let response: Response;
	try {
		response = await request(metadata.tokenURL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body,
			redirect: "manual",
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
	} catch (cause: unknown) {
		throw new OAuthError(operation, { cause, stage: "network" });
	}
	const payload = await readOAuthJSON(response);
	if (!response.ok) throw oauthHTTPError(response.status, payload);
	const parsed = parseTokenSet(payload, metadata.scopes, now());
	if (!parsed.ok) {
		throw new OAuthError(parsed.error.code, { cause: parsed.error.cause, status: response.status });
	}
	return parsed.value;
};

/** Fetch the active identity bound to this public issuer, client and resource. */
export const fetchUserInfo = async (
	metadata: AuthMetadata,
	accessToken: OAuthSession["accessToken"],
	dependencies: { readonly request: typeof globalThis.fetch; readonly now: () => number },
): Promise<UserInfo> => {
	let response: Response;
	try {
		response = await dependencies.request(metadata.userInfoURL, {
			headers: { Authorization: `Bearer ${accessToken}` },
			redirect: "manual",
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
	} catch (cause: unknown) {
		throw new OAuthError("userinfo_failed", { cause, stage: "network" });
	}
	const payload = await readOAuthJSON(response);
	if (!response.ok) throw oauthHTTPError(response.status, payload);
	const parsed = parseUserInfo(payload, metadata, dependencies.now());
	if (!parsed.ok) {
		throw new OAuthError(parsed.error.code, { cause: parsed.error.cause, status: response.status });
	}
	return parsed.value;
};

/** Retain only the printable OAuth error-code character set. */
export const oauthErrorCode = (value: string): string =>
	/^[\x20-\x21\x23-\x5b\x5d-\x7e]{1,256}$/u.test(value) ? value : "oauth_error";

/** Validate untrusted callback values before accepting them as protocol fields. */
export const opaqueValue = (value: unknown, lengthMax = TOKEN_LENGTH_MAX): string => {
	const parsed = z
		.string()
		.min(1)
		.max(lengthMax)
		.regex(/^[\x21-\x7e]+$/u)
		.safeParse(value);
	return parsed.success ? parsed.data : "";
};

const oauthHTTPError = (status: number, payload: unknown): OAuthError => {
	const parsed = OAUTH_ERROR_PAYLOAD_SCHEMA.safeParse(payload);
	const code = parsed.success ? oauthErrorCode(parsed.data.error) : "oauth_error";
	return new OAuthError(code, { stage: "provider", status });
};
// @custom end
