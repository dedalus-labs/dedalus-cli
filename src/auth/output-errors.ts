// @custom start
/** Render public API failures and local credential failures without private causes. */
import type { Command } from "commander";
import { z } from "zod";

import { APIError } from "../sdk/core/error.js";
import { CredentialStorageError } from "./credential-contract.js";
import { OAuthError, type LocalOAuthCode } from "./errors.js";
import { CLIAuthWorkflowError } from "./workflow.js";

/** Credential provenance for user-facing auth results. */
export type CredentialSource = "environment" | "flag" | "none" | "oauth_session";
/** The selected source and its optional public environment-variable name. */
export type SelectedCredential = {
	readonly source: CredentialSource;
	readonly label?: "DEDALUS_API_KEY" | "DEDALUS_X_API_KEY";
};
/** Public error fields exclude secret values and internal exception causes. */
export type SafeAuthError = {
	readonly code: string;
	readonly message: string;
	readonly retryable: boolean;
	readonly retry_after_ms?: number;
	readonly details?: Readonly<Record<string, string>>;
	readonly http_status?: number;
	readonly credential_source?: CredentialSource;
	readonly causes?: readonly SafeAuthError[];
};
type AuthErrorResponse = { readonly error: SafeAuthError };
type ErrorDescription = { readonly message: string; readonly retryable: boolean };

const LOCAL_MESSAGES = {
	browser_open_failed: "Unable to open the browser for login.",
	callback_unavailable: "Unable to start the local login callback.",
	callback_response_failed: "The login callback could not be completed.",
	callback_cleanup_failed: "The login callback could not be closed.",
	invalid_callback: "The login response is invalid.",
	invalid_configuration: "CLI authentication configuration is invalid.",
	invalid_token_response: "The authentication service returned an invalid token response.",
	invalid_userinfo_response: "The authentication service returned an invalid identity.",
	invalid_json_response: "The authentication service returned invalid JSON.",
	invalid_response_encoding: "The authentication service returned invalid text.",
	invalid_scope: "CLI login returned unsupported permissions.",
	issuer_mismatch: "The login response belongs to another issuer.",
	login_cancelled: "Login was canceled.",
	login_timeout: "Login timed out. Run the command again.",
	response_cleanup_failed: "The authentication response could not be closed.",
	response_read_failed: "The authentication response could not be read.",
	response_too_large: "The authentication response exceeds its size limit.",
	session_provider_mismatch: "The stored login belongs to another public API.",
	state_mismatch: "The login response could not be verified.",
	userinfo_mismatch: "The login identity could not be verified.",
} as const satisfies Record<LocalOAuthCode, string>;

const STORAGE_MESSAGES = {
	ambiguous_credential: [
		"cli_ambiguous_credential",
		"More than one credential was supplied at the same priority.",
	],
	environment_mismatch: [
		"cli_auth_environment_mismatch",
		"The stored login cannot authenticate this API origin.",
	],
	invalid_credential: [
		"cli_invalid_stored_credential",
		"Remove the invalid login from your system credential manager, then sign in again.",
	],
	not_logged_in: ["cli_no_credential", "Not logged in. Run 'dedalus auth login'."],
	storage_unavailable: [
		"cli_credential_store_unavailable",
		"Protected credential storage is unavailable.",
	],
	unsupported_credential: [
		"cli_unsupported_credential",
		"Use a workload API key or a stored login.",
	],
} as const satisfies Record<CredentialStorageError["code"], readonly [string, string]>;

const WORKFLOW_MESSAGES = {
	cli_credential_store_failed: "The CLI could not complete the local credential update.",
	cli_session_identity_changed: "The refreshed login changed identity. Sign in again.",
	cli_session_provider_mismatch: "The stored login belongs to another public API.",
} as const satisfies Record<CLIAuthWorkflowError["code"], string>;

const PRINTABLE_TEXT = z
	.string()
	.max(4096)
	.refine(
		(value) =>
			![...value].some((character) => {
				const code = character.charCodeAt(0);
				return code < 32 || (code >= 127 && code <= 159);
			}),
	);
const SAFE_TEXT = PRINTABLE_TEXT.min(1);
const API_ERROR = z.object({
	error_code: SAFE_TEXT.max(256),
	message: SAFE_TEXT,
	retryable: z.boolean(),
	retry_after_ms: z.number().int().nonnegative().optional(),
	details: z.record(SAFE_TEXT.max(256), PRINTABLE_TEXT).readonly().optional(),
});
// Mutable provenance for each command. Completed commands are not retained.
const credentialSources = new WeakMap<Command, SelectedCredential>();

