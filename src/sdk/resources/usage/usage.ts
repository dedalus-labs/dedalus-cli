// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from "../../resource";
import { APIPromise } from "../../api-promise";
import type { RequestOptions } from "../../internal/request-options";
import { Machines, type MachineListComputeUsageResponse, type MachineListStorageUsageResponse, type MachineListComputeUsageParams, type MachineListStorageUsageParams } from "./machines";

export class Usage extends APIResource {
  machines: Machines = new Machines(this._client);

  /**
   * Get usage summary
   *
   * @param {UsageListParams} [params] - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<UsageListResponse>} OK
   *
   * @example
   * ```ts
   * const list = await client.usage.list();
   * ```
   */
  list(params: UsageListParams | null | undefined = {}, options?: RequestOptions): APIPromise<UsageListResponse> {
    const { period_start } = params ?? {};
    return this._client.get("/v1/usage", { query: { period_start: period_start }, ...options });
  }
}

export interface UsageListParams {
  /**
   * Billing period start (YYYY-MM-DD). Defaults to first of current month.
   */
  period_start?: string;
}

export interface UsageListResponse {
  /**
   * Closed awake seconds in billed org buckets for the period.
   * @format int64
   */
  billed_awake_seconds: number;
  /**
   * Closed requested vCPU millicores multiplied by guest-owned active CPU seconds for the period.
   * @format int64
   */
  billed_cpu_millicore_seconds: number;
  /**
   * Closed billable logical MiB-seconds for the period, matching the Stripe storage meter.
   * @format int64
   */
  billed_logical_storage_mib_seconds: number;
  /**
   * Closed requested memory MiB multiplied by running allocation seconds for the period.
   * @format int64
   */
  billed_memory_mib_seconds: number;
  /**
   * Plan-included storage in GiB, used as a local guardrail only.
   * @format int64
   */
  included_storage_gib: number;
  /**
   * Billing plan in effect for the organization.
   */
  plan_slug: string;
  /**
   * Current provisioned storage summed across machines in GiB.
   * @format int64
   */
  provisioned_storage_gib: number;
}
Usage.Machines = Machines;

export declare namespace Usage {
  export {
    type UsageListResponse as UsageListResponse,
    type UsageListParams as UsageListParams,
  };

  export {
    Machines as Machines,
    type MachineListComputeUsageResponse as MachineListComputeUsageResponse,
    type MachineListStorageUsageResponse as MachineListStorageUsageResponse,
    type MachineListComputeUsageParams as MachineListComputeUsageParams,
    type MachineListStorageUsageParams as MachineListStorageUsageParams,
  };
}
export { Usage as UsageResource };
