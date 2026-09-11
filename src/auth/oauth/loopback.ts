// @custom start
/** Low-level primitives for the one-use OAuth loopback listener. */

import { timingSafeEqual } from "node:crypto";
import type { Server } from "node:http";

import { OAuthError } from "../errors.js";

/** A one-shot callback result that can be settled by listener events. */
export type Deferred<T> = {
	readonly promise: Promise<T>;
	readonly resolve: (value: T) => void;
};

/** Create a result promise and its resolver before registering listener events. */
export const deferred = <T>(): Deferred<T> => {
	// Promise invokes its executor synchronously before the constructor returns.
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((onResolve) => {
		resolve = onResolve;
	});
	return { promise, resolve };
};

/** Compare equal-length state values without content-dependent timing. */
export const equalSecret = (actual: string, expected: string): boolean => {
	const actualBytes = Buffer.from(actual);
	const expectedBytes = Buffer.from(expected);
	return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
};

/** Bind a callback to an OS-assigned port on IPv4 loopback only. */
export const listenOnLoopback = async (server: Server): Promise<void> => {
	try {
		await new Promise<void>((resolve, reject) => {
			const onError = (error: Error): void => reject(error);
			server.once("error", onError);
			server.listen(0, "127.0.0.1", () => {
				server.off("error", onError);
				resolve();
			});
		});
	} catch (error: unknown) {
		throw new OAuthError("callback_unavailable", { cause: error });
	}
};

/** Stop accepting connections and close partial requests before resolving cleanup. */
export const closeServer = (server: Server): Promise<void> =>
	new Promise((resolve, reject) => {
		if (!server.listening) {
			server.closeAllConnections();
			return resolve();
		}
		server.close((error) => (error ? reject(error) : resolve()));
		// close() stops new connections but waits for active sockets. Destroy them
		// after closing so a partial local request cannot stall cancellation.
		server.closeAllConnections();
	});
// @custom end
