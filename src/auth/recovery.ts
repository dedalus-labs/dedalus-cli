// @custom start
/** OAuth recovery attached only to credentials selected by the CLI. */
import type { CredentialStore } from "./credentials.js";
import type { AuthProvider } from "./types.js";
import type { OAuthSession } from "./schema.js";
import { CredentialStorageError } from "./credentials.js";
import { recoverRejectedAccessToken } from "./workflow.js";

type SessionIdentity = Pick<
	OAuthSession,
	"issuer" | "clientId" | "resource" | "userId" | "organizationId"
>;
type Recovery = {
	readonly identity: SessionIdentity;
	readonly recover: (rejected: string) => Promise<void>;
};
// Mutable associations between bearer getters and their request-recovery state.
const recoveries = new WeakMap<object, Recovery>();

/** Attach one identity-bound recovery operation to a stored bearer getter. */
export const recoverableBearer = async (
	initial: OAuthSession["accessToken"],
	store: CredentialStore,
	provider: AuthProvider,
): Promise<() => string> => {
	const identity = await store.read();
	if (!identity || identity.accessToken !== initial)
		throw new CredentialStorageError("invalid_credential");
	let token = initial;
	const bearer = () => token;
	recoveries.set(bearer, {
		identity: {
			issuer: identity.issuer,
			clientId: identity.clientId,
			resource: identity.resource,
			userId: identity.userId,
			organizationId: identity.organizationId,
		},
		recover: async (rejected) => {
			token = await recoverRejectedAccessToken(store, provider, rejected, identity);
		},
	});
	return bearer;
};

/** Match opaque generated CLI options to an owned, identity-bound bearer getter. */
export const oauthRecovery = (bearer: unknown): Recovery | undefined =>
	typeof bearer === "function" ? recoveries.get(bearer) : undefined;
// @custom end
