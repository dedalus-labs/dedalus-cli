// @custom start
/** Validate token and user-info payloads against the requested public binding. */
import { z } from "zod";

import { err, ok, type Result } from "../../result.js";
import {
	ACCESS_TOKEN_SCHEMA,
	CLIENT_ID_SCHEMA,
	EXPIRY_SCHEMA,
	ISSUER_SCHEMA,
	ORGANIZATION_ID_SCHEMA,
	REFRESH_TOKEN_SCHEMA,
	RESOURCE_SCHEMA,
	SCOPES_SCHEMA,
	USER_ID_SCHEMA,
	type AuthMetadata,
	type OAuthSession,
} from "../schema.js";

const SCOPE_RESPONSE_SCHEMA = z
	.string()
	.max(32 * 257)
	.transform((value): readonly string[] => [...new Set(value.split(/\s+/u).filter(Boolean))])
	.pipe(SCOPES_SCHEMA);
const TOKEN_RESPONSE_SCHEMA = z.object({
	access_token: ACCESS_TOKEN_SCHEMA,
	refresh_token: REFRESH_TOKEN_SCHEMA,
	token_type: z.string().toLowerCase().pipe(z.literal("bearer")),
	expires_in: z.number().int().positive(),
	scope: SCOPE_RESPONSE_SCHEMA,
});
const USER_INFO_SCHEMA = z.object({
	iss: ISSUER_SCHEMA,
	sub: USER_ID_SCHEMA,
	org_id: ORGANIZATION_ID_SCHEMA,
	client_id: CLIENT_ID_SCHEMA,
	aud: RESOURCE_SCHEMA,
	scope: SCOPE_RESPONSE_SCHEMA,
	exp: z.number().int().positive().max(8_640_000_000_000),
});

/** Complete token grant returned by exchange or refresh. */
export type TokenSet = Pick<
	OAuthSession,
	"accessToken" | "refreshToken" | "accessTokenExpiresAt" | "grantedScopes"
>;
/** Verified identity carried by an active organization-bound grant. */
export type UserInfo = Pick<OAuthSession, "userId" | "organizationId">;
type PayloadFailure = {
	readonly code: "invalid_scope" | "invalid_token_response" | "invalid_userinfo_response";
	readonly cause?: Error;
};

/** Reject malformed token fields and unrequested grants without exposing token text. */
export const parseTokenSet = (
	payload: unknown,
	scopes: readonly string[],
	now: number,
): Result<TokenSet, PayloadFailure> => {
	const parsed = TOKEN_RESPONSE_SCHEMA.safeParse(payload);
	if (!parsed.success) {
		const code = parsed.error.issues.some((issue) => issue.path[0] === "scope")
			? "invalid_scope"
			: "invalid_token_response";
		return err({ code, cause: parsed.error });
	}
	if (!sameScopes(parsed.data.scope, scopes)) return err({ code: "invalid_scope" });
	const expiry = EXPIRY_SCHEMA.safeParse(now + parsed.data.expires_in * 1000);
	if (!Number.isSafeInteger(now) || now < 0 || !expiry.success || expiry.data <= now) {
		return err({ code: "invalid_token_response" });
	}
	return ok({
		accessToken: parsed.data.access_token,
		refreshToken: parsed.data.refresh_token,
		accessTokenExpiresAt: expiry.data,
		grantedScopes: parsed.data.scope,
	});
};

/** Prove that the returned identity belongs to this client and resource. */
export const parseUserInfo = (
	payload: unknown,
	metadata: AuthMetadata,
	now: number,
): Result<UserInfo, PayloadFailure> => {
	const parsed = USER_INFO_SCHEMA.safeParse(payload);
	if (!parsed.success) return err({ code: "invalid_userinfo_response", cause: parsed.error });
	const info = parsed.data;
	if (
		info.iss !== metadata.issuer ||
		info.client_id !== metadata.clientId ||
		info.aud !== metadata.resource ||
		info.exp * 1000 <= now
	) {
		return err({ code: "invalid_userinfo_response" });
	}
	if (!sameScopes(info.scope, metadata.scopes)) return err({ code: "invalid_scope" });
	return ok({ userId: info.sub, organizationId: info.org_id });
};

const sameScopes = (actual: readonly string[], expected: readonly string[]): boolean =>
	actual.length === expected.length && expected.every((scope) => actual.includes(scope));
// @custom end