/** Attach the selected credential source to the command's error presentation. */
export const recordCredentialSource = (command: Command, selected: SelectedCredential): void => {
	credentialSources.set(command, selected);
};

/** Preserve the public server error contract and redact local implementation causes. */
export const formatDedalusError = (
	error: unknown,
	command: Command,
): AuthErrorResponse | undefined => {
	const selected = credentialSources.get(command);
	if (
		error instanceof OAuthError ||
		error instanceof CredentialStorageError ||
		error instanceof CLIAuthWorkflowError ||
		error instanceof AggregateError
	) {
		return { error: safeAuthError(error, selected?.source ?? "none") };
	}
	if (!selected || !(error instanceof APIError)) return undefined;
	if (selected.source === "none")
		return {
			error: {
				code: "cli_no_credential",
				message: "Not logged in. Run 'dedalus auth login'.",
				retryable: false,
				credential_source: "none",
			},
		};
	if (error.status === undefined)
		return {
			error: {
				code: "cli_network_error",
				message: "Dedalus could not be reached. Try again.",
				retryable: true,
				credential_source: selected.source,
			},
		};
	// APIError carries an untrusted HTTP response body. Parse the public envelope once.
	const body = API_ERROR.safeParse(error.error);
	if (!body.success)
		return {
			error: {
				code: "cli_invalid_error_response",
				message: "Dedalus returned an invalid error response.",
				retryable: false,
				http_status: error.status,
				credential_source: selected.source,
			},
		};
	const { error_code: code, retry_after_ms: retryAfterMS, details, ...publicFields } = body.data;
	return {
		error: {
			code,
			...publicFields,
			...(retryAfterMS === undefined ? {} : { retry_after_ms: retryAfterMS }),
			...(details === undefined ? {} : { details }),
			http_status: error.status,
			credential_source: selected.source,
		},
	};
};

/** Project known local failures without serializing the underlying cause. */
export const safeAuthError = (error: unknown, source: CredentialSource): SafeAuthError => {
	if (error instanceof AggregateError) {
		const causes = error.errors.map((cause: unknown) => safeAuthError(cause, source));
		return {
			code: "cli_authentication_failed",
			message: "Authentication failed.",
			retryable: causes.every((cause) => cause.retryable),
			credential_source: source,
			causes,
		};
	}
	if (error instanceof OAuthError) return oauthFailure(error);
	if (error instanceof CredentialStorageError) {
		const [code, message] = STORAGE_MESSAGES[error.code];
		return { code, message, retryable: false, credential_source: source };
	}
	if (error instanceof CLIAuthWorkflowError)
		return {
			code: error.code,
			message: WORKFLOW_MESSAGES[error.code],
			retryable: error.code === "cli_credential_store_failed",
			credential_source: "oauth_session",
		};
	return {
		code: "cli_authentication_failed",
		message: "CLI authentication failed.",
		retryable: false,
		credential_source: source,
	};
};

const oauthFailure = (error: OAuthError): SafeAuthError => {
	const failure = error.failure;
	switch (failure.stage) {
		case "local":
			return {
				code: `cli_${failure.code}`,
				message: LOCAL_MESSAGES[failure.code],
				retryable: false,
				credential_source: "oauth_session",
				...(failure.status === undefined ? {} : { http_status: failure.status }),
			};
		case "network":
			return {
				code: "cli_network_error",
				message: "The authentication service could not be reached.",
				retryable: true,
				credential_source: "oauth_session",
			};
		case "provider": {
			const parsed = SAFE_TEXT.max(256).safeParse(failure.code);
			const code = parsed.success ? parsed.data : "oauth_error";
			return {
				code,
				...providerDescription(code, failure.status),
				credential_source: "oauth_session",
				...(failure.status === undefined ? {} : { http_status: failure.status }),
			};
		}
	}
};

const providerDescription = (code: string, status?: number): ErrorDescription => {
	if (code === "invalid_grant")
		return {
			message: "The login expired or was revoked. Sign in again.",
			retryable: false,
		};
	if (code === "access_denied")
		return { message: "Login was canceled or denied.", retryable: false };
	const retryable =
		code === "temporarily_unavailable" ||
		code === "server_error" ||
		(status !== undefined && status >= 500);
	return { message: "Dedalus rejected the authentication request.", retryable };
};
// @custom end
