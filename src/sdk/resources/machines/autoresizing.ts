// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../resource';
import { APIPromise } from '../../api-promise';
import type { RequestOptions } from '../../internal/request-options';
import { path as __scalarPath } from '../../internal/utils/path';
import type * as MachinesAPI from './machines';

export class Autoresizing extends APIResource {
  /**
   * Read this machine's autoresizing settings
   *
   * @param {AutoresizingRetrieveParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Policy>} OK
   *
   * @example
   * ```ts
   * const policy = await client.machines.autoresizing.retrieve({
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   * });
   * ```
   */
  retrieve(params: AutoresizingRetrieveParams, options?: RequestOptions): APIPromise<Policy> {
    const { machine_id } = params;
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/autoresizing`, options);
  }

  /**
   * Changes RAM, CPU or both for this machine. An absent resource keeps its setting.
   *
   * @param {AutoresizingUpdateParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Policy>} OK
   *
   * @example
   * ```ts
   * const policy = await client.machines.autoresizing.update({
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   * });
   * ```
   */
  update(params: AutoresizingUpdateParams, options?: RequestOptions): APIPromise<Policy> {
    const { machine_id, ...body } = params;
    return this._client.patch(__scalarPath`/v1/machines/${machine_id}/autoresizing`, { body, ...options });
  }
}

export interface Policy {
  /**
   * Permit automatic CPU growth independently of RAM.
   */
  cpu: MachinesAPI.AutoresizingSwitch;
  cpu_limit_source: 'plan' | 'configured' | 'platform';
  /**
   * Configured CPU growth limit in 0.25-vCPU steps. Null uses the plan limit.
   * @format double
   */
  cpu_max_vcpu: number | null;
  /**
   * Largest automatic CPU size allowed by this policy, plan and platform.
   * @format double
   */
  effective_cpu_max_vcpu: number;
  /**
   * Largest automatic RAM size allowed by this policy and plan, in MiB.
   * @format int64
   */
  effective_memory_max_mib: number;
  /**
   * Deprecated RAM permission alias. Use memory.
   * @deprecated
   */
  enabled: boolean;
  /**
   * Permit automatic RAM growth. Automatic shrink remains internal.
   */
  memory: MachinesAPI.AutoresizingSwitch;
  memory_limit_source: 'plan' | 'configured' | 'platform';
  /**
   * Configured RAM growth limit in MiB. Null uses the plan limit.
   * @format int64
   */
  memory_max_mib: number | null;
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
  cpu?: MachinesAPI.AutoresizingSwitch;
  /**
   * Body param
   * @format double
   * @minimum 0.25
   * @multipleOf 0.25
   */
  cpu_max_vcpu?: number | null;
  /**
   * Body param
   */
  memory?: MachinesAPI.AutoresizingSwitch;
  /**
   * Body param
   * @format int64
   * @minimum 256
   */
  memory_max_mib?: number | null;
}
export declare namespace Autoresizing {
  export {
    type Policy as Policy,
    type AutoresizingRetrieveParams as AutoresizingRetrieveParams,
    type AutoresizingUpdateParams as AutoresizingUpdateParams,
  };
}
