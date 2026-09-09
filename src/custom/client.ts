/** One OAuth recovery attempt around Scalar's HTTP request implementation. */
import SDK from '../sdk/index.js'
import { APIError } from '../sdk/core/error.js'
import type { APIResponseProps } from '../sdk/internal/parse.js'
import type { FinalRequestOptions } from '../sdk/internal/request-options.js'
import { oauthRecovery } from './auth/recovery.js'

export class AuthenticatedCommandClient extends SDK {
  private readonly recovering = new WeakSet<FinalRequestOptions>()

  // Scalar's WebSocket selector omits bearerAuth; authHeadersSync supports it.
  override webSocketAuthHeaders(): Record<string, string> {
    return this.authHeadersSync()
  }

  protected override async makeRequest(
    input: FinalRequestOptions | Promise<FinalRequestOptions>,
    retries: number | null,
    retryOfRequestLogID: string | undefined,
  ): Promise<APIResponseProps> {
    const options = await input
    const recovery = oauthRecovery(this.bearerAuth)
    if (!recovery || typeof this.bearerAuth !== 'function' || this.recovering.has(options)) {
      return super.makeRequest(options, retries, retryOfRequestLogID)
    }
    const rejected = await this.bearerAuth()
    // Scalar's transient retries re-enter this hook with the same options.
    const request = { ...options, idempotencyKey: options.idempotencyKey ?? this.defaultIdempotencyKey() }
    this.recovering.add(request)
    try {
      try {
        return await super.makeRequest(request, retries, retryOfRequestLogID)
      } catch (error) {
        if (!(error instanceof APIError) || error.status !== 401 || options.signal?.aborted) throw error
        // Streams cannot safely be replayed after the first request consumes them.
        if (options.body instanceof ReadableStream ||
          (options.body && typeof options.body === 'object' && Symbol.asyncIterator in options.body)) throw error
        await recovery.recover(rejected)
        return await super.makeRequest(request, retries, retryOfRequestLogID)
      }
    } finally {
      this.recovering.delete(request)
    }
  }
}
