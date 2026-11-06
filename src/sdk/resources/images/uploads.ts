// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../resource';
import { APIPromise } from '../../api-promise';
import type { RequestOptions } from '../../internal/request-options';
import type * as ImagesAPI from './images';

export class Uploads extends APIResource {
  /**
   * Reserve an immutable Docker image archive upload
   *
   * @param {UploadCreateParams} body - The request body to send.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Reservation>} OK
   *
   * @example
   * ```ts
   * const reservation = await client.images.uploads.create({
   *   platform: '',
   *   sha256: '',
   *   size_bytes: 0,
   * });
   * ```
   */
  create(body: UploadCreateParams, options?: RequestOptions): APIPromise<Reservation> {
    return this._client.post('/v1/images/uploads', { body, ...options });
  }
}

export interface Reservation {
  source: ImagesAPI.Source;
  upload: Reservation.Upload;
}

export namespace Reservation {
  export interface Upload {
    /**
     * @format date-time
     */
    expires_at: string;
    headers: Record<string, Array<string> | null>;
    method: string;
    url: string;
  }
}

export interface UploadCreateParams {
  platform: string;
  sha256: string;
  /**
   * @format int64
   */
  size_bytes: number;
}
export declare namespace Uploads {
  export { type Reservation as Reservation, type UploadCreateParams as UploadCreateParams };
}
