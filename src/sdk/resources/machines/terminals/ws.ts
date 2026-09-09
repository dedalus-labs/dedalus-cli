// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { WebSocket, type ClientOptions } from 'ws';
import { NodeWebSocket } from '../../../internal/ws-adapter-node';
import { TerminalsWSBase, type TerminalsWSBaseOptions, type TerminalsWSParameters } from './ws-base';
import { Dedalus } from '../../../client';

export type { TerminalsWSParameters, TerminalsWSReconnectOptions } from './ws-base';

export interface TerminalsWSClientOptions extends ClientOptions, TerminalsWSBaseOptions {}

export class TerminalsWS extends TerminalsWSBase<NodeWebSocket> {
  private _wsOptions: ClientOptions | null | undefined;

  constructor(
    client: Dedalus,
    parameters: TerminalsWSParameters,
    options?: TerminalsWSClientOptions | null | undefined,
  ) {
    if (!WebSocket) {
      throw new Error('TerminalsWS requires the "ws" package but it could not be loaded.');
    }

    const { reconnect, maxQueueSize, ...wsOptions } = options ?? {};
    super(client, parameters, { reconnect, maxQueueSize });
    this._wsOptions = wsOptions;
    this._connectInitial();
  }

  protected _createSocket(url: URL, authHeaders: Record<string, string>): NodeWebSocket {
    const ws = new WebSocket(url, {
      ...this._wsOptions,
      headers: {
        ...authHeaders,
        ...this._wsOptions?.headers,
      },
    });
    return new NodeWebSocket(ws);
  }
}
