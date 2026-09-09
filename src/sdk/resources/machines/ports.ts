// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../resource';
import { APIPromise } from '../../api-promise';
import { CursorPage, type CursorPageParams, type PagePromise } from '../../core/pagination';
import type { RequestOptions } from '../../internal/request-options';
import { buildHeaders } from '../../internal/headers';
import { path as __scalarPath } from '../../internal/utils/path';

export class Ports extends APIResource {
  /**
   * List ports
   *
   * @param {PortListParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {PagePromise<PortsCursorPage, Port>} OK
   *
   * @example
   * ```ts
   * const page = await client.machines.ports.list({
   *   machine_id: 'machineID',
   * });
   * ```
   */
  list(params: PortListParams, options?: RequestOptions): PagePromise<PortsCursorPage, Port> {
    const { machine_id, 'X-Dedalus-Org-Id': xDedalusOrgID, ...query } = params;
    return this._client.getAPIList(__scalarPath`/v1/machines/${machine_id}/ports`, CursorPage<Port>, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }

  /**
   * Create port
   *
   * @param {PortCreateParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Port>} OK
   *
   * @example
   * ```ts
   * const port = await client.machines.ports.create({
   *   machine_id: 'machineID',
   *   port: 0,
   * });
   * ```
   */
  create(params: PortCreateParams, options?: RequestOptions): APIPromise<Port> {
    const { machine_id, 'X-Dedalus-Org-Id': xDedalusOrgID, ...body } = params;
    return this._client.post(__scalarPath`/v1/machines/${machine_id}/ports`, {
      body,
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }

  /**
   * Get port
   *
   * @param {PortRetrieveParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Port>} OK
   *
   * @example
   * ```ts
   * const port = await client.machines.ports.retrieve({
   *   machine_id: 'machineID',
   *   port_id: 'portID',
   * });
   * ```
   */
  retrieve(params: PortRetrieveParams, options?: RequestOptions): APIPromise<Port> {
    const { machine_id, port_id, 'X-Dedalus-Org-Id': xDedalusOrgID } = params;
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/ports/${port_id}`, {
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete port
   *
   * @param {PortDeleteParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Port>} OK
   *
   * @example
   * ```ts
   * const port = await client.machines.ports.delete({
   *   machine_id: 'machineID',
   *   port_id: 'portID',
   * });
   * ```
   */
  delete(params: PortDeleteParams, options?: RequestOptions): APIPromise<Port> {
    const { machine_id, port_id, 'X-Dedalus-Org-Id': xDedalusOrgID } = params;
    return this._client.delete(__scalarPath`/v1/machines/${machine_id}/ports/${port_id}`, {
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }
}

export interface PortCreateParams {
  /**
   * @format int64
   */
  port: number;
  protocol?: 'http' | 'https';
}

export interface Port {
  /**
   * @format date-time
   */
  created_at: string;
  machine_id: string;
  /**
   * @format int64
   */
  port: number;
  port_id: string;
  status: 'wake_in_progress' | 'ready' | 'closed' | 'expired' | 'failed';
  error_code?: string;
  error_message?: string;
  /**
   * @format date-time
   */
  expires_at?: string;
  protocol?: 'http' | 'https';
  /**
   * @format date-time
   */
  ready_at?: string;
  /**
   * @format int64
   */
  retry_after_ms?: number;
  url?: string;
}

export interface PortList {
  items: Array<Port> | null;
  next_cursor?: string;
}

export interface PortListParams extends CursorPageParams {
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

export type PortsCursorPage = CursorPage<Port>;

export interface PortCreateParams {
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
   * @format int64
   */
  port: number;
  /**
   * Body param
   */
  protocol?: 'http' | 'https';
}

export interface PortRetrieveParams {
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
  port_id: string;
  /**
   * Header param
   */
  'X-Dedalus-Org-Id'?: string;
}

export interface PortDeleteParams {
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
  port_id: string;
  /**
   * Header param
   */
  'X-Dedalus-Org-Id'?: string;
}
export declare namespace Ports {
  export {
    type PortCreateParams as PortCreateParams,
    type Port as Port,
    type PortList as PortList,
    type PortsCursorPage as PortsCursorPage,
    type PortListParams as PortListParams,
    type PortRetrieveParams as PortRetrieveParams,
    type PortDeleteParams as PortDeleteParams,
  };
}
