// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { WebSocket, type ClientOptions } from 'ws';
import { NodeWebSocket } from "../../internal/ws-adapter-node";
import { MachineLifecycleWSBase, type MachineLifecycleWSBaseOptions, type MachineLifecycleWSParameters } from "./ws-base";
import { Dedalus } from "../../client";

export type { MachineLifecycleWSParameters, MachineLifecycleWSReconnectOptions } from "./ws-base";

export interface MachineLifecycleWSClientOptions extends ClientOptions, MachineLifecycleWSBaseOptions {}

export class MachineLifecycleWS extends MachineLifecycleWSBase<NodeWebSocket> {
  private _wsOptions: ClientOptions | null | undefined;

  constructor(
    client: Dedalus,
    parameters: MachineLifecycleWSParameters,
    options?: MachineLifecycleWSClientOptions | null | undefined,
  ) {
    if (!WebSocket) {
      throw new Error(
        "MachineLifecycleWS requires the \"ws\" package but it could not be loaded.",
      );
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
