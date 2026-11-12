// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../resource';
import { APIPromise } from '../../api-promise';
import { CursorPage, type CursorPageParams, type PagePromise } from '../../core/pagination';
import { Stream } from '../../core/streaming';
import type { RequestOptions } from '../../internal/request-options';
import { buildHeaders } from '../../internal/headers';
import { path as __scalarPath } from '../../internal/utils/path';
import type * as ImagesAPI from '../images/images';
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
import * as ExecutionsAPI from './executions/executions';
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
} from './executions/executions';
import * as AutoresizingAPI from './autoresizing';
import {
  Autoresizing,
  type Policy,
  type AutoresizingRetrieveParams,
  type AutoresizingUpdateParams,
} from './autoresizing';

export class Machines extends APIResource {
  ssh: SSHAPI.SSH = new SSHAPI.SSH(this._client);
  executions: ExecutionsAPI.Executions = new ExecutionsAPI.Executions(this._client);
  autoresizing: AutoresizingAPI.Autoresizing = new AutoresizingAPI.Autoresizing(this._client);

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
   * @returns {APIPromise<Machine>} Create has converged
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
   * Changes settings such as autosleep.
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
    const { machine_id, force } = params;
    return this._client.delete(__scalarPath`/v1/machines/${machine_id}`, { query: { force }, ...options });
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

  /**
   * Checkpoints files and replaces the runtime. The machine ID and filesystem are preserved. RAM, processes, and temporary mounts are cleared. Poll the machine until its phase is running. Retry the same Idempotency-Key after a lost response.
   *
   * @param {MachineRebootParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Machine>} OK
   *
   * @example
   * ```ts
   * const machine = await client.machines.reboot({
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   * });
   * ```
   */
  reboot(params: MachineRebootParams, options?: RequestOptions): APIPromise<Machine> {
    const { machine_id, force } = params;
    return this._client.post(__scalarPath`/v1/machines/${machine_id}/reboot`, {
      query: { force },
      ...options,
    });
  }

  /**
   * Wakes a sleeping Machine, then waits up to 30 seconds for the host to confirm CPU and RAM. Returns the Machine with its confirmed size. After RESIZE_TIMEOUT, repeat the same request and Idempotency-Key to wait again.
   *
   * @param {MachineResizeParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineResizeResponse>} Machine with the confirmed size.
   *
   * @example
   * ```ts
   * const machine = await client.machines.resize({
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   * });
   * ```
   */
  resize(params: MachineResizeParams, options?: RequestOptions): APIPromise<MachineResizeResponse> {
    const { machine_id, ...body } = params;
    return this._client.post(__scalarPath`/v1/machines/${machine_id}/resize`, { body, ...options });
  }

