// @custom start
/** Validate untrusted session fields before they enter the auth workflow. */
import { z } from "zod";

const TOKEN_LENGTH_MAX = 128 * 1024;
const IDENTIFIER_LENGTH_MAX = 1024;
const ORIGIN_LENGTH_MAX = 4 * 1024;
/** Wire version shared by native records and their keyring account namespace. */
export const SESSION_VERSION = 2;

const OPAQUE_TEXT = z
	.string()
	.min(1)
	.max(TOKEN_LENGTH_MAX)
	.regex(/^[\x21-\x7e]+$/u);
const IDENTIFIER = OPAQUE_TEXT.max(IDENTIFIER_LENGTH_MAX);

const HTTPS_ORIGIN = z
	.string()
	.max(ORIGIN_LENGTH_MAX)
	.refine((value) => {
		if (!URL.canParse(value)) return false;
		const url = new URL(value);
		return (
			value === value.trim() &&
			url.protocol === "https:" &&
			url.username === "" &&
			url.password === "" &&
			url.search === "" &&
			url.hash === "" &&
			url.pathname === "/"
		);
	})
	.transform((value) => new URL(value).origin);

/** Public HTTPS origin normalized before issuer comparison. */
export const ISSUER_SCHEMA = HTTPS_ORIGIN.brand<"Issuer">();
/** Public HTTPS API origin permitted by the session. */
export const RESOURCE_SCHEMA = HTTPS_ORIGIN.brand<"Resource">();
/** Validated OAuth client identity, distinct from user and organization IDs. */
export const CLIENT_ID_SCHEMA = IDENTIFIER.brand<"ClientId">();
/** Opaque user identity validated before persistence. */
export const USER_ID_SCHEMA = IDENTIFIER.brand<"UserId">();
/** Opaque organization identity validated before persistence. */
export const ORGANIZATION_ID_SCHEMA = IDENTIFIER.brand<"OrganizationId">();
/** Printable, bounded access-token text with no normalization. */
export const ACCESS_TOKEN_SCHEMA = OPAQUE_TEXT.brand<"AccessToken">();
/** Printable, bounded refresh-token text with no normalization. */
export const REFRESH_TOKEN_SCHEMA = OPAQUE_TEXT.brand<"RefreshToken">();
/** Positive epoch milliseconds within JavaScript's date range. */
export const EXPIRY_SCHEMA = z
	.number()
	.int()
	.positive()
	.max(8_640_000_000_000_000)
	.brand<"ExpiryMilliseconds">();
/** A bounded, nonempty set of distinct permission names. */
export const SCOPES_SCHEMA = z
	.array(OPAQUE_TEXT.max(256))
	.min(1)
	.max(32)
	.refine((scopes) => new Set(scopes).size === scopes.length)
	.readonly();

const OAUTH_ENDPOINT = z
	.url()
	.refine((value) => {
		const url = new URL(value);
		return (
			url.protocol === "https:" &&
			url.username === "" &&
			url.password === "" &&
			url.search === "" &&
			url.hash === ""
		);
	})
	.brand<"OAuthEndpoint">();

/** Public protocol locations are generated from the OpenAPI authentication scheme. */
export const AUTH_METADATA_SCHEMA = z
	.object({
		issuer: ISSUER_SCHEMA,
		clientId: CLIENT_ID_SCHEMA,
		resource: RESOURCE_SCHEMA,
		authorizationURL: OAUTH_ENDPOINT,
		tokenURL: OAUTH_ENDPOINT,
		userInfoURL: OAUTH_ENDPOINT,
		revocationURL: OAUTH_ENDPOINT,
		scopes: SCOPES_SCHEMA,
	})
	.strict()
	.refine((metadata) =>
		[
			metadata.authorizationURL,
			metadata.tokenURL,
			metadata.userInfoURL,
			metadata.revocationURL,
		].every((endpoint) => new URL(endpoint).origin === metadata.issuer),
	)
	.readonly();

/** Validated public endpoints and grant configuration. */
export type AuthMetadata = z.infer<typeof AUTH_METADATA_SCHEMA>;
/** Unbranded configuration accepted by the metadata validator. */
export type AuthMetadataInput = z.input<typeof AUTH_METADATA_SCHEMA>;

/** Version two stores only the public protocol binding and session identity. */
export const OAUTH_SESSION_SCHEMA = z
	.object({
		version: z.literal(SESSION_VERSION),
		issuer: ISSUER_SCHEMA,
		clientId: CLIENT_ID_SCHEMA,
		resource: RESOURCE_SCHEMA,
		accessToken: ACCESS_TOKEN_SCHEMA,
		accessTokenExpiresAt: EXPIRY_SCHEMA,
		refreshToken: REFRESH_TOKEN_SCHEMA,
		userId: USER_ID_SCHEMA,
		organizationId: ORGANIZATION_ID_SCHEMA,
		grantedScopes: SCOPES_SCHEMA,
	})
	.strict()
	.readonly();

/** Complete validated state persisted for one organization-bound login. */
export type OAuthSession = z.infer<typeof OAUTH_SESSION_SCHEMA>;
/** Unbranded session data accepted by the session validator. */
export type OAuthSessionInput = z.input<typeof OAUTH_SESSION_SCHEMA>;

/** The keyring wire format is parsed once before conversion to workflow fields. */
export const STORED_SESSION_SCHEMA = z
	.object({
		version: z.literal(SESSION_VERSION),
		issuer: ISSUER_SCHEMA,
		client_id: CLIENT_ID_SCHEMA,
		resource: RESOURCE_SCHEMA,
		access_token: ACCESS_TOKEN_SCHEMA,
		access_token_expires_at: EXPIRY_SCHEMA,
		refresh_token: REFRESH_TOKEN_SCHEMA,
		user_id: USER_ID_SCHEMA,
		org_id: ORGANIZATION_ID_SCHEMA,
		granted_scopes: SCOPES_SCHEMA,
	})
	.strict()
	.transform(
		(stored): OAuthSession => ({
			version: stored.version,
			issuer: stored.issuer,
			clientId: stored.client_id,
			resource: stored.resource,
			accessToken: stored.access_token,
			accessTokenExpiresAt: stored.access_token_expires_at,
			refreshToken: stored.refresh_token,
			userId: stored.user_id,
			organizationId: stored.org_id,
			grantedScopes: stored.granted_scopes,
		}),
	);
// @custom end
