// @custom start
/** Public OAuth session and provider I/O contracts for the CLI. */
import type { AuthMetadata, OAuthSession } from "./schema.js";

export type { OAuthSession } from "./schema.js";

export { OAuthError } from "./errors.js";

/** Provider operations share one validated public issuer, client, and resource binding. */
export type AuthProvider = Pick<AuthMetadata, "issuer" | "clientId" | "resource"> & {
	readonly login: () => Promise<OAuthSession>;
	readonly refresh: (session: OAuthSession) => Promise<OAuthSession>;
	readonly revoke: (session: OAuthSession) => Promise<void>;
};

/** Session identity fields safe to show without the token pair. */
export type OAuthSessionMetadata = Omit<OAuthSession, "accessToken" | "refreshToken" | "version">;

/** Project only the user-visible session metadata. */
export const oauthSessionMetadata = (session: OAuthSession): OAuthSessionMetadata => ({
	issuer: session.issuer,
	clientId: session.clientId,
	resource: session.resource,
	accessTokenExpiresAt: session.accessTokenExpiresAt,
	userId: session.userId,
	organizationId: session.organizationId,
	grantedScopes: session.grantedScopes,
});
// @custom end
