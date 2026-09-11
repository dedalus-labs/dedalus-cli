// @custom start
/** Valid public-protocol fixtures with synthetic identities and credentials. */
import {
	AUTH_METADATA_SCHEMA,
	OAUTH_SESSION_SCHEMA,
	type AuthMetadata,
	type AuthMetadataInput,
	type OAuthSession,
	type OAuthSessionInput,
} from "../../src/auth/schema.js";

export const authMetadata = (overrides: Partial<AuthMetadataInput> = {}): AuthMetadata => {
	const issuer = overrides.issuer ?? "https://issuer.example.com";
	const resource = overrides.resource ?? "https://api.example.com";
	return AUTH_METADATA_SCHEMA.parse({
		issuer,
		resource,
		clientId: "dedalus-cli",
		authorizationURL: `${issuer}/oauth2/auth`,
		tokenURL: `${issuer}/oauth2/token`,
		userInfoURL: `${issuer}/oauth2/userinfo`,
		revocationURL: `${issuer}/oauth2/revoke`,
		scopes: ["offline_access", "dedalus:cli"],
		...overrides,
	});
};

export const authSession = (overrides: Partial<OAuthSessionInput> = {}): OAuthSession =>
	OAUTH_SESSION_SCHEMA.parse({
		version: 2,
		issuer: "https://issuer.example.com",
		clientId: "dedalus-cli",
		resource: "https://api.example.com",
		accessToken: "test-access",
		refreshToken: "test-refresh",
		accessTokenExpiresAt: 2_000_000_000_000,
		userId: "test-user",
		organizationId: "test-organization",
		grantedScopes: ["offline_access", "dedalus:cli"],
		...overrides,
	});

/** Stable command fixtures use synthetic credentials on the approved resource origin. */
export const commandSession = (overrides: Partial<OAuthSessionInput> = {}): OAuthSession =>
	authSession({
		issuer: "https://issuer.example.com",
		clientId: "client_cli",
		resource: "https://dcs.dedaluslabs.ai",
		accessToken: "oauth-access-token",
		refreshToken: "oauth-refresh-token",
		userId: "user_cli",
		organizationId: "org_cli",
		...overrides,
	});

/** Matching endpoint metadata for command sessions. */
export const commandMetadata = (overrides: Partial<AuthMetadataInput> = {}): AuthMetadata =>
	authMetadata({
		issuer: "https://issuer.example.com",
		clientId: "client_cli",
		resource: "https://dcs.dedaluslabs.ai",
		...overrides,
	});
// @custom end
