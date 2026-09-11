// @custom start
/**
 * Stored OAuth 2.0 session lifecycle for command-line authentication.
 *
 * Login, refresh, status, and logout run through the credential-store lock.
 * Provider and organization identity cannot change during a stored session.
 */

import type {
	CredentialResolutionOptions,
	CredentialStore,
	ResolvedCredential,
} from "./credentials.js";
import { CredentialStorageError, resolveCredential } from "./credentials.js";
import {
	OAuthError,
	oauthSessionMetadata,
	type AuthProvider,
	type OAuthSession,
	type OAuthSessionMetadata,
} from "./types.js";

const REFRESH_SKEW_MS = 60 * 1000;

/** A stored-session invariant or credential update failed. */
export class CLIAuthWorkflowError extends Error {
	readonly code:
		| "cli_credential_store_failed"
		| "cli_session_identity_changed"
		| "cli_session_provider_mismatch";

	constructor(code: CLIAuthWorkflowError["code"], options?: ErrorOptions) {
		super(code, options);
		this.name = "CLIAuthWorkflowError";
		this.code = code;
	}
}

/** Provider and native store for one serialized login attempt. */
export type LoginDependencies = {
	readonly provider: AuthProvider;
	readonly store: CredentialStore;
	readonly now?: () => number;
};

type AuthProviderFactory = () => AuthProvider;

/** Successful login returns identity metadata after durable persistence. */
export type LoginResult =
	| { readonly status: "already_signed_in"; readonly session: OAuthSessionMetadata }
	| { readonly status: "logged_in"; readonly session: OAuthSessionMetadata };

/** Workload configuration and stored-session identity are reported separately. */
export type AuthStatus =
	| { readonly source: "none" }
	| { readonly source: "environment" | "flag" }
	| {
			readonly source: "oauth_session";
			readonly offline: boolean;
			readonly session: OAuthSessionMetadata;
	  };

/** Logout succeeds only after required revocation and local removal complete. */
export type LogoutResult = { readonly status: "not_logged_in" } | { readonly status: "logged_out" };

/** Reuse or renew the existing grant, or persist a newly authorized session. */
export const login = async (dependencies: LoginDependencies): Promise<LoginResult> =>
	dependencies.store.withLifecycleLock(async () => {
		const existing = await dependencies.store.read();
		if (existing) requireProviderBinding(existing, dependencies.provider);
		if (
			existing &&
			existing.accessTokenExpiresAt > (dependencies.now ?? Date.now)() + REFRESH_SKEW_MS
		) {
			return { status: "already_signed_in", session: oauthSessionMetadata(existing) };
		}
		if (existing) {
			const refreshed = await refreshSession(dependencies.store, dependencies.provider, existing);
			return { status: "logged_in", session: oauthSessionMetadata(refreshed) };
		}

		const session = await dependencies.provider.login();
		requireProviderBinding(session, dependencies.provider);
		await persistSession(dependencies.store, dependencies.provider, session);
		return { status: "logged_in", session: oauthSessionMetadata(session) };
	});

/** Describe the selected source, refreshing stored sessions only for online status. */
export const status = async (
	resolution: Omit<CredentialResolutionOptions, "storedAccessToken">,
	store: () => CredentialStore,
	provider: AuthProviderFactory,
	offline: boolean,
	now: () => number = Date.now,
): Promise<AuthStatus> => {
	let configuredStore: CredentialStore | undefined;
	const credentialStore = (): CredentialStore => (configuredStore ??= store());
	const selected = await resolveCredential({
		...resolution,
		storedAccessToken: async () => (await credentialStore().read())?.accessToken ?? null,
	});
	if (!selected) return { source: "none" };
	if (selected.source !== "oauth_session") return { source: selected.source };

	const session = offline
		? await requireStoredSession(credentialStore())
		: await currentSession(credentialStore(), provider(), now);
	return { source: "oauth_session", offline, session: oauthSessionMetadata(session) };
};

/** Return a usable token only after identity checks and any required durable refresh. */
export const accessTokenForCommand = async (
	store: CredentialStore,
	provider: AuthProvider,
	now: () => number = Date.now,
): Promise<OAuthSession["accessToken"]> => (await currentSession(store, provider, now)).accessToken;

