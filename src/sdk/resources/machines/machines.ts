// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../resource';
import { APIPromise } from '../../api-promise';
import { CursorPage, type CursorPageParams, type PagePromise } from '../../core/pagination';
import { Stream } from '../../core/streaming';
import type { RequestOptions } from '../../internal/request-options';
import { buildHeaders } from '../../internal/headers';
import { path as __scalarPath } from '../../internal/utils/path';
import * as NetworkAPI from './network';
import { Network, type MachineNetwork, type NetworkRetrieveParams } from './network';
import * as ArtifactsAPI from './artifacts';
import {
  Artifacts,
  type Artifact,
  type ArtifactList,
  type ArtifactsCursorPage,
  type ArtifactListParams,
  type ArtifactRetrieveParams,
  type ArtifactDeleteParams,
} from './artifacts';
import * as PortsAPI from './ports';
import {
  Ports,
  type PortCreateParams,
  type Port,
  type PortList,
  type PortsCursorPage,
  type PortListParams,
  type PortRetrieveParams,
  type PortDeleteParams,
} from './ports';
import * as SSHAPI from './ssh';
import {
  SSH,
  type SSHSessionCreateParams,
  type SSHSession,
  type SSHSessionList,
  type SSHConnection,
  type SSHHostTrust,
  type SSHSessionsCursorPage,
  type SSHListParams,
  type SSHCreateParams,
  type SSHRetrieveParams,
  type SSHDeleteParams,
} from './ssh';
import * as ExecutionsAPI from './executions';
import {
  Executions,
  type ExecutionCreateParams,
  type Execution,
  type ExecutionList,
  type ExecutionOutput,
  type ExecutionEvent,
  type ExecutionEvents,
  type ArtifactRef,
  type ExecutionsCursorPage,
  type ExecutionEventsCursorPage,
  type ExecutionListParams,
  type ExecutionRetrieveParams,
  type ExecutionDeleteParams,
  type ExecutionOutputParams,
  type ExecutionEventsParams,
} from './executions';
import * as TerminalsAPI from './terminals/terminals';
import {
  Terminals,
  type TerminalCreateParams,
  type Terminal,
  type TerminalList,
  type TerminalClientEvent,
  type TerminalServerEvent,
  type TerminalInputEvent,
  type TerminalResizeEvent,
  type TerminalOutputEvent,
  type TerminalErrorEvent,
  type TerminalClosedEvent,
  type TerminalsCursorPage,
  type TerminalListParams,
  type TerminalRetrieveParams,
  type TerminalDeleteParams,
  type TerminalConnectParams,
  type ConnectClientEvent,
  type ConnectServerEvent,
} from './terminals/terminals';

export class Machines extends APIResource {
  network: NetworkAPI.Network = new NetworkAPI.Network(this._client);
  artifacts: ArtifactsAPI.Artifacts = new ArtifactsAPI.Artifacts(this._client);
  ports: PortsAPI.Ports = new PortsAPI.Ports(this._client);
  ssh: SSHAPI.SSH = new SSHAPI.SSH(this._client);
  executions: ExecutionsAPI.Executions = new ExecutionsAPI.Executions(this._client);
  terminals: TerminalsAPI.Terminals = new TerminalsAPI.Terminals(this._client);

