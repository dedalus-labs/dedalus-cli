// @custom start
/** Authorization Code with PKCE against the public OpenAPI OAuth contract. */
import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";

import { OAuthError } from "../errors.js";
import {
	AUTH_METADATA_SCHEMA,
	OAUTH_SESSION_SCHEMA,
	SESSION_VERSION,
	type AuthMetadata,
	type AuthMetadataInput,
	type OAuthSession,
} from "../schema.js";
import type { AuthProvider } from "../types.js";
import { listenForOAuthCallback, type OAuthCallbackListener } from "./callback.js";
import { fetchUserInfo, requestTokenSet } from "./http.js";
import { revokeTokenSet } from "./revoke.js";

export { OAuthError } from "../errors.js";

const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const AUTHORIZATION_URL_LENGTH_MAX = 4 * 1024;

/** Public metadata and an optional browser-login deadline in milliseconds. */
export type DedalusOAuthOptions = AuthMetadataInput & { readonly timeoutMs?: number };
/** External effects that tests can replace while exercising the real protocol flow. */
export type DedalusOAuthDependencies = {
	readonly fetch?: typeof globalThis.fetch;
	readonly now?: () => number;
	readonly openBrowser?: (url: string) => Promise<void>;
	readonly randomBytes?: (size: number) => Uint8Array;
};
/** One browser authorization request with a single completion and explicit cancellation. */
export type DedalusOAuthAttempt = {
	readonly authorizationURL: string;
	readonly redirectURI: string;
	readonly complete: () => Promise<OAuthSession>;
	readonly cancel: () => Promise<void>;
};

type OAuthConfiguration = {
	readonly metadata: AuthMetadata;
	readonly timeoutMs: number;
};

/** Derive the S256 challenge without exposing the verifier. */
export const pkceChallenge = (verifier: string): string =>
	createHash("sha256").update(verifier, "ascii").digest("base64url");

/** Bind all provider operations to one validated public protocol description. */
export const createDedalusAuthProvider = (
	options: DedalusOAuthOptions,
	dependencies: DedalusOAuthDependencies = {},
): AuthProvider => {
	const { metadata } = configurationFrom(options);
	return {
		issuer: metadata.issuer,
		clientId: metadata.clientId,
		resource: metadata.resource,
		login: () => browserLogin(options, dependencies),
		refresh: async (session) => {
			requireProviderSession(session, metadata);
			const tokens = await requestTokenSet({
				metadata,
				body: new URLSearchParams({
					grant_type: "refresh_token",
					client_id: metadata.clientId,
					refresh_token: session.refreshToken,
					resource: metadata.resource,
				}),
				request: dependencies.fetch ?? globalThis.fetch,
				now: dependencies.now ?? Date.now,
				operation: "refresh_failed",
			});
			return { ...session, ...tokens };
		},
		revoke: async (session) => {
			requireProviderSession(session, metadata);
			await revokeTokenSet(metadata, session, dependencies.fetch ?? globalThis.fetch);
		},
	};
};

const browserLogin = async (
	options: DedalusOAuthOptions,
	dependencies: DedalusOAuthDependencies,
): Promise<OAuthSession> => {
	const attempt = await beginDedalusOAuth(options, dependencies);
	try {
		await (dependencies.openBrowser ?? defaultOpenBrowser)(attempt.authorizationURL);
	} catch (cause: unknown) {
		const failure = new OAuthError("browser_open_failed", { cause });
		try {
			await attempt.cancel();
		} catch (cleanup: unknown) {
			throw new AggregateError([failure, cleanup], "Browser launch and callback cleanup failed");
		}
		throw failure;
	}
	return attempt.complete();
};

