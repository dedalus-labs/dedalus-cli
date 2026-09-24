// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../../resource';
import { APIPromise } from '../../../api-promise';
import { CursorPage, type CursorPageParams, type PagePromise } from '../../../core/pagination';
import type { RequestOptions } from '../../../internal/request-options';
import { path as __scalarPath } from '../../../internal/utils/path';
import * as LogsAPI from './logs';
import {
  Logs,
  type Status,
  type ReadToken,
  type LogRetrieveParams,
  type LogReauthorizeParams,
  type LogCreateTokenParams,
} from './logs';

export class Executions extends APIResource {
  logs: LogsAPI.Logs = new LogsAPI.Logs(this._client);

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
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   * });
   * ```
   */
  list(params: ExecutionListParams, options?: RequestOptions): PagePromise<ExecutionsCursorPage, Execution> {
    const { machine_id, ...query } = params;
    return this._client.getAPIList(
      __scalarPath`/v1/machines/${machine_id}/executions`,
      CursorPage<Execution>,
      { query, ...options },
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
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   command: [''],
   * });
   * ```
   */
  create(params: ExecutionCreateParams, options?: RequestOptions): APIPromise<Execution> {
    const { machine_id, ...body } = params;
    return this._client.post(__scalarPath`/v1/machines/${machine_id}/executions`, { body, ...options });
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
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   execution_id: 'executionID',
   * });
   * ```
   */
  retrieve(params: ExecutionRetrieveParams, options?: RequestOptions): APIPromise<Execution> {
    const { machine_id, execution_id } = params;
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/executions/${execution_id}`, options);
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
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   execution_id: 'executionID',
   * });
   * ```
   */
  delete(params: ExecutionDeleteParams, options?: RequestOptions): APIPromise<Execution> {
    const { machine_id, execution_id } = params;
    return this._client.delete(__scalarPath`/v1/machines/${machine_id}/executions/${execution_id}`, options);
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
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   execution_id: 'executionID',
   * });
   * ```
   */
  output(params: ExecutionOutputParams, options?: RequestOptions): APIPromise<ExecutionOutput> {
    const { machine_id, execution_id } = params;
    return this._client.get(
      __scalarPath`/v1/machines/${machine_id}/executions/${execution_id}/output`,
      options,
    );
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
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   execution_id: 'executionID',
   * });
   * ```
   */
  events(
    params: ExecutionEventsParams,
    options?: RequestOptions,
  ): PagePromise<ExecutionEventsCursorPage, ExecutionEvent> {
    const { machine_id, execution_id, ...query } = params;
    return this._client.getAPIList(
      __scalarPath`/v1/machines/${machine_id}/executions/${execution_id}/events`,
      CursorPage<ExecutionEvent>,
      { query, ...options },
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
  log_capture: Execution.LogCapture;
  /**
   * @format uuid
   */
  machine_id: string;
  status: 'wake_in_progress' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
  artifacts?: Array<ArtifactRef> | null;
  /**
   * @format date-time
   */
  completed_at?: string;
  creation_request_id?: string;
  creation_trace_id?: string;
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

export namespace Execution {
  export interface LogCapture {
    code?: string;
    /**
     * @maxLength 20
     * @pattern ^(0|[1-9][0-9]*)$
     */
    lost_bytes?: string;
    state?: 'pending' | 'incomplete' | 'unavailable';
    /**
     * @maxLength 20
     * @pattern ^(0|[1-9][0-9]*)$
     */
    unconfirmed_bytes?: string;
  }
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
   * Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
}

export type ExecutionsCursorPage = CursorPage<Execution>;

export interface ExecutionCreateParams {
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
   * Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  execution_id: string;
}

export interface ExecutionDeleteParams {
  /**
   * Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  execution_id: string;
}

export interface ExecutionOutputParams {
  /**
   * Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  execution_id: string;
}

export interface ExecutionEventsParams extends CursorPageParams {
  /**
   * Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  execution_id: string;
}

export type ExecutionEventsCursorPage = CursorPage<ExecutionEvent>;
Executions.Logs = Logs;

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

  export {
    Logs as Logs,
    type Status as Status,
    type ReadToken as ReadToken,
    type LogRetrieveParams as LogRetrieveParams,
    type LogReauthorizeParams as LogReauthorizeParams,
    type LogCreateTokenParams as LogCreateTokenParams,
  };
}