  /**
   * Streams lifecycle changes as Server-Sent Events. Each `status` event carries the full machine, in the same shape as Get machine. The stream closes when the machine reaches its desired state, or after five minutes. A `bookmark` event moves the resume point without a change. An `error` event carries an error envelope, and the stream ends after it.
   *
   * @param {MachineWatchParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Stream<MachineWatchResponse>>} Server-Sent Events stream of machine status.
   *
   * @example
   * ```ts
   * const stream = await client.machines.watch({
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   * });
   *
   * for await (const event of stream) {
   *   console.log(event);
   * }
   * ```
   */
  watch(params: MachineWatchParams, options?: RequestOptions): APIPromise<Stream<MachineWatchResponse>> {
    const { machine_id, 'Last-Event-ID': lastEventID } = params;
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/status/stream`, {
      ...options,
      headers: buildHeaders([
        {
          Accept: 'text/event-stream',
          ...(lastEventID !== undefined ? { 'Last-Event-ID': lastEventID } : {}),
        },
        options?.headers,
      ]),
      stream: true,
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
   * Organization-owned ready custom image ID. Requires Pro. Omit for the platform default.
   * @minLength 1
   * @pattern ^\S+$
   */
  image_id?: string;
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
  autosleep?: string;
  /**
   * @format int64
   */
  storage_gib?: number;
}

export interface LifecycleStatus {
  autoresize: LifecycleStatus.Autoresize;
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

export namespace LifecycleStatus {
  export interface Autoresize {
    cpu: Autoresize.CPU | null;
    memory: Autoresize.Memory | null;
  }

  export namespace Autoresize {
    export interface CPU {
      /**
       * Time the current refusal was first recorded.
       * @format date-time
       */
      blocked_at?: string;
      /**
       * Why the latest automatic increase could not proceed, as the error code an explicit resize would return. Absent once an automatic increase is accepted.
       */
      blocked_reason?:
        | 'MACHINE_GROWTH_LIMIT_REACHED'
        | 'MACHINE_TIER_SHAPE_EXCEEDED'
        | 'MACHINE_QUOTA_EXCEEDED'
        | 'MACHINE_MEMORY_ABOVE_LIMIT'
        | 'ASSIGNED_HOST_CAPACITY_CONFLICT'
        | 'MACHINE_PLACEMENT_EXHAUSTED'
        | 'MACHINE_RESIZE_UNAVAILABLE'
        | 'MACHINE_SHAPE_UNSUPPORTED';
    }

    export interface Memory {
      /**
       * Time the current refusal was first recorded.
       * @format date-time
       */
      blocked_at?: string;
      /**
       * Why the latest automatic increase could not proceed, as the error code an explicit resize would return. Absent once an automatic increase is accepted.
       */
      blocked_reason?:
        | 'MACHINE_GROWTH_LIMIT_REACHED'
        | 'MACHINE_TIER_SHAPE_EXCEEDED'
        | 'MACHINE_QUOTA_EXCEEDED'
        | 'MACHINE_MEMORY_ABOVE_LIMIT'
        | 'ASSIGNED_HOST_CAPACITY_CONFLICT'
        | 'MACHINE_PLACEMENT_EXHAUSTED'
        | 'MACHINE_RESIZE_UNAVAILABLE'
        | 'MACHINE_SHAPE_UNSUPPORTED';
    }
  }
}

export type AutoresizingSwitch = 'on' | 'off';

export interface MachineListParams extends CursorPageParams {}

export type MachineListItemsCursorPage = CursorPage<MachineListItem>;

export interface MachineCreateParams {
  /**
   * Idle window before autosleep. Accepts fixed duration units like 30s, 30m, 2h, 7d3h4s, or 1w3d, raw seconds ("1800"), or never to disable.
   * @default 300s
   */
  autosleep?: string;
  /**
   * Organization-owned ready custom image ID. Requires Pro. Omit for the platform default.
   * @minLength 1
   * @pattern ^\S+$
   */
  image_id?: string;
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
   * Body param
   */
  autosleep?: string;
  /**
   * Body param
   * @format int64
   */
  storage_gib?: number;
}

export interface MachineDeleteParams {
  /**
   * Path param: Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * Query param: Destroy from the last published filesystem checkpoint without publishing the Machine's remaining writes, whether the Machine is running or failed. Unpublished file writes are lost. The default publishes them first, and waits while it cannot.
   */
  force?: boolean;
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

export interface MachineRebootParams {
  /**
   * Path param: Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * Query param: Recover from the last committed filesystem checkpoint without guest cooperation. Unpublished file writes are lost. The default checkpoints files before rebooting.
   */
  force?: boolean;
}

export interface MachineResizeParams {
  /**
   * Path param: Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * Body param: RAM in MiB.
   * @format int64
   */
  memory_mib?: number;
  /**
   * Body param: CPU in 0.25-vCPU steps.
   * @format double
   */
  vcpu?: number;
}

export interface MachineResizeResponse {
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

export interface MachineWatchParams {
  /**
   * Path param: Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * Header param: The `id` of an event from an earlier stream. The stream resumes after that event instead of sending the current state first.
   */
  'Last-Event-ID'?: string;
}

export interface MachineWatchResponse {
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
Machines.SSH = SSH;
Machines.Executions = Executions;
Machines.Autoresizing = Autoresizing;

export declare namespace Machines {
  export {
    type Machine as Machine,
    type MachineList as MachineList,
    type MachineListItem as MachineListItem,
    type CreateParams as CreateParams,
    type UpdateParams as UpdateParams,
    type LifecycleStatus as LifecycleStatus,
    type AutoresizingSwitch as AutoresizingSwitch,
    type MachineListItemsCursorPage as MachineListItemsCursorPage,
    type MachineRetrieveResponse as MachineRetrieveResponse,
    type MachineResizeResponse as MachineResizeResponse,
    type MachineWatchResponse as MachineWatchResponse,
    type MachineListParams as MachineListParams,
    type MachineCreateParams as MachineCreateParams,
    type MachineRetrieveParams as MachineRetrieveParams,
    type MachineUpdateParams as MachineUpdateParams,
    type MachineDeleteParams as MachineDeleteParams,
    type MachineSleepParams as MachineSleepParams,
    type MachineWakeParams as MachineWakeParams,
    type MachineRebootParams as MachineRebootParams,
    type MachineResizeParams as MachineResizeParams,
    type MachineWatchParams as MachineWatchParams,
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
    Autoresizing as Autoresizing,
    type Policy as Policy,
    type AutoresizingRetrieveParams as AutoresizingRetrieveParams,
    type AutoresizingUpdateParams as AutoresizingUpdateParams,
  };
}
