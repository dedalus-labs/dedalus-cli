// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { path as __scalarPath } from '../../../internal/utils/path';
import * as TerminalsAPI from './terminals';
import { Dedalus } from '../../../client';
import { EventEmitter, type EventParameters } from '../../../core/EventEmitter';
import { DedalusError } from '../../../error';
import type { RawWebSocketData, ReconnectingEvent, UnsentMessage } from '../../../internal/ws';
import type { TerminalsWSParameters } from './ws-base';

type EventTypeOf<T> = T extends { type?: infer EventType } ? EventType : never;
type TerminalsWSErrorEvent = Extract<TerminalsAPI.ConnectServerEvent, { type?: 'error' }>;

export type TerminalsStreamMessage =
  | { type: 'connecting' | 'open' | 'closing' }
  | { type: 'close'; code: number; reason: string; unsent: UnsentMessage<TerminalsAPI.ConnectClientEvent>[] }
  | { type: 'reconnecting'; reconnect: ReconnectingEvent<TerminalsWSParameters> }
  | { type: 'reconnected' }
  | { type: 'message'; message: TerminalsAPI.ConnectServerEvent }
  | { type: 'raw'; data: RawWebSocketData }
  | { type: 'error'; error: WebSocketError };

export class WebSocketError extends DedalusError {
  error?: TerminalsWSErrorEvent | undefined;

  constructor(message: string, event: TerminalsWSErrorEvent | null) {
    super(message);
    this.error = event ?? undefined;
  }
}

type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};

type WebSocketEvents = Simplify<
  {
    event: (event: TerminalsAPI.ConnectServerEvent) => void;
    raw: (data: RawWebSocketData) => void;
    error: (error: WebSocketError) => void;
    close: (code: number, reason: string, unsent: UnsentMessage<TerminalsAPI.ConnectClientEvent>[]) => void;
    reconnecting: (event: ReconnectingEvent<TerminalsWSParameters>) => void;
    reconnected: () => void;
  } & {
    [EventType in Exclude<NonNullable<EventTypeOf<TerminalsAPI.ConnectServerEvent>>, 'error'> & string]: (
      event: Extract<TerminalsAPI.ConnectServerEvent, { type?: EventType }>,
    ) => unknown;
  }
>;

export abstract class TerminalsEmitter extends EventEmitter<WebSocketEvents> {
  /** Send an event to the API. */
  abstract send(event: TerminalsAPI.ConnectClientEvent): void;

  /** Send raw data over the WebSocket without JSON serialization. */
  abstract sendRaw(data: RawWebSocketData): void;

  /** Close the WebSocket connection. */
  abstract close(props?: { code: number; reason: string }): void;

  protected _onError(event: null, message: string, cause: unknown): void;
  protected _onError(event: TerminalsWSErrorEvent, message?: string | undefined): void;
  protected _onError(
    event: TerminalsWSErrorEvent | null,
    message?: string | undefined,
    cause?: unknown,
  ): void {
    message = message ?? safeJSONStringify(event) ?? 'unknown error';

    if (!this._hasListener('error')) {
      const error = new WebSocketError(
        message +
          "\n\nTo resolve these unhandled rejection errors you should bind an `error` callback, e.g. `ws.on('error', (error) => ...)` ",
        event,
      );
      (error as Error & { cause?: unknown }).cause = cause;
      Promise.reject(error);
      return;
    }

    const error = new WebSocketError(message, event);
    (error as Error & { cause?: unknown }).cause = cause;
    this._emit('error', error);
  }

  public _emit<Event extends keyof WebSocketEvents>(
    event: Event,
    ...args: EventParameters<WebSocketEvents, Event>
  ): void {
    super._emit(event, ...args);
  }
}

export function buildURL(client: Dedalus, parameters: Record<string, unknown>): URL {
  const { machine_id, terminal_id, 'X-Dedalus-Org-Id': xDedalusOrgID, ...query } = parameters;
  const endpoint = __scalarPath`/v1/machines/${machine_id}/terminals/${terminal_id}/stream`;
  const url = new URL(client.buildURL(endpoint, query, undefined));
  url.protocol = url.protocol === 'http:' || url.protocol === 'ws:' ? 'ws:' : 'wss:';
  return url;
}

export function parameterHeaders(parameters: Record<string, unknown>): Record<string, string> {
  const headers: Record<string, string> = {};
  if (parameters['X-Dedalus-Org-Id'] !== undefined)
    headers['X-Dedalus-Org-Id'] = String(parameters['X-Dedalus-Org-Id']);
  return headers;
}

function safeJSONStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}
