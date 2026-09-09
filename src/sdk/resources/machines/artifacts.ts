// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../resource';
import { APIPromise } from '../../api-promise';
import { CursorPage, type CursorPageParams, type PagePromise } from '../../core/pagination';
import type { RequestOptions } from '../../internal/request-options';
import { buildHeaders } from '../../internal/headers';
import { path as __scalarPath } from '../../internal/utils/path';

export class Artifacts extends APIResource {
  /**
   * List artifacts
   *
   * @param {ArtifactListParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {PagePromise<ArtifactsCursorPage, Artifact>} OK
   *
   * @example
   * ```ts
   * const page = await client.machines.artifacts.list({
   *   machine_id: 'machineID',
   * });
   * ```
   */
  list(params: ArtifactListParams, options?: RequestOptions): PagePromise<ArtifactsCursorPage, Artifact> {
    const { machine_id, 'X-Dedalus-Org-Id': xDedalusOrgID, ...query } = params;
    return this._client.getAPIList(__scalarPath`/v1/machines/${machine_id}/artifacts`, CursorPage<Artifact>, {
      query,
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }

  /**
   * Get artifact
   *
   * @param {ArtifactRetrieveParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Artifact>} OK
   *
   * @example
   * ```ts
   * const artifact = await client.machines.artifacts.retrieve({
   *   machine_id: 'machineID',
   *   artifact_id: 'artifactID',
   * });
   * ```
   */
  retrieve(params: ArtifactRetrieveParams, options?: RequestOptions): APIPromise<Artifact> {
    const { machine_id, artifact_id, 'X-Dedalus-Org-Id': xDedalusOrgID } = params;
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/artifacts/${artifact_id}`, {
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }

  /**
   * Delete artifact
   *
   * @param {ArtifactDeleteParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Artifact>} OK
   *
   * @example
   * ```ts
   * const artifact = await client.machines.artifacts.delete({
   *   machine_id: 'machineID',
   *   artifact_id: 'artifactID',
   * });
   * ```
   */
  delete(params: ArtifactDeleteParams, options?: RequestOptions): APIPromise<Artifact> {
    const { machine_id, artifact_id, 'X-Dedalus-Org-Id': xDedalusOrgID } = params;
    return this._client.delete(__scalarPath`/v1/machines/${machine_id}/artifacts/${artifact_id}`, {
      ...options,
      headers: buildHeaders([
        { ...(xDedalusOrgID !== undefined ? { 'X-Dedalus-Org-Id': xDedalusOrgID } : {}) },
        options?.headers,
      ]),
    });
  }
}

export interface Artifact {
  artifact_id: string;
  /**
   * @format date-time
   */
  created_at: string;
  machine_id: string;
  name: string;
  /**
   * @format int64
   */
  size_bytes: number;
  download_url?: string;
  execution_id?: string;
  /**
   * @format date-time
   */
  expires_at?: string;
  mime_type?: string;
  sha256?: string;
}

export interface ArtifactList {
  items: Array<Artifact> | null;
  next_cursor?: string;
}

export interface ArtifactListParams extends CursorPageParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * Header param
   */
  'X-Dedalus-Org-Id'?: string;
}

export type ArtifactsCursorPage = CursorPage<Artifact>;

export interface ArtifactRetrieveParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * Path param
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  artifact_id: string;
  /**
   * Header param
   */
  'X-Dedalus-Org-Id'?: string;
}

export interface ArtifactDeleteParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * Path param
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  artifact_id: string;
  /**
   * Header param
   */
  'X-Dedalus-Org-Id'?: string;
}
export declare namespace Artifacts {
  export {
    type Artifact as Artifact,
    type ArtifactList as ArtifactList,
    type ArtifactsCursorPage as ArtifactsCursorPage,
    type ArtifactListParams as ArtifactListParams,
    type ArtifactRetrieveParams as ArtifactRetrieveParams,
    type ArtifactDeleteParams as ArtifactDeleteParams,
  };
}