/** Revoke both tokens before deleting and verifying the stored record. */
export const logout = async (
	store: CredentialStore,
	provider: AuthProviderFactory,
): Promise<LogoutResult> =>
	store.withLifecycleLock(async () => {
		const session = await store.read();
		if (!session) return { status: "not_logged_in" };

		const configuredProvider = provider();
		requireProviderBinding(session, configuredProvider);
		await configuredProvider.revoke(session);

		const removed = await store.remove();
		if (!removed || (await store.read()) !== null) {
			throw new CLIAuthWorkflowError("cli_credential_store_failed");
		}
		permanentFailures.delete(store);
		return { status: "logged_out" };
	});

/** Recover a rejected token under the same lock used by proactive refresh. */
export const recoverRejectedAccessToken = async (
	store: CredentialStore,
	provider: AuthProvider,
	rejectedToken: string,
	identity: Pick<OAuthSession, "userId" | "organizationId">,
): Promise<OAuthSession["accessToken"]> =>
	store.withLifecycleLock(async () => {
		const session = await requireStoredSession(store);
		requireProviderBinding(session, provider);
		if (session.userId !== identity.userId || session.organizationId !== identity.organizationId) {
			throw new CLIAuthWorkflowError("cli_session_identity_changed");
		}
		if (
			session.accessToken !== rejectedToken &&
			session.accessTokenExpiresAt > Date.now() + REFRESH_SKEW_MS
		) {
			return session.accessToken;
		}
		return (await refreshSession(store, provider, session)).accessToken;
	});

// Mutable process-local failure state for a specific stored refresh token.
const permanentFailures = new WeakMap<CredentialStore, { token: string; error: OAuthError }>();

const currentSession = async (
	store: CredentialStore,
	provider: AuthProvider,
	now: () => number,
): Promise<OAuthSession> =>
	store.withLifecycleLock(async () => {
		const session = await requireStoredSession(store);
		requireProviderBinding(session, provider);
		if (session.accessTokenExpiresAt > now() + REFRESH_SKEW_MS) return session;

		return refreshSession(store, provider, session);
	});

const refreshSession = async (
	store: CredentialStore,
	provider: AuthProvider,
	session: OAuthSession,
): Promise<OAuthSession> => {
	const previous = permanentFailures.get(store);
	if (previous?.token === session.refreshToken) throw previous.error;
	let refreshed: OAuthSession;
	try {
		refreshed = await provider.refresh(session);
	} catch (error: unknown) {
		if (
			error instanceof OAuthError &&
			error.stage === "provider" &&
			[
				"invalid_grant",
				"refresh_token_expired",
				"refresh_token_reused",
				"refresh_token_invalidated",
			].includes(error.code)
		) {
			permanentFailures.set(store, { token: session.refreshToken, error });
		}
		throw error;
	}
	requireProviderBinding(refreshed, provider);
	if (refreshed.userId !== session.userId || refreshed.organizationId !== session.organizationId) {
		throw new CLIAuthWorkflowError("cli_session_identity_changed");
	}
	await persistSession(store, provider, refreshed);
	permanentFailures.delete(store);
	return refreshed;
};

const persistSession = async (
	store: CredentialStore,
	provider: AuthProvider,
	session: OAuthSession,
): Promise<void> => {
	try {
		await store.write(session);
	} catch (cause: unknown) {
		const failure = new CLIAuthWorkflowError("cli_credential_store_failed", { cause });
		try {
			await provider.revoke(session);
		} catch (cleanup: unknown) {
			throw new AggregateError([failure, cleanup], "Credential storage and token cleanup failed");
		}
		throw failure;
	}
};

const requireStoredSession = async (store: CredentialStore): Promise<OAuthSession> => {
	const session = await store.read();
	if (!session) throw new CredentialStorageError("not_logged_in");
	return session;
};

const requireProviderBinding = (session: OAuthSession, provider: AuthProvider): void => {
	if (
		session.issuer !== provider.issuer ||
		session.clientId !== provider.clientId ||
		session.resource !== provider.resource
	) {
		throw new CLIAuthWorkflowError("cli_session_provider_mismatch");
	}
};

/** Read stored credentials only when no workload source was selected. */
export const selectedCredential = async (
	resolution: Omit<CredentialResolutionOptions, "storedAccessToken">,
	store: () => CredentialStore,
): Promise<ResolvedCredential | null> =>
	resolveCredential({
		...resolution,
		storedAccessToken: async () => (await store().read())?.accessToken ?? null,
	});
// @custom end
