// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../resource';
import { APIPromise } from '../api-promise';
import type { RequestOptions } from '../internal/request-options';
import { buildHeaders } from '../internal/headers';
import { path as __scalarPath } from '../internal/utils/path';

export class Networks extends APIResource {
  /**
   * Get network details
   *
   * @param {NetworkRetrieveParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Network>} OK
   *
   * @example
   * ```ts
   * const network = await client.networks.retrieve({
   *   network_id: 'networkID',
   * });
   * ```
   */
  retrieve(params: NetworkRetrieveParams, options?: RequestOptions): APIPromise<Network> {
    const { network_id, 'X-Dedalus-Org-Id': xDedalusOrgID } = params;
    return this._client.get(__scalarPath`/v1/networks/${network_id}`, {
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }
}

export interface Network {
  gateways: Array<NetworkGateway> | null;
  name: string;
  network_id: string;
}

export interface NetworkGateway {
  hostname: string;
  kind: 'ssh' | 'port';
  protocol: 'ssh' | 'https';
  /**
   * @format int64
   * @minimum 1
   * @maximum 65535
   */
  port?: number;
}

export interface NetworkRetrieveParams {
  /**
   * Path param
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  network_id: string;
  /**
   * Header param
   */
  'X-Dedalus-Org-Id'?: string;
}
export declare namespace Networks {
  export {
    type Network as Network,
    type NetworkGateway as NetworkGateway,
    type NetworkRetrieveParams as NetworkRetrieveParams,
  };
}
