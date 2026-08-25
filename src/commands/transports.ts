import WebSocket, { type RawData } from 'ws'

import type { Dedalus } from '../sdk/client.js'

type SocketEvent =
  | { readonly type: 'connecting' | 'open' }
  | { readonly type: 'message'; readonly message: unknown }
  | { readonly type: 'raw'; readonly data: string }
  | { readonly type: 'error'; readonly error: Error }
  | { readonly type: 'close'; readonly code: number; readonly reason: string }

const maxSSEBufferCharacters = 1_048_576

export class CommandWebSocket implements AsyncIterable<SocketEvent> {
  readonly #events: SocketEvent[] = [{ type: 'connecting' }]
  readonly #waiters: Array<() => void> = []
  readonly #pending: unknown[] = []
  readonly #socket: WebSocket
  #closed = false
  #closeOptions: { readonly code: number; readonly reason: string } | undefined

  constructor(client: Dedalus, path: string, parameterHeaders: Record<string, string>) {
    const url = new URL(client.buildURL(path, undefined))
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    this.#socket = new WebSocket(url, {
      headers: { ...client.webSocketAuthHeaders(), ...parameterHeaders },
    })
    this.#socket.on('open', () => {
      this.#push({ type: 'open' })
      if (this.#closeOptions) {
        this.#socket.close(this.#closeOptions.code, this.#closeOptions.reason)
        return
      }
      for (const message of this.#pending.splice(0)) this.#sendNow(message)
    })
    this.#socket.on('message', (data: RawData, binary: boolean) => {
      const text = data.toString()
      if (binary) {
        this.#push({ type: 'raw', data: text })
        return
      }
      try {
        this.#push({ type: 'message', message: JSON.parse(text) })
      } catch {
        this.#push({ type: 'raw', data: text })
      }
    })
    this.#socket.on('error', (error: Error) => this.#push({ type: 'error', error }))
    this.#socket.on('close', (code: number, reason: Buffer) => {
      this.#closed = true
      this.#push({ type: 'close', code, reason: reason.toString() })
      this.#wake()
    })
  }

  send(message: unknown): void {
    if (this.#socket.readyState === WebSocket.CONNECTING) {
      this.#pending.push(message)
      return
    }
    this.#sendNow(message)
  }

  close(options?: { readonly code?: number; readonly reason?: string }): void {
    if (this.#closed || this.#socket.readyState === WebSocket.CLOSED) return
    const closeOptions = { code: options?.code ?? 1000, reason: options?.reason ?? 'OK' }
    if (this.#socket.readyState === WebSocket.CONNECTING) {
      this.#closeOptions = closeOptions
      return
    }
    this.#socket.close(closeOptions.code, closeOptions.reason)
  }

  async *[Symbol.asyncIterator](): AsyncIterator<SocketEvent> {
    while (!this.#closed || this.#events.length > 0) {
      if (this.#events.length === 0) await new Promise<void>((resolve) => this.#waiters.push(resolve))
      const event = this.#events.shift()
      if (event) yield event
    }
  }

  #sendNow(message: unknown): void {
    if (this.#socket.readyState !== WebSocket.OPEN) throw new Error('WebSocket is not open')
    this.#socket.send(JSON.stringify(message))
  }

  #push(event: SocketEvent): void {
    this.#events.push(event)
    this.#wake()
  }

  #wake(): void {
    for (const resolve of this.#waiters.splice(0)) resolve()
  }
}

export const sseEvents = async function* (responsePromise: Promise<Response>): AsyncIterable<unknown> {
  const response = await responsePromise
  if (!response.body) return
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done }).replaceAll('\r\n', '\n')
    if (buffer.length > maxSSEBufferCharacters) throw new Error('SSE event exceeds the 1 MiB limit')
    let boundary = buffer.indexOf('\n\n')
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      const event = parseSSEBlock(block)
      if (event !== undefined) yield event
      boundary = buffer.indexOf('\n\n')
    }
    if (done) break
  }
  const event = parseSSEBlock(buffer)
  if (event !== undefined) yield event
}

const parseSSEBlock = (block: string): unknown => {
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
  if (!data) return undefined
  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}
