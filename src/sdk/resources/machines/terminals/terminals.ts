// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../../resource';
import { APIPromise } from '../../../api-promise';
import { CursorPage, type CursorPageParams, type PagePromise } from '../../../core/pagination';
import type { RequestOptions } from '../../../internal/request-options';
import { buildHeaders } from '../../../internal/headers';
import { path as __scalarPath } from '../../../internal/utils/path';
import { TerminalsWS, type TerminalsWSClientOptions } from './ws';

export class Terminals extends APIResource {
  /**
   * List terminals
   *
   * @param {TerminalListParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {PagePromise<TerminalsCursorPage, Terminal>} OK
   *
   * @example
   * ```ts
   * const page = await client.machines.terminals.list({
   *   machine_id: 'machineID',
   * });
   * ```
   */
  list(params: TerminalListParams, options?: RequestOptions): PagePromise<TerminalsCursorPage, Terminal> {
    const { machine_id, 'X-Dedalus-Org-Id': xDedalusOrgID, ...query } = params;
    return this._client.getAPIList(__scalarPath`/v1/machines/${machine_id}/terminals`, CursorPage<Terminal>, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }

  /**
   * Create terminal
   *
   * @param {TerminalCreateParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Terminal>} OK
   *
   * @example
   * ```ts
   * const terminal = await client.machines.terminals.create({
   *   machine_id: 'machineID',
   *   height: 0,
   *   width: 0,
   * });
   * ```
   */
  create(params: TerminalCreateParams, options?: RequestOptions): APIPromise<Terminal> {
    const { machine_id, 'X-Dedalus-Org-Id': xDedalusOrgID, ...body } = params;
    return this._client.post(__scalarPath`/v1/machines/${machine_id}/terminals`, {
      body,
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }

  /**
   * Get terminal
   *
   * @param {TerminalRetrieveParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Terminal>} OK
   *
   * @example
   * ```ts
   * const terminal = await client.machines.terminals.retrieve({
   *   machine_id: 'machineID',
   *   terminal_id: 'terminalID',
   * });
   * ```
   */
  retrieve(params: TerminalRetrieveParams, options?: RequestOptions): APIPromise<Terminal> {
    const { machine_id, terminal_id, 'X-Dedalus-Org-Id': xDedalusOrgID } = params;
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/terminals/${terminal_id}`, {
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete terminal
   *
   * @param {TerminalDeleteParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Terminal>} OK
   *
   * @example
   * ```ts
   * const terminal = await client.machines.terminals.delete({
   *   machine_id: 'machineID',
   *   terminal_id: 'terminalID',
   * });
   * ```
   */
  delete(params: TerminalDeleteParams, options?: RequestOptions): APIPromise<Terminal> {
    const { machine_id, terminal_id, 'X-Dedalus-Org-Id': xDedalusOrgID } = params;
    return this._client.delete(__scalarPath`/v1/machines/${machine_id}/terminals/${terminal_id}`, {
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }

  /**
   * Upgrades to a WebSocket connection for interactive terminal I/O. Clients send JSON `TerminalClientEvent` messages and receive JSON `TerminalServerEvent` messages. Terminal byte streams are base64-encoded inside `input` and `output` events; `resize` events use integer `width` and `height` fields.
   *
   * @param {TerminalConnectParams} params - The parameters to send with the request.
   * @param {TerminalsWSClientOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {TerminalsWS} Switching Protocols to WebSocket
   *
   * @example
   * ```ts
   * const connection = client.machines.terminals.connect({
   *   machine_id: 'machineID',
   *   terminal_id: 'terminalID',
   * });
   *
   * try {
   *   for await (const message of connection) {
   *     console.log(message);
   *   }
   * } finally {
   *   connection.close();
   * }
   * ```
   */
  connect(params: TerminalConnectParams, options?: TerminalsWSClientOptions): TerminalsWS {
    const { machine_id, terminal_id, 'X-Dedalus-Org-Id': xDedalusOrgID } = params;
    return new TerminalsWS(
      this._client,
      {
        machine_id: machine_id,
        terminal_id: terminal_id,
        ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}),
      },
      options,
    );
  }
}

export interface TerminalCreateParams {
  /**
   * @format int64
   */
  height: number;
  /**
   * @format int64
   */
  width: number;
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
}

export interface Terminal {
  /**
   * @format date-time
   */
  created_at: string;
  /**
   * @format int64
   */
  height: number;
  machine_id: string;
  status: 'wake_in_progress' | 'ready' | 'closed' | 'expired' | 'failed';
  terminal_id: string;
  /**
   * @format int64
   */
  width: number;
  error_code?: string;
  error_message?: string;
  /**
   * @format date-time
   */
  expires_at?: string;
  protocol?: 'websocket';
  /**
   * @format date-time
   */
  ready_at?: string;
  /**
   * @format int64
   */
  retry_after_ms?: number;
  stream_url?: string;
}

export interface TerminalList {
  items: Array<Terminal> | null;
  next_cursor?: string;
}

export type TerminalClientEvent =
  | TerminalClientEvent.TerminalInputEvent
  | TerminalClientEvent.TerminalResizeEvent;

export namespace TerminalClientEvent {
  export interface TerminalInputEvent {
    /**
     * Base64-encoded terminal input.
     * @format byte
     */
    data: string;
    type: 'input';
  }

  export interface TerminalResizeEvent {
    /**
     * @format int64
     */
    height: number;
    type: 'resize';
    /**
     * @format int64
     */
    width: number;
  }
}

export type TerminalServerEvent =
  | TerminalServerEvent.TerminalOutputEvent
  | TerminalServerEvent.TerminalErrorEvent
  | TerminalServerEvent.TerminalClosedEvent;

export namespace TerminalServerEvent {
  export interface TerminalOutputEvent {
    /**
     * Base64-encoded terminal output.
     * @format byte
     */
    data: string;
    type: 'output';
  }

  export interface TerminalErrorEvent {
    type: 'error';
    error_code?: string;
    error_message?: string;
  }

  export interface TerminalClosedEvent {
    type: 'closed';
  }
}

export interface TerminalInputEvent {
  /**
   * Base64-encoded terminal input.
   * @format byte
   */
  data: string;
  type: 'input';
}

export interface TerminalResizeEvent {
  /**
   * @format int64
   */
  height: number;
  type: 'resize';
  /**
   * @format int64
   */
  width: number;
}

export interface TerminalOutputEvent {
  /**
   * Base64-encoded terminal output.
   * @format byte
   */
  data: string;
  type: 'output';
}

export interface TerminalErrorEvent {
  type: 'error';
  error_code?: string;
  error_message?: string;
}

export interface TerminalClosedEvent {
  type: 'closed';
}

export type ConnectClientEvent =
  | ConnectClientEvent.TerminalInputEvent
  | ConnectClientEvent.TerminalResizeEvent;

export namespace ConnectClientEvent {
  export interface TerminalInputEvent {
    /**
     * Base64-encoded terminal input.
     * @format byte
     */
    data: string;
    type: 'input';
  }

  export interface TerminalResizeEvent {
    /**
     * @format int64
     */
    height: number;
    type: 'resize';
    /**
     * @format int64
     */
    width: number;
  }
}

export type ConnectServerEvent =
  | ConnectServerEvent.TerminalOutputEvent
  | ConnectServerEvent.TerminalErrorEvent
  | ConnectServerEvent.TerminalClosedEvent;

export namespace ConnectServerEvent {
  export interface TerminalOutputEvent {
    /**
     * Base64-encoded terminal output.
     * @format byte
     */
    data: string;
    type: 'output';
  }

  export interface TerminalErrorEvent {
    type: 'error';
    error_code?: string;
    error_message?: string;
  }

  export interface TerminalClosedEvent {
    type: 'closed';
  }
}

export interface TerminalListParams extends CursorPageParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * Header param
   */
  'X-Dedalus-Org-Id'?: string;
}

export type TerminalsCursorPage = CursorPage<Terminal>;

export interface TerminalCreateParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * Header param
   */
  'X-Dedalus-Org-Id'?: string;
  /**
   * Body param
   */
  cwd?: string;
  /**
   * Body param
   */
  env?: Record<string, string>;
  /**
   * Body param
   * @format int64
   */
  height: number;
  /**
   * Body param
   */
  shell?: string;
  /**
   * Body param
   * @format int64
   */
  width: number;
}

export interface TerminalRetrieveParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * Path param
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  terminal_id: string;
  /**
   * Header param
   */
  'X-Dedalus-Org-Id'?: string;
}

export interface TerminalDeleteParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * Path param
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  terminal_id: string;
  /**
   * Header param
   */
  'X-Dedalus-Org-Id'?: string;
}

export interface TerminalConnectParams {
  /**
   * Path param: Machine identifier.
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * Path param: Terminal identifier.
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  terminal_id: string;
  /**
   * Header param: Organization ID header applied to all DCS requests.
   * @format uuid
   */
  'X-Dedalus-Org-Id'?: string;
}
export declare namespace Terminals {
  export {
    type TerminalCreateParams as TerminalCreateParams,
    type Terminal as Terminal,
    type TerminalList as TerminalList,
    type TerminalClientEvent as TerminalClientEvent,
    type TerminalServerEvent as TerminalServerEvent,
    type TerminalInputEvent as TerminalInputEvent,
    type TerminalResizeEvent as TerminalResizeEvent,
    type TerminalOutputEvent as TerminalOutputEvent,
    type TerminalErrorEvent as TerminalErrorEvent,
    type TerminalClosedEvent as TerminalClosedEvent,
    type TerminalsCursorPage as TerminalsCursorPage,
    type TerminalListParams as TerminalListParams,
    type TerminalRetrieveParams as TerminalRetrieveParams,
    type TerminalDeleteParams as TerminalDeleteParams,
    type TerminalConnectParams as TerminalConnectParams,
    type ConnectClientEvent as ConnectClientEvent,
    type ConnectServerEvent as ConnectServerEvent,
  };
}