/** Open a one-use callback before handing the authorization request to the browser. */
export const beginDedalusOAuth = async (
	options: DedalusOAuthOptions,
	dependencies: DedalusOAuthDependencies = {},
): Promise<DedalusOAuthAttempt> => {
	const configuration = configurationFrom(options);
	const randomBytes = dependencies.randomBytes ?? nodeRandomBytes;
	const verifier = randomValue(randomBytes);
	const state = randomValue(randomBytes);
	const callback = await listenForOAuthCallback(configuration.metadata.issuer, state);
	try {
		const url = authorizationURL(configuration.metadata, callback.redirectURI, verifier, state);
		callback.startTimeout(configuration.timeoutMs);
		let completion: Promise<OAuthSession> | undefined;
		return {
			authorizationURL: url,
			redirectURI: callback.redirectURI,
			complete: () => {
				completion ??= completeAttempt(callback, verifier, configuration.metadata, dependencies);
				return completion;
			},
			cancel: callback.cancel,
		};
	} catch (error: unknown) {
		try {
			await callback.cancel();
		} catch (cleanup: unknown) {
			throw new AggregateError([error, cleanup], "OAuth setup and callback cleanup failed");
		}
		throw error;
	}
};

const configurationFrom = (options: DedalusOAuthOptions): OAuthConfiguration => {
	const { timeoutMs = LOGIN_TIMEOUT_MS, ...input } = options;
	const metadata = AUTH_METADATA_SCHEMA.safeParse(input);
	if (!metadata.success || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
		throw new OAuthError("invalid_configuration");
	}
	return { metadata: metadata.data, timeoutMs };
};

const authorizationURL = (
	metadata: AuthMetadata,
	redirectURI: string,
	verifier: string,
	state: string,
): string => {
	const url = new URL(metadata.authorizationURL);
	url.search = new URLSearchParams({
		response_type: "code",
		client_id: metadata.clientId,
		redirect_uri: redirectURI,
		code_challenge: pkceChallenge(verifier),
		code_challenge_method: "S256",
		state,
		scope: metadata.scopes.join(" "),
		resource: metadata.resource,
	}).toString();
	if (url.toString().length > AUTHORIZATION_URL_LENGTH_MAX) {
		throw new OAuthError("invalid_configuration");
	}
	return url.toString();
};

const completeAttempt = async (
	callback: OAuthCallbackListener,
	verifier: string,
	metadata: AuthMetadata,
	dependencies: DedalusOAuthDependencies,
): Promise<OAuthSession> => {
	const outcome = await callback.result;
	if ("error" in outcome) throw outcome.error;
	const request = dependencies.fetch ?? globalThis.fetch;
	const now = dependencies.now ?? Date.now;
	const tokens = await requestTokenSet({
		metadata,
		body: new URLSearchParams({
			grant_type: "authorization_code",
			client_id: metadata.clientId,
			code: outcome.code,
			redirect_uri: callback.redirectURI,
			code_verifier: verifier,
			resource: metadata.resource,
		}),
		request,
		now,
		operation: "token_exchange_failed",
	});
	try {
		const user = await fetchUserInfo(metadata, tokens.accessToken, { request, now });
		return OAUTH_SESSION_SCHEMA.parse({
			version: SESSION_VERSION,
			issuer: metadata.issuer,
			clientId: metadata.clientId,
			resource: metadata.resource,
			...tokens,
			...user,
		});
	} catch (error: unknown) {
		try {
			await revokeTokenSet(metadata, tokens, request);
		} catch (cleanup: unknown) {
			throw new AggregateError([error, cleanup], "Login and token cleanup failed");
		}
		throw error;
	}
};

const requireProviderSession = (session: OAuthSession, metadata: AuthMetadata): void => {
	if (
		session.issuer !== metadata.issuer ||
		session.clientId !== metadata.clientId ||
		session.resource !== metadata.resource
	)
		throw new OAuthError("session_provider_mismatch");
};

const randomValue = (randomBytes: (size: number) => Uint8Array): string => {
	const value = randomBytes(32);
	if (value.byteLength !== 32) throw new OAuthError("invalid_configuration");
	return Buffer.from(value).toString("base64url");
};

const defaultOpenBrowser = async (url: string): Promise<void> => {
	const { default: open } = await import("open");
	await open(url);
};
// @custom end
