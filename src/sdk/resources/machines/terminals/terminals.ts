// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../../resource';
import { APIPromise } from '../../../api-promise';
import type { RequestOptions } from '../../../internal/request-options';
import { path as __scalarPath } from '../../../internal/utils/path';
import { TerminalsWS, type TerminalsWSClientOptions } from './ws';

export class Terminals extends APIResource {
  /**
   * @param {TerminalConnectParams} params - The parameters to send with the request.
   * @param {TerminalsWSClientOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {TerminalsWS}
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
    const { machine_id, terminal_id } = params;
    return new TerminalsWS(this._client, { machine_id: machine_id, terminal_id: terminal_id }, options);
  }
}

export type ConnectClientEvent = unknown;

export type ConnectServerEvent = unknown;

export interface TerminalConnectParams {
  machine_id: string;
  terminal_id: string;
}
export declare namespace Terminals {
  export {
    type TerminalConnectParams as TerminalConnectParams,
    type ConnectClientEvent as ConnectClientEvent,
    type ConnectServerEvent as ConnectServerEvent,
  };
}
