// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../resource';
import { APIPromise } from '../api-promise';
import type { RequestOptions } from '../internal/request-options';

export class Usage extends APIResource {
  /**
   * Get usage summary
   *
   * @param {UsageRetrieveParams} [query] - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<OrgUsage>} OK
   *
   * @example
   * ```ts
   * const orgUsage = await client.usage.retrieve();
   * ```
   */
  retrieve(
    query: UsageRetrieveParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<OrgUsage> {
    return this._client.get('/v1/usage', { query, ...options });
  }

  /**
   * List machine compute usage breakdown
   *
   * @param {UsageMachineComputeParams} [query] - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineComputeUsage>} OK
   *
   * @example
   * ```ts
   * const machineComputeUsage = await client.usage.machineCompute();
   * ```
   */
  machineCompute(
    query: UsageMachineComputeParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<MachineComputeUsage> {
    return this._client.get('/v1/usage/machines/compute', { query, ...options });
  }

  /**
   * List machine storage usage breakdown
   *
   * @param {UsageMachineStorageParams} [query] - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineStorageUsage>} OK
   *
   * @example
   * ```ts
   * const machineStorageUsage = await client.usage.machineStorage();
   * ```
   */
  machineStorage(
    query: UsageMachineStorageParams | null | undefined = {},
    options?: RequestOptions,
  ): APIPromise<MachineStorageUsage> {
    return this._client.get('/v1/usage/machines/storage', { query, ...options });
  }
}

export interface OrgUsage {
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
   * Closed billable logical MiB-seconds for the period.
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

export interface MachineComputeUsage {
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
  rows: Array<MachineComputeUsageRow> | null;
}

export interface MachineComputeUsageRow {
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
   * Raw metering events compacted into this row.
   * @format int64
   */
  window_count: number;
  /**
   * Latest meter emission timestamp for linked org buckets, when emitted.
   * @format date-time
   */
  latest_meter_emitted_at?: string;
}

export interface MachineStorageUsage {
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
  rows: Array<MachineStorageUsageRow> | null;
}

export interface MachineStorageUsageRow {
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
   * Latest meter emission timestamp for the linked org bucket, when emitted.
   * @format date-time
   */
  latest_meter_emitted_at?: string;
}

export interface UsageRetrieveParams {
  /**
   * Billing period start (YYYY-MM-DD). Defaults to first of current month.
   */
  period_start?: string;
}

export interface UsageMachineComputeParams {
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

export interface UsageMachineStorageParams {
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
export declare namespace Usage {
  export {
    type OrgUsage as OrgUsage,
    type MachineComputeUsage as MachineComputeUsage,
    type MachineComputeUsageRow as MachineComputeUsageRow,
    type MachineStorageUsage as MachineStorageUsage,
    type MachineStorageUsageRow as MachineStorageUsageRow,
    type UsageRetrieveParams as UsageRetrieveParams,
    type UsageMachineComputeParams as UsageMachineComputeParams,
    type UsageMachineStorageParams as UsageMachineStorageParams,
  };
}
