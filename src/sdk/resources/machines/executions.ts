// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../resource';
import { APIPromise } from '../../api-promise';
import { CursorPage, type CursorPageParams, type PagePromise } from '../../core/pagination';
import type { RequestOptions } from '../../internal/request-options';
import { buildHeaders } from '../../internal/headers';
import { path as __scalarPath } from '../../internal/utils/path';

export class Executions extends APIResource {
  /**
   * List executions
   *
   * @param {ExecutionListParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {PagePromise<ExecutionsCursorPage, Execution>} OK
   *
   * @example
   * ```ts
   * const page = await client.machines.executions.list({
   *   machine_id: 'machineID',
   * });
   * ```
   */
  list(params: ExecutionListParams, options?: RequestOptions): PagePromise<ExecutionsCursorPage, Execution> {
    const { machine_id, 'X-Dedalus-Org-Id': xDedalusOrgID, ...query } = params;
    return this._client.getAPIList(
      __scalarPath`/v1/machines/${machine_id}/executions`,
      CursorPage<Execution>,
      {
        query,
        ...options,
        headers: buildHeaders([
          { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
          options?.headers,
        ]),
      },
    );
  }

  /**
   * Create execution
   *
   * @param {ExecutionCreateParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Execution>} OK
   *
   * @example
   * ```ts
   * const execution = await client.machines.executions.create({
   *   machine_id: 'machineID',
   *   command: [''],
   * });
   * ```
   */
  create(params: ExecutionCreateParams, options?: RequestOptions): APIPromise<Execution> {
    const { machine_id, 'X-Dedalus-Org-Id': xDedalusOrgID, ...body } = params;
    return this._client.post(__scalarPath`/v1/machines/${machine_id}/executions`, {
      body,
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }

  /**
   * Get execution
   *
   * @param {ExecutionRetrieveParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Execution>} OK
   *
   * @example
   * ```ts
   * const execution = await client.machines.executions.retrieve({
   *   machine_id: 'machineID',
   *   execution_id: 'executionID',
   * });
   * ```
   */
  retrieve(params: ExecutionRetrieveParams, options?: RequestOptions): APIPromise<Execution> {
    const { machine_id, execution_id, 'X-Dedalus-Org-Id': xDedalusOrgID } = params;
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/executions/${execution_id}`, {
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete execution
   *
   * @param {ExecutionDeleteParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Execution>} OK
   *
   * @example
   * ```ts
   * const execution = await client.machines.executions.delete({
   *   machine_id: 'machineID',
   *   execution_id: 'executionID',
   * });
   * ```
   */
  delete(params: ExecutionDeleteParams, options?: RequestOptions): APIPromise<Execution> {
    const { machine_id, execution_id, 'X-Dedalus-Org-Id': xDedalusOrgID } = params;
    return this._client.delete(__scalarPath`/v1/machines/${machine_id}/executions/${execution_id}`, {
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }

  /**
   * Get execution output
   *
   * @param {ExecutionOutputParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<ExecutionOutput>} OK
   *
   * @example
   * ```ts
   * const execution = await client.machines.executions.output({
   *   machine_id: 'machineID',
   *   execution_id: 'executionID',
   * });
   * ```
   */
  output(params: ExecutionOutputParams, options?: RequestOptions): APIPromise<ExecutionOutput> {
    const { machine_id, execution_id, 'X-Dedalus-Org-Id': xDedalusOrgID } = params;
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/executions/${execution_id}/output`, {
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }

  /**
   * List execution events
   *
   * @param {ExecutionEventsParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {PagePromise<ExecutionEventsCursorPage, ExecutionEvent>} OK
   *
   * @example
   * ```ts
   * const page = await client.machines.executions.events({
   *   machine_id: 'machineID',
   *   execution_id: 'executionID',
   * });
   * ```
   */
  events(
    params: ExecutionEventsParams,
    options?: RequestOptions,
  ): PagePromise<ExecutionEventsCursorPage, ExecutionEvent> {
    const { machine_id, execution_id, 'X-Dedalus-Org-Id': xDedalusOrgID, ...query } = params;
    return this._client.getAPIList(
      __scalarPath`/v1/machines/${machine_id}/executions/${execution_id}/events`,
      CursorPage<ExecutionEvent>,
      {
        query,
        ...options,
        headers: buildHeaders([
          { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
          options?.headers,
        ]),
      },
    );
  }
}

export interface ExecutionCreateParams {
  command: Array<string> | null;
  cwd?: string;
  env?: Record<string, string>;
  stdin?: string;
  /**
   * @format int64
   */
  timeout_ms?: number;
}

export interface Execution {
  command: Array<string> | null;
  /**
   * @format date-time
   */
  created_at: string;
  execution_id: string;
  machine_id: string;
  status: 'wake_in_progress' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
  artifacts?: Array<ArtifactRef> | null;
  /**
   * @format date-time
   */
  completed_at?: string;
  cwd?: string;
  env_keys?: Array<string> | null;
  error_code?: string;
  error_message?: string;
  /**
   * @format int64
   */
  exit_code?: number;
  /**
   * @format date-time
   */
  expires_at?: string;
  /**
   * @format int64
   */
  retry_after_ms?: number;
  /**
   * @format int64
   */
  signal?: number;
  /**
   * @format date-time
   */
  started_at?: string;
  /**
   * @format int64
   */
  stderr_bytes?: number;
  stderr_truncated?: boolean;
  /**
   * @format int64
   */
  stdout_bytes?: number;
  stdout_truncated?: boolean;
}

export interface ExecutionList {
  items: Array<Execution> | null;
  next_cursor?: string;
}

export interface ExecutionOutput {
  execution_id: string;
  stderr?: string;
  /**
   * @format int64
   */
  stderr_bytes?: number;
  stderr_truncated?: boolean;
  stdout?: string;
  /**
   * @format int64
   */
  stdout_bytes?: number;
  stdout_truncated?: boolean;
}

export interface ExecutionEvent {
  /**
   * @format date-time
   */
  at: string;
  /**
   * @format int64
   */
  sequence: number;
  type: 'lifecycle' | 'stdout' | 'stderr';
  chunk?: string;
  error_code?: string;
  error_message?: string;
  /**
   * @format int64
   */
  exit_code?: number;
  /**
   * @format int64
   */
  signal?: number;
  status?: 'wake_in_progress' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
}

export interface ExecutionEvents {
  items: Array<ExecutionEvent> | null;
  next_cursor?: string;
}

export interface ArtifactRef {
  artifact_id: string;
  name: string;
}

export interface ExecutionListParams extends CursorPageParams {
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

export type ExecutionsCursorPage = CursorPage<Execution>;

export interface ExecutionCreateParams {
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
  command: Array<string> | null;
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
   */
  stdin?: string;
  /**
   * Body param
   * @format int64
   */
  timeout_ms?: number;
}

export interface ExecutionRetrieveParams {
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
  execution_id: string;
  /**
   * Header param
   */
  'X-Dedalus-Org-Id'?: string;
}

export interface ExecutionDeleteParams {
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
  execution_id: string;
  /**
   * Header param
   */
  'X-Dedalus-Org-Id'?: string;
}

export interface ExecutionOutputParams {
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
  execution_id: string;
  /**
   * Header param
   */
  'X-Dedalus-Org-Id'?: string;
}

export interface ExecutionEventsParams extends CursorPageParams {
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
  execution_id: string;
  /**
   * Header param
   */
  'X-Dedalus-Org-Id'?: string;
}

export type ExecutionEventsCursorPage = CursorPage<ExecutionEvent>;
export declare namespace Executions {
  export {
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
}
