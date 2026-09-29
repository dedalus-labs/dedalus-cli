// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../resource';
import { APIPromise } from '../../api-promise';
import type { RequestOptions } from '../../internal/request-options';

export class Autoresizing extends APIResource {
  /**
   * Read organization RAM autoresizing policy
   *
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Policy>} OK
   *
   * @example
   * ```ts
   * const policy = await client.organization.autoresizing.retrieve();
   * ```
   */
  retrieve(options?: RequestOptions): APIPromise<Policy> {
    return this._client.get('/v1/organization/autoresizing', options);
  }

  /**
   * Set organization RAM autoresizing policy
   *
   * @param {AutoresizingUpdateParams} body - The request body to send.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Policy>} OK
   *
   * @example
   * ```ts
   * const policy = await client.organization.autoresizing.update({
   *   enabled: false,
   * });
   * ```
   */
  update(body: AutoresizingUpdateParams, options?: RequestOptions): APIPromise<Policy> {
    return this._client.put('/v1/organization/autoresizing', { body, ...options });
  }
}

export interface Policy {
  /**
   * Allow automatic RAM increases for all organization machines. Disabling preserves applied RAM and already admitted resizes.
   */
  enabled: boolean;
}

export interface AutoresizingUpdateParams {
  /**
   * Allow automatic RAM increases for all organization machines. Disabling preserves applied RAM and already admitted resizes.
   */
  enabled: boolean;
}
export declare namespace Autoresizing {
  export { type Policy as Policy, type AutoresizingUpdateParams as AutoresizingUpdateParams };
}
