// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../resource';
import { APIPromise } from '../../api-promise';
import type { RequestOptions } from '../../internal/request-options';
import { path as __scalarPath } from '../../internal/utils/path';

export class Autoresizing extends APIResource {
  /**
   * Read this machine's RAM autoresizing settings
   *
   * @param {AutoresizingRetrieveParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Settings>} OK
   *
   * @example
   * ```ts
   * const settings = await client.machines.autoresizing.retrieve({
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   * });
   * ```
   */
  retrieve(params: AutoresizingRetrieveParams, options?: RequestOptions): APIPromise<Settings> {
    const { machine_id } = params;
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/autoresizing`, options);
  }

  /**
   * Set this machine's RAM autoresizing settings
   *
   * @param {AutoresizingUpdateParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Settings>} OK
   *
   * @example
   * ```ts
   * const settings = await client.machines.autoresizing.update({
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   enabled: false,
   * });
   * ```
   */
  update(params: AutoresizingUpdateParams, options?: RequestOptions): APIPromise<Settings> {
    const { machine_id, ...body } = params;
    return this._client.put(__scalarPath`/v1/machines/${machine_id}/autoresizing`, { body, ...options });
  }
}

export interface Settings {
  enabled: boolean;
}

export interface AutoresizingRetrieveParams {
  /**
   * Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
}

export interface AutoresizingUpdateParams {
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
  enabled: boolean;
}
export declare namespace Autoresizing {
  export {
    type Settings as Settings,
    type AutoresizingRetrieveParams as AutoresizingRetrieveParams,
    type AutoresizingUpdateParams as AutoresizingUpdateParams,
  };
}
