// @custom start
/** Render public authentication results at the terminal boundary. */
import type { OAuthSessionMetadata } from "./types.js";
import type { AuthStatus, LoginResult, LogoutResult } from "./workflow.js";
import { safeAuthError, type CredentialSource } from "./output-errors.js";

export { formatDedalusError, recordCredentialSource } from "./output-errors.js";
export type { CredentialSource, SelectedCredential } from "./output-errors.js";

type SessionOutput = {
	readonly issuer: string;
	readonly user_id: string;
	readonly organization: { readonly id: string };
	readonly access_token_expires_at: string;
};
type AuthValue =
	| (SessionOutput & {
			readonly status: "logged_in" | "already_signed_in";
			readonly credential_source: "oauth_session";
			readonly offline?: boolean;
	  })
	| { readonly status: "not_logged_in"; readonly credential_source: "none" }
	| { readonly status: "configured"; readonly credential_source: "environment" | "flag" }
	| {
			readonly status: "logged_out" | "not_logged_in";
			readonly local_tokens_removed: boolean;
			readonly revocation_confirmed: boolean;
	  };
type AuthOutput = { readonly message: string; readonly value: AuthValue };

/** Report only the identity of the stored public-API session. */
export const loginOutput = (result: LoginResult): AuthOutput => ({
	message:
		result.status === "logged_in"
			? `Logged in to organization ${result.session.organizationId}.`
			: `Already signed in to organization ${result.session.organizationId}.`,
	value: {
		status: result.status,
		credential_source: "oauth_session",
		...sessionOutput(result.session),
	},
});

/** Describe the selected credential without printing its value. */
export const statusOutput = (result: AuthStatus): AuthOutput => {
	switch (result.source) {
		case "none":
			return {
				message: "Not logged in. Run 'dedalus auth login'.",
				value: { status: "not_logged_in", credential_source: "none" },
			};
		case "environment":
		case "flag":
			return {
				message: `Credential configured from ${result.source}.`,
				value: { status: "configured", credential_source: result.source },
			};
		case "oauth_session":
			return {
				message: `Signed in as ${result.session.userId} to organization ${result.session.organizationId}.`,
				value: {
					status: "logged_in",
					credential_source: "oauth_session",
					offline: result.offline,
					...sessionOutput(result.session),
				},
			};
	}
};

const sessionOutput = (session: OAuthSessionMetadata): SessionOutput => ({
	issuer: session.issuer,
	user_id: session.userId,
	organization: { id: session.organizationId },
	access_token_expires_at: new Date(session.accessTokenExpiresAt).toISOString(),
});

/** Confirm logout only after revocation and native credential removal. */
export const logoutOutput = (result: LogoutResult): AuthOutput => {
	if (result.status === "logged_out")
		return {
			message: "Logged out. Token revocation and local removal were confirmed.",
			value: { status: "logged_out", local_tokens_removed: true, revocation_confirmed: true },
		};
	return {
		message: "No stored OAuth login found.",
		value: { status: "not_logged_in", local_tokens_removed: false, revocation_confirmed: false },
	};
};

type RunAuthActionOptions = {
	readonly action: () => Promise<AuthOutput>;
	readonly source: CredentialSource;
	readonly json: boolean;
	readonly writeOutput: (value: string) => void;
	readonly writeError: (value: string) => void;
};

/** Convert an auth operation's result or failure into one terminal response. */
export const runAuthAction = async ({
	action,
	source,
	json,
	writeOutput,
	writeError,
}: RunAuthActionOptions): Promise<void> => {
	try {
		const output = await action();
		writeOutput(`${json ? JSON.stringify(output.value) : output.message}\n`);
	} catch (error: unknown) {
		const safe = safeAuthError(error, source);
		const message = json ? JSON.stringify({ error: safe }) : `${safe.code}: ${safe.message}`;
		writeError(`${message}\n`);
		process.exitCode = 1;
	}
};
// @custom end
