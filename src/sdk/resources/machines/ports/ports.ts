// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../../resource';
import { APIPromise } from '../../../api-promise';
import { CursorPage, type CursorPageParams, type PagePromise } from '../../../core/pagination';
import type { RequestOptions } from '../../../internal/request-options';
import { path as __scalarPath } from '../../../internal/utils/path';
import * as AccessKeysAPI from './access-keys';
import {
  AccessKeys,
  type AccessKeyListResponse,
  type AccessKeyMintResponse,
  type AccessKeyRevokeResponse,
  type AccessKeyRotateResponse,
  type AccessKeyListParams,
  type AccessKeyMintParams,
  type AccessKeyRevokeParams,
  type AccessKeyRotateParams,
} from './access-keys';

export class Ports extends APIResource {
  accessKeys: AccessKeysAPI.AccessKeys = new AccessKeysAPI.AccessKeys(this._client);

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
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   * });
   * ```
   */
  list(params: PortListParams, options?: RequestOptions): PagePromise<PortsCursorPage, Port> {
    const { machine_id, ...query } = params;
    return this._client.getAPIList(__scalarPath`/v1/machines/${machine_id}/ports`, CursorPage<Port>, {
      query,
      ...options,
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
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   port: 0,
   *   protocol: 'http',
   *   visibility: 'private',
   * });
   * ```
   */
  create(params: PortCreateParams, options?: RequestOptions): APIPromise<Port> {
    const { machine_id, ...body } = params;
    return this._client.post(__scalarPath`/v1/machines/${machine_id}/ports`, { body, ...options });
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
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   port_id: 'portID',
   * });
   * ```
   */
  retrieve(params: PortRetrieveParams, options?: RequestOptions): APIPromise<Port> {
    const { machine_id, port_id } = params;
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/ports/${port_id}`, options);
  }

  /**
   * Update port
   *
   * @param {PortUpdateParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Port>} OK
   *
   * @example
   * ```ts
   * const port = await client.machines.ports.update({
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   port_id: 'portID',
   *   visibility: 'public',
   * });
   * ```
   */
  update(params: PortUpdateParams, options?: RequestOptions): APIPromise<Port> {
    const { machine_id, port_id, ...body } = params;
    return this._client.patch(__scalarPath`/v1/machines/${machine_id}/ports/${port_id}`, {
      body,
      ...options,
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
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   port_id: 'portID',
   * });
   * ```
   */
  delete(params: PortDeleteParams, options?: RequestOptions): APIPromise<Port> {
    const { machine_id, port_id } = params;
    return this._client.delete(__scalarPath`/v1/machines/${machine_id}/ports/${port_id}`, options);
  }
}

export interface PortCreateParams {
  /**
   * @format int64
   */
  port: number;
  /**
   * Port lifetime in integer seconds. Omit for no expiry.
   * @format int32
   * @minimum 1
   * @maximum 2147483647
   */
  expires?: number;
  /**
   * @default http
   */
  protocol?: 'http';
  /**
   * Who may reach the port. private, the default, requires a Dedalus API key from the owning organization in the X-Dedalus-API-Key header. key_required requires a port access key in the X-Dedalus-Port-Key header, and creating the port returns its first key once. public accepts anonymous requests, which can wake the machine and incur compute charges.
   * @default private
   */
  visibility?: 'public' | 'key_required' | 'private';
}

export interface PortUpdateParams {
  /**
   * Who may reach the port. private requires a Dedalus API key from the owning organization in the X-Dedalus-API-Key header. key_required requires a port access key in the X-Dedalus-Port-Key header. public accepts anonymous requests, which can wake the machine and incur compute charges.
   */
  visibility: 'public' | 'key_required' | 'private';
}

export interface Port {
  /**
   * Isolated guest application origin. Direct clients preserve their HTTP method and body and send any required Dedalus credential in headers.
   */
  application_url: string;
  /**
   * @format date-time
   */
  created_at: string;
  /**
   * @format uuid
   */
  machine_id: string;
  /**
   * @format int64
   */
  port: number;
  port_id: string;
  /**
   * Unavailable is a recoverable failure reaching the guest service. See error_code and error_message for the diagnosis.
   */
  status: 'wake_in_progress' | 'ready' | 'unavailable' | 'closed' | 'expired' | 'failed';
  visibility: 'public' | 'key_required' | 'private';
  error_code?: string;
  error_message?: string;
  /**
   * @format date-time
   */
  expires_at?: string;
  /**
   * Initial key for a newly created key_required port. Plaintext is returned once and omitted on replay.
   */
  initial_access_key?: Port.InitialAccessKey;
  protocol?: 'http';
  /**
   * @format date-time
   */
  ready_at?: string;
  /**
   * @format int64
   */
  retry_after_ms?: number;
  /**
   * Stable browser share URL. Browser navigation only; use application_url for APIs, webhooks, and WebSockets.
   */
  url?: string;
}

export namespace Port {
  export interface InitialAccessKey {
    access_key: string;
    access_key_id: string;
    /**
     * @format date-time
     */
    created_at: string;
    /**
     * @format date-time
     */
    expires_at: string;
    port_id: string;
    /**
     * Most recent durably recorded use, coalesced to five-minute resolution.
     * @format date-time
     */
    last_used_at?: string;
    /**
     * @format date-time
     */
    revoked_at?: string;
  }
}

export interface PortList {
  items: Array<Port> | null;
  next_cursor?: string;
}

export interface PortListParams extends CursorPageParams {
  /**
   * Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
}

export type PortsCursorPage = CursorPage<Port>;

export interface PortCreateParams {
  /**
   * Path param: Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * Body param: Port lifetime in integer seconds. Omit for no expiry.
   * @format int32
   * @minimum 1
   * @maximum 2147483647
   */
  expires?: number;
  /**
   * Body param
   * @format int64
   */
  port: number;
  /**
   * Body param
   * @default http
   */
  protocol?: 'http';
  /**
   * Body param: Who may reach the port. private, the default, requires a Dedalus API key from the owning organization in the X-Dedalus-API-Key header. key_required requires a port access key in the X-Dedalus-Port-Key header, and creating the port returns its first key once. public accepts anonymous requests, which can wake the machine and incur compute charges.
   * @default private
   */
  visibility?: 'public' | 'key_required' | 'private';
}

export interface PortRetrieveParams {
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
  port_id: string;
}

export interface PortUpdateParams {
  /**
   * Path param: Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
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
   * Body param: Who may reach the port. private requires a Dedalus API key from the owning organization in the X-Dedalus-API-Key header. key_required requires a port access key in the X-Dedalus-Port-Key header. public accepts anonymous requests, which can wake the machine and incur compute charges.
   */
  visibility: 'public' | 'key_required' | 'private';
}

export interface PortDeleteParams {
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
  port_id: string;
}
Ports.AccessKeys = AccessKeys;

export declare namespace Ports {
  export {
    type PortCreateParams as PortCreateParams,
    type PortUpdateParams as PortUpdateParams,
    type Port as Port,
    type PortList as PortList,
    type PortsCursorPage as PortsCursorPage,
    type PortListParams as PortListParams,
    type PortRetrieveParams as PortRetrieveParams,
    type PortDeleteParams as PortDeleteParams,
  };

  export {
    AccessKeys as AccessKeys,
    type AccessKeyListResponse as AccessKeyListResponse,
    type AccessKeyMintResponse as AccessKeyMintResponse,
    type AccessKeyRevokeResponse as AccessKeyRevokeResponse,
    type AccessKeyRotateResponse as AccessKeyRotateResponse,
    type AccessKeyListParams as AccessKeyListParams,
    type AccessKeyMintParams as AccessKeyMintParams,
    type AccessKeyRevokeParams as AccessKeyRevokeParams,
    type AccessKeyRotateParams as AccessKeyRotateParams,
  };
}
