/** Low-level primitives for the one-use OAuth loopback listener. */

import { timingSafeEqual } from 'node:crypto'
import type { Server } from 'node:http'

import { ClerkOAuthError } from './oauth-http.js'

export type Deferred<T> = {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
  readonly reject: (error: unknown) => void
}

export const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

export const equalSecret = (actual: string, expected: string): boolean => {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

export const listenOnLoopback = async (server: Server): Promise<void> => {
  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => reject(error)
      server.once('error', onError)
      server.listen(0, '127.0.0.1', () => {
        server.off('error', onError)
        resolve()
      })
    })
  } catch (error: unknown) {
    throw new ClerkOAuthError('callback_unavailable', { cause: error })
  }
}

export const closeServer = (server: Server): Promise<void> => new Promise((resolve, reject) => {
  if (!server.listening) {
    server.closeAllConnections()
    return resolve()
  }
  server.close((error) => error ? reject(error) : resolve())
  // close() stops new connections but waits for active sockets. Destroy them
  // after closing so a partial local request cannot stall cancellation.
  server.closeAllConnections()
})
