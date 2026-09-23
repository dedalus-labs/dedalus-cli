// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../resource';
import { APIPromise } from '../../api-promise';
import { CursorPage, type CursorPageParams, type PagePromise } from '../../core/pagination';
import type { RequestOptions } from '../../internal/request-options';
import { path as __scalarPath } from '../../internal/utils/path';
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
  type TerminalConnectParams,
  type ConnectClientEvent,
  type ConnectServerEvent,
} from './terminals/terminals';

export class Machines extends APIResource {
  ssh: SSHAPI.SSH = new SSHAPI.SSH(this._client);
  executions: ExecutionsAPI.Executions = new ExecutionsAPI.Executions(this._client);
  terminals: TerminalsAPI.Terminals = new TerminalsAPI.Terminals(this._client);

  /**
   * List machines
   *
   * @param {MachineListParams} [query] - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {PagePromise<MachineListItemsCursorPage, MachineListItem>} OK
   *
   * @example
   * ```ts
   * const page = await client.machines.list();
   * ```
   */
  list(
    query: MachineListParams | null | undefined = {},
    options?: RequestOptions,
  ): PagePromise<MachineListItemsCursorPage, MachineListItem> {
    return this._client.getAPIList('/v1/machines', CursorPage<MachineListItem>, { query, ...options });
  }

  /**
   * Create machine
   *
   * @param {MachineCreateParams} body - The request body to send.
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
  create(body: MachineCreateParams, options?: RequestOptions): APIPromise<Machine> {
    return this._client.post('/v1/machines', { body, ...options });
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
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   * });
   * ```
   */
  retrieve(params: MachineRetrieveParams, options?: RequestOptions): APIPromise<MachineRetrieveResponse> {
    const { machine_id } = params;
    return this._client.get(__scalarPath`/v1/machines/${machine_id}`, options);
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
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   * });
   * ```
   */
  update(params: MachineUpdateParams, options?: RequestOptions): APIPromise<Machine> {
    const { machine_id, ...body } = params;
    return this._client.patch(__scalarPath`/v1/machines/${machine_id}`, { body, ...options });
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
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   * });
   * ```
   */
  delete(params: MachineDeleteParams, options?: RequestOptions): APIPromise<Machine> {
    const { machine_id } = params;
    return this._client.delete(__scalarPath`/v1/machines/${machine_id}`, options);
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
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   * });
   * ```
   */
  sleep(params: MachineSleepParams, options?: RequestOptions): APIPromise<Machine> {
    const { machine_id } = params;
    return this._client.post(__scalarPath`/v1/machines/${machine_id}/sleep`, options);
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
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   * });
   * ```
   */
  wake(params: MachineWakeParams, options?: RequestOptions): APIPromise<Machine> {
    const { machine_id } = params;
    return this._client.post(__scalarPath`/v1/machines/${machine_id}/wake`, options);
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
  /**
   * @format uuid
   */
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
  /**
   * @format uuid
   */
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
  /**
   * Accepted RAM maximum, including completed automatic increases.
   * @format int64
   * @minimum 1
   */
  memory_configured_mib: number;
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
  /**
   * Last confirmed RAM allocation for the current running generation. Absent when the allocation is unknown or no longer current.
   * @format int64
   * @minimum 1
   */
  memory_assigned_mib?: number;
  /**
   * Time of the latest confirmed automatic RAM increase. Does not include explicit resizing or a complete change history.
   * @format date-time
   */
  memory_last_autoresized_at?: string;
  /**
   * Resize progress reported by the current runtime. A pending automatic target may not yet be applied by that runtime.
   */
  memory_resize_state?: 'stable' | 'error' | 'pending_capacity';
  /**
   * Pending automatic RAM target, or the current runtime target when no automatic target is pending.
   * @format int64
   * @minimum 1
   */
  memory_target_mib?: number;
}

export interface MachineListParams extends CursorPageParams {}

export type MachineListItemsCursorPage = CursorPage<MachineListItem>;

export interface MachineCreateParams {
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

export interface MachineRetrieveParams {
  /**
   * Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
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
  /**
   * @format uuid
   */
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
   * Path param: Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
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
   * Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
}

export interface MachineSleepParams {
  /**
   * Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
}

export interface MachineWakeParams {
  /**
   * Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
}
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
    type MachineSleepParams as MachineSleepParams,
    type MachineWakeParams as MachineWakeParams,
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
    type TerminalConnectParams as TerminalConnectParams,
    type ConnectClientEvent as ConnectClientEvent,
    type ConnectServerEvent as ConnectServerEvent,
  };
}