  /**
   * List machines
   *
   * @param {MachineListParams} [params] - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {PagePromise<MachineListItemsCursorPage, MachineListItem>} OK
   *
   * @example
   * ```ts
   * const page = await client.machines.list();
   * ```
   */
  list(
    params: MachineListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<MachineListItemsCursorPage, MachineListItem> {
    const { 'X-Dedalus-Org-Id': xDedalusOrgID, ...query } = params ?? {};
    return this._client.getAPIList('/v1/machines', CursorPage<MachineListItem>, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }

  /**
   * Create machine
   *
   * @param {MachineCreateParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Machine>} Create converged inline
   *
   * @example
   * ```ts
   * const machine = await client.machines.create({
   *   autosleep: '300s',
   *   memory_mib: 4096,
   *   storage_gib: 10,
   *   vcpu: 1,
   * });
   * ```
   */
  create(params: MachineCreateParams, options?: RequestOptions): APIPromise<Machine> {
    const { 'X-Dedalus-Org-Id': xDedalusOrgID, ...body } = params;
    return this._client.post('/v1/machines', {
      body,
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }

  /**
   * Get machine
   *
   * @param {MachineRetrieveParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineRetrieveResponse>} OK
   *
   * @example
   * ```ts
   * const machine = await client.machines.retrieve({
   *   machine_id: 'machineID',
   * });
   * ```
   */
  retrieve(params: MachineRetrieveParams, options?: RequestOptions): APIPromise<MachineRetrieveResponse> {
    const { machine_id, 'X-Dedalus-Org-Id': xDedalusOrgID } = params;
    return this._client.get(__scalarPath`/v1/machines/${machine_id}`, {
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }

  /**
   * Update machine
   *
   * @param {MachineUpdateParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Machine>} OK
   *
   * @example
   * ```ts
   * const machine = await client.machines.update({
   *   machine_id: 'machineID',
   * });
   * ```
   */
  update(params: MachineUpdateParams, options?: RequestOptions): APIPromise<Machine> {
    const { machine_id, 'X-Dedalus-Org-Id': xDedalusOrgID, ...body } = params;
    return this._client.patch(__scalarPath`/v1/machines/${machine_id}`, {
      body,
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }

  /**
   * Destroy machine
   *
   * @param {MachineDeleteParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Machine>} OK
   *
   * @example
   * ```ts
   * const machine = await client.machines.delete({
   *   machine_id: 'machineID',
   * });
   * ```
   */
  delete(params: MachineDeleteParams, options?: RequestOptions): APIPromise<Machine> {
    const { machine_id, 'X-Dedalus-Org-Id': xDedalusOrgID } = params;
    return this._client.delete(__scalarPath`/v1/machines/${machine_id}`, {
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }

  /**
   * Streams machine lifecycle updates over Server-Sent Events. Each `status` event contains a full `LifecycleResponse` payload. The stream closes after the machine reaches its current desired state.
   *
   * @param {MachineWatchParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Stream<Machine>>} Server-Sent Event stream (`text/event-stream`) of machine lifecycle updates.
   *
   * @example
   * ```ts
   * const stream = await client.machines.watch({
   *   machine_id: 'machineID',
   * });
   *
   * for await (const machine of stream) {
   *   console.log(machine);
   * }
   * ```
   */
  watch(params: MachineWatchParams, options?: RequestOptions): APIPromise<Stream<Machine>> {
    const { machine_id, 'X-Dedalus-Org-Id': xDedalusOrgID, 'Last-Event-ID': lastEventID } = params;
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/status/stream`, {
      ...options,
      headers: buildHeaders([
        {
          Accept: 'text/event-stream',
          ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}),
          ...(lastEventID !== undefined ? { 'Last-Event-ID': lastEventID } : {}),
        },
        options?.headers,
      ]),
      stream: true,
    });
  }

  /**
   * Sleep a running machine
   *
   * @param {MachineSleepParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Machine>} OK
   *
   * @example
   * ```ts
   * const machine = await client.machines.sleep({
   *   machine_id: 'machineID',
   * });
   * ```
   */
  sleep(params: MachineSleepParams, options?: RequestOptions): APIPromise<Machine> {
    const { machine_id, 'X-Dedalus-Org-Id': xDedalusOrgID } = params;
    return this._client.post(__scalarPath`/v1/machines/${machine_id}/sleep`, {
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }

  /**
   * Wake a sleeping machine
   *
   * @param {MachineWakeParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Machine>} OK
   *
   * @example
   * ```ts
   * const machine = await client.machines.wake({
   *   machine_id: 'machineID',
   * });
   * ```
   */
  wake(params: MachineWakeParams, options?: RequestOptions): APIPromise<Machine> {
    const { machine_id, 'X-Dedalus-Org-Id': xDedalusOrgID } = params;
    return this._client.post(__scalarPath`/v1/machines/${machine_id}/wake`, {
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }
}

export interface Machine {
  /**
   * Seconds of inactivity before autosleep. 0 disables autosleep.
   * @format int64
   * @minimum 0
   * @maximum 9223372036
   */
  autosleep_seconds: number;
  desired_state: 'running' | 'sleeping' | 'destroyed';
  machine_id: string;
  /**
   * Memory in MiB.
   * @format int64
   */
  memory_mib: number;
  phase:
    | 'accepted'
    | 'placement_pending'
    | 'starting'
    | 'running'
    | 'stopping'
    | 'sleeping'
    | 'destroying'
    | 'destroyed'
    | 'failed';
  /**
   * @format int64
   */
  storage_gib: number;
  /**
   * CPU in vCPUs.
   * @format double
   */
  vcpu: number;
}

export interface MachineList {
  items: Array<MachineListItem> | null;
  next_cursor?: string;
}

export interface MachineListItem {
  /**
   * Seconds of inactivity before autosleep. 0 disables autosleep.
   * @format int64
   * @minimum 0
   * @maximum 9223372036
   */
  autosleep_seconds: number;
  /**
   * @format date-time
   */
  created_at: string;
  desired_state: 'running' | 'sleeping' | 'destroyed';
  machine_id: string;
  /**
   * Memory in MiB.
   * @format int64
   */
  memory_mib: number;
  phase:
    | 'accepted'
    | 'placement_pending'
    | 'starting'
    | 'running'
    | 'stopping'
    | 'sleeping'
    | 'destroying'
    | 'destroyed'
    | 'failed';
  /**
   * @format int64
   */
  storage_gib: number;
  /**
   * CPU in vCPUs.
   * @format double
   */
  vcpu: number;
}

export interface CreateParams {
  /**
   * Idle window before autosleep. Accepts fixed duration units like 30s, 30m, 2h, 7d3h4s, or 1w3d, raw seconds ("1800"), or never to disable.
   * @default 300s
   */
  autosleep?: string;
  /**
   * Memory in MiB.
   * @default 4096
   * @format int64
   * @exclusiveMinimum 0
   */
  memory_mib?: number;
  /**
   * Storage in GiB.
   * @default 10
   * @format int64
   * @exclusiveMinimum 0
   */
  storage_gib?: number;
  /**
   * CPU in vCPUs.
   * @default 1
   * @format double
   * @exclusiveMinimum 0
   */
  vcpu?: number;
}

export interface UpdateParams {
  /**
   * Idle window before autosleep. Accepts fixed duration units like 30s, 30m, 2h, 7d3h4s, or 1w3d, raw seconds ("1800"), or never to disable.
   */
  autosleep?: string;
  /**
   * Memory in MiB.
   * @format int64
   */
  memory_mib?: number;
  /**
   * Storage in GiB.
   * @format int64
   */
  storage_gib?: number;
  /**
   * CPU in vCPUs.
   * @format double
   */
  vcpu?: number;
}

export interface LifecycleStatus {
  /**
   * @format date-time
   */
  last_progress_at: string;
  /**
   * @format date-time
   */
  last_transition_at: string;
  phase:
    | 'accepted'
    | 'placement_pending'
    | 'starting'
    | 'running'
    | 'stopping'
    | 'sleeping'
    | 'destroying'
    | 'destroyed'
    | 'failed';
  reason: string;
  retryable: boolean;
  revision: string;
  last_error?: string;
}

export interface MachineListParams extends CursorPageParams {
  'X-Dedalus-Org-Id'?: string;
}

export type MachineListItemsCursorPage = CursorPage<MachineListItem>;

export interface MachineCreateParams {
  /**
   * Header param
   */
  'X-Dedalus-Org-Id'?: string;
  /**
   * Body param: Idle window before autosleep. Accepts fixed duration units like 30s, 30m, 2h, 7d3h4s, or 1w3d, raw seconds ("1800"), or never to disable.
   * @default 300s
   */
  autosleep?: string;
  /**
   * Body param: Memory in MiB.
   * @default 4096
   * @format int64
   * @exclusiveMinimum 0
   */
  memory_mib?: number;
  /**
   * Body param: Storage in GiB.
   * @default 10
   * @format int64
   * @exclusiveMinimum 0
   */
  storage_gib?: number;
  /**
   * Body param: CPU in vCPUs.
   * @default 1
   * @format double
   * @exclusiveMinimum 0
   */
  vcpu?: number;
}

export interface MachineRetrieveParams {
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

export interface MachineRetrieveResponse {
  /**
   * Seconds of inactivity before autosleep. 0 disables autosleep.
   * @format int64
   * @minimum 0
   * @maximum 9223372036
   */
  autosleep_seconds: number;
  desired_state: 'running' | 'sleeping' | 'destroyed';
  machine_id: string;
  /**
   * Memory in MiB.
   * @format int64
   */
  memory_mib: number;
  status: LifecycleStatus;
  /**
   * @format int64
   */
  storage_gib: number;
  /**
   * CPU in vCPUs.
   * @format double
   */
  vcpu: number;
}

export interface MachineUpdateParams {
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
   * Body param: Idle window before autosleep. Accepts fixed duration units like 30s, 30m, 2h, 7d3h4s, or 1w3d, raw seconds ("1800"), or never to disable.
   */
  autosleep?: string;
  /**
   * Body param: Memory in MiB.
   * @format int64
   */
  memory_mib?: number;
  /**
   * Body param: Storage in GiB.
   * @format int64
   */
  storage_gib?: number;
  /**
   * Body param: CPU in vCPUs.
   * @format double
   */
  vcpu?: number;
}

export interface MachineDeleteParams {
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

export interface MachineWatchParams {
  /**
   * Path param: Machine identifier.
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * Header param: Organization ID header applied to all DCS requests.
   * @format uuid
   */
  'X-Dedalus-Org-Id'?: string;
  /**
   * Header param: Optional resourceVersion bookmark used to resume a previous stream.
   */
  'Last-Event-ID'?: string;
}

export interface MachineSleepParams {
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

export interface MachineWakeParams {
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
Machines.Network = Network;
Machines.Artifacts = Artifacts;
Machines.Ports = Ports;
Machines.SSH = SSH;
Machines.Executions = Executions;
Machines.Terminals = Terminals;

export declare namespace Machines {
  export {
    type Machine as Machine,
    type MachineList as MachineList,
    type MachineListItem as MachineListItem,
    type CreateParams as CreateParams,
    type UpdateParams as UpdateParams,
    type LifecycleStatus as LifecycleStatus,
    type MachineListItemsCursorPage as MachineListItemsCursorPage,
    type MachineRetrieveResponse as MachineRetrieveResponse,
    type MachineListParams as MachineListParams,
    type MachineCreateParams as MachineCreateParams,
    type MachineRetrieveParams as MachineRetrieveParams,
    type MachineUpdateParams as MachineUpdateParams,
    type MachineDeleteParams as MachineDeleteParams,
    type MachineWatchParams as MachineWatchParams,
    type MachineSleepParams as MachineSleepParams,
    type MachineWakeParams as MachineWakeParams,
  };

  export {
    Network as Network,
    type MachineNetwork as MachineNetwork,
    type NetworkRetrieveParams as NetworkRetrieveParams,
  };

  export {
    Artifacts as Artifacts,
    type Artifact as Artifact,
    type ArtifactList as ArtifactList,
    type ArtifactsCursorPage as ArtifactsCursorPage,
    type ArtifactListParams as ArtifactListParams,
    type ArtifactRetrieveParams as ArtifactRetrieveParams,
    type ArtifactDeleteParams as ArtifactDeleteParams,
  };

  export {
    Ports as Ports,
    type PortCreateParams as PortCreateParams,
    type Port as Port,
    type PortList as PortList,
    type PortsCursorPage as PortsCursorPage,
    type PortListParams as PortListParams,
    type PortRetrieveParams as PortRetrieveParams,
    type PortDeleteParams as PortDeleteParams,
  };

  export {
    SSH as SSH,
    type SSHSessionCreateParams as SSHSessionCreateParams,
    type SSHSession as SSHSession,
    type SSHSessionList as SSHSessionList,
    type SSHConnection as SSHConnection,
    type SSHHostTrust as SSHHostTrust,
    type SSHSessionsCursorPage as SSHSessionsCursorPage,
    type SSHListParams as SSHListParams,
    type SSHCreateParams as SSHCreateParams,
    type SSHRetrieveParams as SSHRetrieveParams,
    type SSHDeleteParams as SSHDeleteParams,
  };

  export {
    Executions as Executions,
    type ExecutionCreateParams as ExecutionCreateParams,
    type Execution as Execution,
    type ExecutionList as ExecutionList,
    type ExecutionOutput as ExecutionOutput,
    type ExecutionEvent as ExecutionEvent,
    type ExecutionEvents as ExecutionEvents,
    type ArtifactRef as ArtifactRef,
    type ExecutionsCursorPage as ExecutionsCursorPage,
    type ExecutionEventsCursorPage as ExecutionEventsCursorPage,
    type ExecutionListParams as ExecutionListParams,
    type ExecutionRetrieveParams as ExecutionRetrieveParams,
    type ExecutionDeleteParams as ExecutionDeleteParams,
    type ExecutionOutputParams as ExecutionOutputParams,
    type ExecutionEventsParams as ExecutionEventsParams,
  };

  export {
    Terminals as Terminals,
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
