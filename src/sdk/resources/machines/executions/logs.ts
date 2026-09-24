// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../../resource';
import { APIPromise } from '../../../api-promise';
import type { RequestOptions } from '../../../internal/request-options';
import { path as __scalarPath } from '../../../internal/utils/path';

export class Logs extends APIResource {
  /**
   * Get execution log status
   *
   * @param {LogRetrieveParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Status>} OK
   *
   * @example
   * ```ts
   * const status = await client.machines.executions.logs.retrieve({
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   execution_id: 'executionID',
   * });
   * ```
   */
  retrieve(params: LogRetrieveParams, options?: RequestOptions): APIPromise<Status> {
    const { machine_id, execution_id } = params;
    return this._client.get(
      __scalarPath`/v1/machines/${machine_id}/executions/${execution_id}/logs`,
      options,
    );
  }

  /**
   * Reauthorize execution log publication
   *
   * @param {LogReauthorizeParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Status>} OK
   *
   * @example
   * ```ts
   * const status = await client.machines.executions.logs.reauthorize({
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   execution_id: 'executionID',
   * });
   * ```
   */
  reauthorize(params: LogReauthorizeParams, options?: RequestOptions): APIPromise<Status> {
    const { machine_id, execution_id } = params;
    return this._client.post(
      __scalarPath`/v1/machines/${machine_id}/executions/${execution_id}/logs/reauthorize`,
      options,
    );
  }

  /**
   * Create execution log read token
   *
   * @param {LogCreateTokenParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<ReadToken>} OK
   *
   * @example
   * ```ts
   * const readToken = await client.machines.executions.logs.createToken({
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   execution_id: 'executionID',
   * });
   * ```
   */
  createToken(params: LogCreateTokenParams, options?: RequestOptions): APIPromise<ReadToken> {
    const { machine_id, execution_id } = params;
    return this._client.post(
      __scalarPath`/v1/machines/${machine_id}/executions/${execution_id}/logs/token`,
      options,
    );
  }
}

export interface Status {
  capture: Status.Capture;
  execution_id: string;
  code?: string;
  publication?: Status.Publication;
  stream_id?: string;
}

export namespace Status {
  export interface Capture {
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

  export interface Publication {
    complete: boolean;
    /**
     * @format int64
     * @minimum 0
     */
    queued_messages: number;
    state: 'active' | 'finishing' | 'failed' | 'closed';
    code?: string;
  }
}

export interface ReadToken {
  access_token: string;
  base_url: string;
  execution_id: string;
  /**
   * @format date-time
   */
  expires_at: string;
  stream_id: string;
  token_type: string;
}

export interface LogRetrieveParams {
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

export interface LogReauthorizeParams {
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

export interface LogCreateTokenParams {
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
export declare namespace Logs {
  export {
    type Status as Status,
    type ReadToken as ReadToken,
    type LogRetrieveParams as LogRetrieveParams,
    type LogReauthorizeParams as LogReauthorizeParams,
    type LogCreateTokenParams as LogCreateTokenParams,
  };
}
