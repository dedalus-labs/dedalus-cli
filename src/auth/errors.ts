// @custom start
/** Local failures are closed cases. Provider codes are validated protocol data. */
import { z } from "zod";

const LOCAL_CODE_SCHEMA = z.enum([
	"browser_open_failed",
	"callback_unavailable",
	"callback_response_failed",
	"callback_cleanup_failed",
	"invalid_callback",
	"invalid_configuration",
	"invalid_token_response",
	"invalid_userinfo_response",
	"invalid_json_response",
	"invalid_response_encoding",
	"invalid_scope",
	"issuer_mismatch",
	"login_cancelled",
	"login_timeout",
	"response_cleanup_failed",
	"response_read_failed",
	"response_too_large",
	"session_provider_mismatch",
	"state_mismatch",
	"userinfo_mismatch",
]);
const NETWORK_CODE_SCHEMA = z.enum([
	"token_exchange_failed",
	"refresh_failed",
	"userinfo_failed",
	"revocation_failed",
]);
/** Locally owned validation and callback failure codes. */
export type LocalOAuthCode = z.infer<typeof LOCAL_CODE_SCHEMA>;
/** OAuth requests that failed before receiving an HTTP response. */
export type NetworkOAuthCode = z.infer<typeof NETWORK_CODE_SCHEMA>;
/** Preserve whether a failure came from local validation, transport, or the provider. */
export type OAuthFailure =
	| { readonly stage: "local"; readonly code: LocalOAuthCode; readonly status?: number }
	| { readonly stage: "network"; readonly code: NetworkOAuthCode }
	| { readonly stage: "provider"; readonly code: string; readonly status?: number };

type LocalOptions = ErrorOptions & { readonly stage?: "local"; readonly status?: number };
type NetworkOptions = ErrorOptions & { readonly stage: "network" };
type ProviderOptions = ErrorOptions & { readonly stage: "provider"; readonly status?: number };
type OAuthOptions = ErrorOptions & {
	readonly stage?: OAuthFailure["stage"];
	readonly status?: number;
};

/** Preserve the transport cause while exposing one typed OAuth failure. */
export class OAuthError extends Error {
	readonly failure: OAuthFailure;

	constructor(code: LocalOAuthCode, options?: LocalOptions);
	constructor(code: NetworkOAuthCode, options: NetworkOptions);
	constructor(code: string, options: ProviderOptions);
	constructor(code: string, options: OAuthOptions = {}) {
		super(code, options);
		this.name = "OAuthError";
		this.failure = failureFrom(code, options);
	}

	get code(): OAuthFailure["code"] {
		return this.failure.code;
	}
	get stage(): OAuthFailure["stage"] {
		return this.failure.stage;
	}
	get status(): number | undefined {
		return this.failure.stage === "network" ? undefined : this.failure.status;
	}
}

const failureFrom = (code: string, options: OAuthOptions): OAuthFailure => {
	switch (options.stage ?? "local") {
		case "network":
			return { stage: "network", code: NETWORK_CODE_SCHEMA.parse(code) };
		case "provider":
			return {
				stage: "provider",
				code,
				...(options.status === undefined ? {} : { status: options.status }),
			};
		case "local":
			return {
				stage: "local",
				code: LOCAL_CODE_SCHEMA.parse(code),
				...(options.status === undefined ? {} : { status: options.status }),
			};
	}
};
// @custom end
