// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../resource';
import { APIPromise } from '../../api-promise';
import { CursorPage, type CursorPageParams, type PagePromise } from '../../core/pagination';
import type { RequestOptions } from '../../internal/request-options';
import { path as __scalarPath } from '../../internal/utils/path';

export class SSH extends APIResource {
  /**
   * List SSH sessions
   *
   * @param {SSHListParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {PagePromise<SSHSessionsCursorPage, SSHSession>} OK
   *
   * @example
   * ```ts
   * const page = await client.machines.ssh.list({
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   * });
   * ```
   */
  list(params: SSHListParams, options?: RequestOptions): PagePromise<SSHSessionsCursorPage, SSHSession> {
    const { machine_id, ...query } = params;
    return this._client.getAPIList(__scalarPath`/v1/machines/${machine_id}/ssh`, CursorPage<SSHSession>, {
      query,
      ...options,
    });
  }

  /**
   * Create SSH session
   *
   * @param {SSHCreateParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<SSHSession>} OK
   *
   * @example
   * ```ts
   * const sshSession = await client.machines.ssh.create({
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   public_key: '',
   * });
   * ```
   */
  create(params: SSHCreateParams, options?: RequestOptions): APIPromise<SSHSession> {
    const { machine_id, ...body } = params;
    return this._client.post(__scalarPath`/v1/machines/${machine_id}/ssh`, { body, ...options });
  }

  /**
   * Get SSH session
   *
   * @param {SSHRetrieveParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<SSHSession>} OK
   *
   * @example
   * ```ts
   * const sshSession = await client.machines.ssh.retrieve({
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   session_id: 'sessionID',
   * });
   * ```
   */
  retrieve(params: SSHRetrieveParams, options?: RequestOptions): APIPromise<SSHSession> {
    const { machine_id, session_id } = params;
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/ssh/${session_id}`, options);
  }

  /**
   * Delete SSH session
   *
   * @param {SSHDeleteParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<SSHSession>} OK
   *
   * @example
   * ```ts
   * const sshSession = await client.machines.ssh.delete({
   *   machine_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
   *   session_id: 'sessionID',
   * });
   * ```
   */
  delete(params: SSHDeleteParams, options?: RequestOptions): APIPromise<SSHSession> {
    const { machine_id, session_id } = params;
    return this._client.delete(__scalarPath`/v1/machines/${machine_id}/ssh/${session_id}`, options);
  }
}

export interface SSHSessionCreateParams {
  public_key: string;
}

export interface SSHSession {
  /**
   * @format date-time
   */
  created_at: string;
  /**
   * @format uuid
   */
  machine_id: string;
  session_id: string;
  status: 'wake_in_progress' | 'ssh_in_progress' | 'ready' | 'closed' | 'expired' | 'failed';
  connection?: SSHConnection;
  error_code?: string;
  error_message?: string;
  /**
   * @format date-time
   */
  expires_at?: string;
  /**
   * @format date-time
   */
  ready_at?: string;
  /**
   * @format int64
   */
  retry_after_ms?: number;
}

export interface SSHSessionList {
  items: Array<SSHSession> | null;
  next_cursor?: string;
}

export interface SSHConnection {
  endpoint: string;
  /**
   * @format int64
   */
  port: number;
  ssh_username: string;
  host_trust?: SSHHostTrust;
  user_certificate?: string;
}

export interface SSHHostTrust {
  host_pattern: string;
  kind: 'cert_authority';
  public_key: string;
}

export interface SSHListParams extends CursorPageParams {
  /**
   * Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
}

export type SSHSessionsCursorPage = CursorPage<SSHSession>;

export interface SSHCreateParams {
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
  public_key: string;
}

export interface SSHRetrieveParams {
  /**
   * Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  session_id: string;
}

export interface SSHDeleteParams {
  /**
   * Bare, lowercase, hyphenated Machine UUID. Pass the returned machine_id unchanged.
   * @minLength 36
   * @maxLength 39
   * @pattern ^(dm-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
   */
  machine_id: string;
  /**
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  session_id: string;
}
export declare namespace SSH {
  export {
    type SSHSessionCreateParams as SSHSessionCreateParams,
    type SSHSession as SSHSession,
    type SSHSessionList as SSHSessionList,
    type SSHConnection as SSHConnection,
    type SSHHostTrust as SSHHostTrust,
    type SSHSessionsCursorPage as SSHSessionsCursorPage,
    type SSHListParams as SSHListParams,
    type SSHCreateParams as SSHCreateParams,
    type SSHRetrieveParams as SSHRetrieveParams,
    type SSHDeleteParams as SSHDeleteParams,
  };
}
