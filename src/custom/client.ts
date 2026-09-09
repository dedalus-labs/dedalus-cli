/** One OAuth recovery attempt around Scalar's HTTP request implementation. */
import { CommandClient } from '../commands/client.js'
import { APIPromise } from '../sdk/core/api-promise.js'
import { APIError } from '../sdk/core/error.js'
import type { FinalRequestOptions } from '../sdk/internal/request-options.js'
import { oauthRecovery } from './auth/recovery.js'

export class AuthenticatedCommandClient extends CommandClient {
  override request<T>(input: FinalRequestOptions | Promise<FinalRequestOptions>, retries: number | null = null): APIPromise<T> {
    const recovery = oauthRecovery(this.bearerAuth)
    if (!recovery || typeof this.bearerAuth !== 'function') return super.request<T>(input, retries)
    const bearer = this.bearerAuth
    const response = Promise.resolve(input).then(async (options) => {
      const rejected = await bearer()
      // Keep the same key on the retry, including for machine creation.
      const controller = new AbortController()
      const request = {
        ...options,
        signal: options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal,
        idempotencyKey: options.idempotencyKey ?? this.defaultIdempotencyKey(),
      }
      let result: Response
      try {
        result = await super.request<T>(request, retries).asResponse()
      } catch (error) {
        if (!(error instanceof APIError) || error.status !== 401 || options.signal?.aborted) throw error
        // Streams cannot safely be replayed after the first request consumes them.
        if (options.body instanceof ReadableStream ||
          (options.body && typeof options.body === 'object' && Symbol.asyncIterator in options.body)) throw error
        await recovery.recover(rejected)
        result = await super.request<T>(request, retries).asResponse()
      }
      return { response: result, options: request, controller }
    })
    return new APIPromise<T>(this, response)
  }
}
