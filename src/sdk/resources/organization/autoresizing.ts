// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../resource';
import { APIPromise } from '../../api-promise';
import type { RequestOptions } from '../../internal/request-options';
import type * as MachinesAPI from '../machines/machines';

export class Autoresizing extends APIResource {
  /**
   * Read organization autoresizing policy
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
   * Changes defaults copied to new Machines. Existing Machines retain their own policy.
   *
   * @param {AutoresizingUpdateParams} body - The request body to send.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Policy>} OK
   *
   * @example
   * ```ts
   * const policy = await client.organization.autoresizing.update({});
   * ```
   */
  update(body: AutoresizingUpdateParams, options?: RequestOptions): APIPromise<Policy> {
    return this._client.patch('/v1/organization/autoresizing', { body, ...options });
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

export interface AutoresizingUpdateParams {
  cpu?: MachinesAPI.AutoresizingSwitch;
  /**
   * @format double
   * @minimum 0.25
   * @multipleOf 0.25
   */
  cpu_max_vcpu?: number | null;
  memory?: MachinesAPI.AutoresizingSwitch;
  /**
   * @format int64
   * @minimum 256
   */
  memory_max_mib?: number | null;
}
export declare namespace Autoresizing {
  export { type Policy as Policy, type AutoresizingUpdateParams as AutoresizingUpdateParams };
}
