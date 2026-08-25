import SDK, { DedalusError, type ClientOptions } from '../sdk/index.js'
import { buildHeaders } from '../sdk/internal/headers.js'
import type { RequestOptions } from '../sdk/internal/request-options.js'
import { operationSpecs } from './operations.generated.js'
import type { OperationSpec } from './operations.js'
import { CommandWebSocket, sseEvents } from './transports.js'

type OperationMethod = (params?: Record<string, unknown>, options?: RequestOptions) => unknown

export class CommandClient extends SDK {
  readonly operations: Readonly<Record<string, OperationMethod>>

  constructor(options: ClientOptions = {}) {
    super(options)
    this.operations = Object.fromEntries(operationSpecs.map((spec) => [
      spec.id,
      (params?: Record<string, unknown>, requestOptions?: RequestOptions) => this.#invoke(spec, params, requestOptions),
    ]))
  }

  override webSocketAuthHeaders(): Record<string, string> {
    const headers = super.webSocketAuthHeaders()
    if (headers.Authorization || headers['x-api-key']) return headers
    if (this.bearerAuth == null) return {}
    const bearerAuth = typeof this.bearerAuth === 'function' ? this.bearerAuth() : this.bearerAuth
    if (typeof bearerAuth !== 'string' || !bearerAuth) {
      throw new DedalusError("Expected 'bearerAuth' to resolve to a non-empty string.")
    }
    return { Authorization: `Bearer ${bearerAuth}` }
  }

  #invoke(spec: OperationSpec, rawParams: Record<string, unknown> = {}, requestOptions: RequestOptions = {}): unknown {
    const path = spec.path.replace(/\{([^}]+)\}/gu, (_match, name: string) => encodeURIComponent(String(rawParams[name])))
    const query: Record<string, unknown> = {}
    const headers: Record<string, string> = {}
    const body: Record<string, unknown> = {}
    for (const [name, value] of Object.entries(rawParams)) {
      if (value === undefined || name === 'send') continue
      const location = spec.parameterLocations[name]
      if (location === 'query') query[name] = value
      if (location === 'header') headers[name] = String(value)
      if (location === 'body') body[name] = value
    }
    if (spec.command.transport === 'websocket') return new CommandWebSocket(this, path, headers)
    const bodyValue = Object.hasOwn(body, 'body') ? body.body : body
    const options = {
      ...requestOptions,
      method: spec.method,
      path,
      ...(Object.keys(query).length > 0 ? { query } : {}),
      ...(Object.keys(headers).length > 0 ? { headers: buildHeaders([requestOptions.headers, headers]) } : {}),
      ...(Object.keys(body).length > 0 ? { body: bodyValue } : {}),
      ...(spec.command.streaming === 'sse' ? { __binaryResponse: true } : {}),
    }
    if (spec.command.streaming === 'sse') return sseEvents(this.request<Response>(options))
    return this.request<unknown>(options)
  }
}
