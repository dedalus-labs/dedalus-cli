// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from "../../resource";
import { APIPromise } from "../../api-promise";
import type { RequestOptions } from "../../internal/request-options";

export class Machines extends APIResource {
  /**
   * List machine compute usage breakdown
   *
   * @param {MachineListComputeUsageParams} [params] - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineListComputeUsageResponse>} OK
   *
   * @example
   * ```ts
   * const listComputeUsage = await client.usage.machines.listComputeUsage();
   * ```
   */
  listComputeUsage(params: MachineListComputeUsageParams | null | undefined = {}, options?: RequestOptions): APIPromise<MachineListComputeUsageResponse> {
    const { period_start, period_end, machine_id, granularity } = params ?? {};
    return this._client.get("/v1/usage/machines/compute", { query: { period_start: period_start, period_end: period_end, machine_id: machine_id, granularity: granularity }, ...options });
  }

  /**
   * List machine storage usage breakdown
   *
   * @param {MachineListStorageUsageParams} [params] - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineListStorageUsageResponse>} OK
   *
   * @example
   * ```ts
   * const listStorageUsage = await client.usage.machines.listStorageUsage();
   * ```
   */
  listStorageUsage(params: MachineListStorageUsageParams | null | undefined = {}, options?: RequestOptions): APIPromise<MachineListStorageUsageResponse> {
    const { period_start, period_end, machine_id } = params ?? {};
    return this._client.get("/v1/usage/machines/storage", { query: { period_start: period_start, period_end: period_end, machine_id: machine_id }, ...options });
  }
}

export interface MachineListComputeUsageParams {
  /**
   * Usage period start (YYYY-MM-DD). Defaults to first of current month.
   */
  period_start?: string;
  /**
   * Last UTC usage date to include (YYYY-MM-DD). Defaults to current time.
   */
  period_end?: string;
  /**
   * Optional machine ID filter.
   */
  machine_id?: string;
  /**
   * Usage breakdown granularity: hour or day. Defaults to hour.
   */
  granularity?: string;
}

export interface MachineListComputeUsageResponse {
  /**
   * Usage breakdown granularity used for rows: hour or day.
   */
  granularity: string;
  /**
   * Exclusive usage period end.
   * @format date-time
   */
  period_end: string;
  /**
   * Inclusive usage period start.
   * @format date-time
   */
  period_start: string;
  /**
   * Machine-level compute usage breakdown rows.
   */
  rows: Array<MachineListComputeUsageResponse.Row> | null;
}

export namespace MachineListComputeUsageResponse {
  export interface Row {
    /**
     * Machine-awake seconds in this bucket.
     * @format int64
     */
    awake_seconds: number;
    /**
     * Exclusive usage bucket end.
     * @format date-time
     */
    bucket_end: string;
    /**
     * Inclusive usage bucket start.
     * @format date-time
     */
    bucket_start: string;
    /**
     * Requested vCPU millicores multiplied by guest-owned active CPU seconds.
     * @format int64
     */
    cpu_millicore_seconds: number;
    /**
     * Latest raw window_end represented by this row.
     * @format date-time
     */
    last_window_end: string;
    /**
     * Machine identifier.
     */
    machine_id: string;
    /**
     * Requested memory MiB multiplied by running allocation seconds.
     * @format int64
     */
    memory_mib_seconds: number;
    /**
     * Org compute bucket IDs this row contributes to.
     */
    org_metering_bucket_ids: Array<string> | null;
    /**
     * Requested memory for this shape, in MiB.
     * @format int32
     */
    requested_memory_mib: number;
    /**
     * Requested storage for this shape, in GiB.
     * @format int32
     */
    requested_storage_gib: number;
    /**
     * Requested vCPU for this shape.
     * @format double
     */
    requested_vcpu: number;
    /**
     * Stable fingerprint for the requested machine shape.
     */
    spec_fingerprint: string;
    /**
     * Stripe CPU meter event identifiers linked to those org buckets.
     */
    stripe_cpu_identifiers: Array<string> | null;
    /**
     * Stripe memory meter event identifiers linked to those org buckets.
     */
    stripe_memory_identifiers: Array<string> | null;
    /**
     * Raw usage windows compacted into this row.
     * @format int64
     */
    window_count: number;
    /**
     * Latest Stripe emission timestamp for linked org buckets, when emitted.
     * @format date-time
     */
    latest_stripe_emitted_at?: string;
  }
}

export interface MachineListStorageUsageParams {
  /**
   * Usage period start (YYYY-MM-DD). Defaults to first of current month.
   */
  period_start?: string;
  /**
   * Last UTC usage date to include (YYYY-MM-DD). Defaults to current time.
   */
  period_end?: string;
  /**
   * Optional machine ID filter.
   */
  machine_id?: string;
}

export interface MachineListStorageUsageResponse {
  /**
   * Exclusive usage period end.
   * @format date-time
   */
  period_end: string;
  /**
   * Inclusive usage period start.
   * @format date-time
   */
  period_start: string;
  /**
   * Machine-level storage usage breakdown rows.
   */
  rows: Array<MachineListStorageUsageResponse.Row> | null;
}

export namespace MachineListStorageUsageResponse {
  export interface Row {
    /**
     * Exclusive usage bucket end.
     * @format date-time
     */
    bucket_end: string;
    /**
     * Inclusive usage bucket start.
     * @format date-time
     */
    bucket_start: string;
    /**
     * Machine logical bytes observed for storage allocation.
     * @format int64
     */
    logical_storage_bytes: number;
    /**
     * Machine identifier.
     */
    machine_id: string;
    /**
     * Org storage bucket ID this row contributes to.
     */
    org_metering_bucket_id: string;
    /**
     * Allocated logical MiB-seconds for this machine.
     * @format int64
     */
    storage_mib_seconds: number;
    /**
     * Stripe storage meter event identifier linked to that org bucket.
     */
    stripe_storage_identifier: string;
    /**
     * Latest Stripe emission timestamp for the linked org bucket, when emitted.
     * @format date-time
     */
    latest_stripe_emitted_at?: string;
  }
}
export declare namespace Machines {
  export {
    type MachineListComputeUsageResponse as MachineListComputeUsageResponse,
    type MachineListStorageUsageResponse as MachineListStorageUsageResponse,
    type MachineListComputeUsageParams as MachineListComputeUsageParams,
    type MachineListStorageUsageParams as MachineListStorageUsageParams,
  };
}
export { Machines as MachineResource };
