// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../../resource';
import { APIPromise } from '../../../api-promise';
import type { RequestOptions } from '../../../internal/request-options';
import { path as __scalarPath } from '../../../internal/utils/path';

export class AccessKeys extends APIResource {
  /**
   * List port access keys
   *
   * @param {AccessKeyListParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<AccessKeyListResponse>} OK
   *
   * @example
   * ```ts
   * const accessKey = await client.machines.ports.accessKeys.list({
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   port_id: 'portID',
   * });
   * ```
   */
  list(params: AccessKeyListParams, options?: RequestOptions): APIPromise<AccessKeyListResponse> {
    const { machine_id, port_id, ...query } = params;
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/ports/${port_id}/access-keys`, {
      query,
      ...options,
    });
  }

  /**
   * Mint port access key
   *
   * @param {AccessKeyMintParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<AccessKeyMintResponse>} OK
   *
   * @example
   * ```ts
   * const accessKey = await client.machines.ports.accessKeys.mint({
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   port_id: 'portID',
   *   expires_in: 1,
   * });
   * ```
   */
  mint(params: AccessKeyMintParams, options?: RequestOptions): APIPromise<AccessKeyMintResponse> {
    const { machine_id, port_id, ...body } = params;
    return this._client.post(__scalarPath`/v1/machines/${machine_id}/ports/${port_id}/access-keys`, {
      body,
      ...options,
    });
  }

  /**
   * Revoke port access key
   *
   * @param {AccessKeyRevokeParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<AccessKeyRevokeResponse>} OK
   *
   * @example
   * ```ts
   * const accessKey = await client.machines.ports.accessKeys.revoke({
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   port_id: 'portID',
   *   access_key_id: 'accessKeyID',
   * });
   * ```
   */
  revoke(params: AccessKeyRevokeParams, options?: RequestOptions): APIPromise<AccessKeyRevokeResponse> {
    const { machine_id, port_id, access_key_id } = params;
    return this._client.delete(
      __scalarPath`/v1/machines/${machine_id}/ports/${port_id}/access-keys/${access_key_id}`,
      options,
    );
  }

  /**
   * Rotate port access key
   *
   * @param {AccessKeyRotateParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<AccessKeyRotateResponse>} OK
   *
   * @example
   * ```ts
   * const accessKey = await client.machines.ports.accessKeys.rotate({
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   port_id: 'portID',
   *   access_key_id: 'accessKeyID',
   *   expires_in: 1,
   * });
   * ```
   */
  rotate(params: AccessKeyRotateParams, options?: RequestOptions): APIPromise<AccessKeyRotateResponse> {
    const { machine_id, port_id, access_key_id, ...body } = params;
    return this._client.post(
      __scalarPath`/v1/machines/${machine_id}/ports/${port_id}/access-keys/${access_key_id}/rotate`,
      { body, ...options },
    );
  }
}

export interface AccessKeyListParams {
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
   * Query param
   * @format int64
   */
  limit?: number;
  /**
   * Query param
   */
  cursor?: string;
}

export interface AccessKeyListResponse {
  items: Array<AccessKeyListResponse.Item> | null;
  next_cursor?: string;
}

export namespace AccessKeyListResponse {
  export interface Item {
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

export interface AccessKeyMintParams {
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
   * Body param: Lifetime in integer seconds.
   * @format int32
   * @minimum 1
   * @maximum 2147483647
   */
  expires_in: number;
}

export interface AccessKeyMintResponse {
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

export interface AccessKeyRevokeParams {
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
  /**
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  access_key_id: string;
}

export interface AccessKeyRevokeResponse {
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

export interface AccessKeyRotateParams {
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
   * Path param
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  access_key_id: string;
  /**
   * Body param: Lifetime in integer seconds.
   * @format int32
   * @minimum 1
   * @maximum 2147483647
   */
  expires_in: number;
}

export interface AccessKeyRotateResponse {
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
export declare namespace AccessKeys {
  export {
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
