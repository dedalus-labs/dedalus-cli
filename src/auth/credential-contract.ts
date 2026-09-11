// @custom start
/** Parse native credential records into the public session contract. */
import { err, ok, type Result } from "../result.js";
import { ACCESS_TOKEN_SCHEMA, STORED_SESSION_SCHEMA, type OAuthSession } from "./schema.js";

const CREDENTIAL_BYTES_MAX = 512 * 1024;
const CREDENTIAL_ERROR_CODES = [
	"ambiguous_credential",
	"environment_mismatch",
	"invalid_credential",
	"not_logged_in",
	"storage_unavailable",
	"unsupported_credential",
] as const;
/** Closed failures from credential selection, decoding, and native storage. */
export type CredentialStorageErrorCode = (typeof CREDENTIAL_ERROR_CODES)[number];

/** A credential operation failed without exposing the credential value. */
export class CredentialStorageError extends Error {
	constructor(
		readonly code: CredentialStorageErrorCode,
		options?: ErrorOptions,
	) {
		super(code, options);
		this.name = "CredentialStorageError";
	}
}

/** Serialize an already validated session. */
export const serializeOAuthSession = (session: OAuthSession): string =>
	JSON.stringify({
		version: session.version,
		issuer: session.issuer,
		client_id: session.clientId,
		resource: session.resource,
		access_token: session.accessToken,
		access_token_expires_at: session.accessTokenExpiresAt,
		refresh_token: session.refreshToken,
		user_id: session.userId,
		org_id: session.organizationId,
		granted_scopes: session.grantedScopes,
	});

/** Return the explicit validation result for untrusted parsed keyring data. */
export const parseStoredSession = (
	value: unknown,
): Result<OAuthSession, CredentialStorageError> => {
	const parsed = STORED_SESSION_SCHEMA.safeParse(value);
	if (!parsed.success) {
		return err(new CredentialStorageError("invalid_credential", { cause: parsed.error }));
	}
	return ok(parsed.data);
};

/** Decode one bounded native-keyring record at the storage boundary. */
export const decodeOAuthSession = (raw: string): OAuthSession => {
	try {
		if (Buffer.byteLength(raw, "utf8") > CREDENTIAL_BYTES_MAX) {
			throw new CredentialStorageError("invalid_credential");
		}
		const value: unknown = JSON.parse(raw);
		const result = parseStoredSession(value);
		if (!result.ok) throw result.error;
		return result.value;
	} catch (error: unknown) {
		throw error instanceof CredentialStorageError
			? error
			: new CredentialStorageError("invalid_credential", { cause: error });
	}
};

/** Validate externally supplied credential text without coercion. */
export const validCredentialToken = (value: string): string => {
	const parsed = ACCESS_TOKEN_SCHEMA.safeParse(value);
	if (!parsed.success) {
		throw new CredentialStorageError("invalid_credential", { cause: parsed.error });
	}
	return parsed.data;
};

/** Preserve the native failure under the credential-storage error contract. */
export const storageError = (error: unknown): CredentialStorageError =>
	error instanceof CredentialStorageError
		? error
		: new CredentialStorageError("storage_unavailable", { cause: error });
// @custom end
