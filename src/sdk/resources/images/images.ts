// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../resource';
import { APIPromise } from '../../api-promise';
import type { RequestOptions } from '../../internal/request-options';
import { path as __scalarPath } from '../../internal/utils/path';
import * as UploadsAPI from './uploads';
import { Uploads, type Reservation, type UploadCreateParams } from './uploads';

export class Images extends APIResource {
  uploads: UploadsAPI.Uploads = new UploadsAPI.Uploads(this._client);

  /**
   * Pages through the organization's images in ID order. A deleted image is left out; it still reads by ID.
   *
   * @param {ImageListParams} [query] - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<ImageList>} OK
   *
   * @example
   * ```ts
   * const imageList = await client.images.list({
   *   limit: 100,
   * });
   * ```
   */
  list(query: ImageListParams | null | undefined = {}, options?: RequestOptions): APIPromise<ImageList> {
    return this._client.get('/v1/images', { query, ...options });
  }

  /**
   * Requires an entitled organization and linux/amd64 on the current fleet. Acceptance queues preparation; only a ready image can launch a machine. Private registry credentials are not yet supported.
   *
   * @param {ImageCreateParams} body - The request body to send.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Image>} Accepted
   *
   * @example
   * ```ts
   * const image = await client.images.create({
   *   platform: 'linux/amd64',
   *   source: {
   *     kind: '',
   *   },
   * });
   * ```
   */
  create(body: ImageCreateParams, options?: RequestOptions): APIPromise<Image> {
    return this._client.post('/v1/images', { body, ...options });
  }

  /**
   * A preparing image reports its stage, the worker's last step and an estimated percent of the whole preparation. A failed image names the cause: IMAGE_OS_UNSUPPORTED, IMAGE_SOURCE_INVALID, IMAGE_SOURCE_NOT_FOUND and IMAGE_SOURCE_UNAUTHORIZED describe the image or its reference and are final; IMAGE_SOURCE_UNAVAILABLE, IMAGE_REGISTRY_UNREACHABLE, IMAGE_REGISTRY_RATE_LIMITED, IMAGE_ARCHIVE_UNAVAILABLE and IMAGE_EXECUTION_FAILED describe this attempt and are retryable with a new idempotency key.
   *
   * @param {ImageRetrieveParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Image>} OK
   *
   * @example
   * ```ts
   * const image = await client.images.retrieve({
   *   image_id: 'imageID',
   * });
   * ```
   */
  retrieve(params: ImageRetrieveParams, options?: RequestOptions): APIPromise<Image> {
    const { image_id } = params;
    return this._client.get(__scalarPath`/v1/images/${image_id}`, options);
  }

  /**
   * Changes only the name. The image's source, platform and state are immutable.
   *
   * @param {ImageUpdateParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Image>} OK
   *
   * @example
   * ```ts
   * const image = await client.images.update({
   *   image_id: 'imageID',
   *   name: '',
   * });
   * ```
   */
  update(params: ImageUpdateParams, options?: RequestOptions): APIPromise<Image> {
    const { image_id, ...body } = params;
    return this._client.patch(__scalarPath`/v1/images/${image_id}`, { body, ...options });
  }

  /**
   * The image can create no new Machine and no longer counts against the organization's image limit. Machines already running from it keep working. The image stays readable, and deleting it again returns the same image.
   *
   * @param {ImageDeleteParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Image>} OK
   *
   * @example
   * ```ts
   * const image = await client.images.delete({
   *   image_id: 'imageID',
   * });
   * ```
   */
  delete(params: ImageDeleteParams, options?: RequestOptions): APIPromise<Image> {
    const { image_id } = params;
    return this._client.delete(__scalarPath`/v1/images/${image_id}`, options);
  }
}

export interface Image {
  /**
   * @format date-time
   */
  created_at: string;
  image_id: string;
  name: string | null;
  platform: string;
  source: Source;
  state: string;
  context?: Image.Context;
  error?: Error;
  reason?: string;
}

export namespace Image {
  export interface Context {
    /**
     * @format int64
     */
    percent: number;
    stage: string;
    progress?: Context.Progress;
  }

  export namespace Context {
    export interface Progress {
      /**
       * @format int64
       */
      completed: number;
      step: string;
      /**
       * @format int64
       */
      total: number;
    }
  }
}

export interface ImageList {
  image_ids: Array<string> | null;
  next_cursor?: string;
}

export interface Source {
  kind: string;
  reference?: string;
  sha256?: string;
  upload_id?: string;
}

export interface Error {
  error_code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, string>;
  /**
   * @format int64
   */
  retry_after_ms?: number;
}

export interface ImageListParams {
  /**
   * @default 100
   * @format int64
   * @minimum 1
   * @maximum 100
   */
  limit?: number;
  /**
   * @maxLength 100
   */
  cursor?: string;
}

export interface ImageCreateParams {
  platform: 'linux/amd64' | 'linux/arm64';
  source: Source;
  credential_ref?: string;
  /**
   * A label people use to tell images apart. Programs use the image ID.
   * @maxLength 128
   */
  name?: string;
}

export interface ImageRetrieveParams {
  /**
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  image_id: string;
}

export interface ImageUpdateParams {
  /**
   * Path param
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  image_id: string;
  /**
   * Body param: The new label, or null to clear it. No other field can change.
   * @maxLength 128
   */
  name: string | null;
}

export interface ImageDeleteParams {
  /**
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  image_id: string;
}
Images.Uploads = Uploads;

export declare namespace Images {
  export {
    type Image as Image,
    type ImageList as ImageList,
    type Source as Source,
    type Error as Error,
    type ImageListParams as ImageListParams,
    type ImageCreateParams as ImageCreateParams,
    type ImageRetrieveParams as ImageRetrieveParams,
    type ImageUpdateParams as ImageUpdateParams,
    type ImageDeleteParams as ImageDeleteParams,
  };

  export {
    Uploads as Uploads,
    type Reservation as Reservation,
    type UploadCreateParams as UploadCreateParams,
  };
}
