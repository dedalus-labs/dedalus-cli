// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from "../../resource";
import { APIPromise } from "../../api-promise";
import { Stream } from "../../core/streaming";
import type { RequestOptions } from "../../internal/request-options";
import { buildHeaders } from "../../internal/headers";
import { path as __scalarPath } from "../../internal/utils/path";
import { MachineLifecycleWS, type MachineLifecycleWSClientOptions } from "./ws";

export class MachineLifecycle extends APIResource {
  /**
   * List machines
   *
   * @param {MachineLifecycleListParams} [params] - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleListResponse>} OK
   *
   * @example
   * ```ts
   * const list = await client.machineLifecycle.list();
   * ```
   */
  list(params: MachineLifecycleListParams | null | undefined = {}, options?: RequestOptions): APIPromise<MachineLifecycleListResponse> {
    const { limit, cursor, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.get("/v1/machines", { query: { limit: limit, cursor: cursor }, ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Create machine
   *
   * @param {MachineLifecycleCreateParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleCreateResponse>} Create converged inline
   *
   * @example
   * ```ts
   * const create = await client.machineLifecycle.create({
   *   memory_mib: 0,
   *   storage_gib: 0,
   *   vcpu: 0,
   * });
   * ```
   */
  create(params: MachineLifecycleCreateParams, options?: RequestOptions): APIPromise<MachineLifecycleCreateResponse> {
    const { "X-Dedalus-Org-Id": xDedalusOrgID, ...body } = params ?? {};
    return this._client.post("/v1/machines", { body: body, ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Destroy machine
   *
   * @param {MachineLifecycleDeleteParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleDeleteResponse>} OK
   *
   * @example
   * ```ts
   * const delete_ = await client.machineLifecycle.delete({
   *   machine_id: "machineID",
   * });
   * ```
   */
  delete(params: MachineLifecycleDeleteParams, options?: RequestOptions): APIPromise<MachineLifecycleDeleteResponse> {
    const { machine_id, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.delete(__scalarPath`/v1/machines/${machine_id}`, { ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Get machine
   *
   * @param {MachineLifecycleRetrieveParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleRetrieveResponse>} OK
   *
   * @example
   * ```ts
   * const retrieve = await client.machineLifecycle.retrieve({
   *   machine_id: "machineID",
   * });
   * ```
   */
  retrieve(params: MachineLifecycleRetrieveParams, options?: RequestOptions): APIPromise<MachineLifecycleRetrieveResponse> {
    const { machine_id, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.get(__scalarPath`/v1/machines/${machine_id}`, { ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Update machine
   *
   * @param {MachineLifecyclePatchParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecyclePatchResponse>} OK
   *
   * @example
   * ```ts
   * const patch = await client.machineLifecycle.patch({
   *   machine_id: "machineID",
   * });
   * ```
   */
  patch(params: MachineLifecyclePatchParams, options?: RequestOptions): APIPromise<MachineLifecyclePatchResponse> {
    const { machine_id, "X-Dedalus-Org-Id": xDedalusOrgID, ...body } = params ?? {};
    return this._client.patch(__scalarPath`/v1/machines/${machine_id}`, { body: body, ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * List artifacts
   *
   * @param {MachineLifecycleListArtifactsParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleListArtifactsResponse>} OK
   *
   * @example
   * ```ts
   * const listArtifacts = await client.machineLifecycle.listArtifacts({
   *   machine_id: "machineID",
   * });
   * ```
   */
  listArtifacts(params: MachineLifecycleListArtifactsParams, options?: RequestOptions): APIPromise<MachineLifecycleListArtifactsResponse> {
    const { machine_id, limit, cursor, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/artifacts`, { query: { limit: limit, cursor: cursor }, ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Delete artifact
   *
   * @param {MachineLifecycleDeleteArtifactParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleDeleteArtifactResponse>} OK
   *
   * @example
   * ```ts
   * const deleteArtifact = await client.machineLifecycle.deleteArtifact({
   *   machine_id: "machineID",
   *   artifact_id: "artifactID",
   * });
   * ```
   */
  deleteArtifact(params: MachineLifecycleDeleteArtifactParams, options?: RequestOptions): APIPromise<MachineLifecycleDeleteArtifactResponse> {
    const { machine_id, artifact_id, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.delete(__scalarPath`/v1/machines/${machine_id}/artifacts/${artifact_id}`, { ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Get artifact
   *
   * @param {MachineLifecycleRetrieveArtifactParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleRetrieveArtifactResponse>} OK
   *
   * @example
   * ```ts
   * const retrieveArtifact = await client.machineLifecycle.retrieveArtifact({
   *   machine_id: "machineID",
   *   artifact_id: "artifactID",
   * });
   * ```
   */
  retrieveArtifact(params: MachineLifecycleRetrieveArtifactParams, options?: RequestOptions): APIPromise<MachineLifecycleRetrieveArtifactResponse> {
    const { machine_id, artifact_id, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/artifacts/${artifact_id}`, { ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * List executions
   *
   * @param {MachineLifecycleListExecutionsParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleListExecutionsResponse>} OK
   *
   * @example
   * ```ts
   * const listExecutions = await client.machineLifecycle.listExecutions({
   *   machine_id: "machineID",
   * });
   * ```
   */
  listExecutions(params: MachineLifecycleListExecutionsParams, options?: RequestOptions): APIPromise<MachineLifecycleListExecutionsResponse> {
    const { machine_id, limit, cursor, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/executions`, { query: { limit: limit, cursor: cursor }, ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Create execution
   *
   * @param {MachineLifecycleCreateExecutionParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleCreateExecutionResponse>} OK
   *
   * @example
   * ```ts
   * const createExecution = await client.machineLifecycle.createExecution({
   *   machine_id: "machineID",
   *   command: [],
   * });
   * ```
   */
  createExecution(params: MachineLifecycleCreateExecutionParams, options?: RequestOptions): APIPromise<MachineLifecycleCreateExecutionResponse> {
    const { machine_id, "X-Dedalus-Org-Id": xDedalusOrgID, ...body } = params ?? {};
    return this._client.post(__scalarPath`/v1/machines/${machine_id}/executions`, { body: body, ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Delete execution
   *
   * @param {MachineLifecycleDeleteExecutionParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleDeleteExecutionResponse>} OK
   *
   * @example
   * ```ts
   * const deleteExecution = await client.machineLifecycle.deleteExecution({
   *   machine_id: "machineID",
   *   execution_id: "executionID",
   * });
   * ```
   */
  deleteExecution(params: MachineLifecycleDeleteExecutionParams, options?: RequestOptions): APIPromise<MachineLifecycleDeleteExecutionResponse> {
    const { machine_id, execution_id, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.delete(__scalarPath`/v1/machines/${machine_id}/executions/${execution_id}`, { ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Get execution
   *
   * @param {MachineLifecycleRetrieveExecutionParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleRetrieveExecutionResponse>} OK
   *
   * @example
   * ```ts
   * const retrieveExecution = await client.machineLifecycle.retrieveExecution({
   *   machine_id: "machineID",
   *   execution_id: "executionID",
   * });
   * ```
   */
  retrieveExecution(params: MachineLifecycleRetrieveExecutionParams, options?: RequestOptions): APIPromise<MachineLifecycleRetrieveExecutionResponse> {
    const { machine_id, execution_id, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/executions/${execution_id}`, { ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * List execution events
   *
   * @param {MachineLifecycleListExecutionEventsParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleListExecutionEventsResponse>} OK
   *
   * @example
   * ```ts
   * const listExecutionEvents = await client.machineLifecycle.listExecutionEvents({
   *   machine_id: "machineID",
   *   execution_id: "executionID",
   * });
   * ```
   */
  listExecutionEvents(params: MachineLifecycleListExecutionEventsParams, options?: RequestOptions): APIPromise<MachineLifecycleListExecutionEventsResponse> {
    const { machine_id, execution_id, limit, cursor, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/executions/${execution_id}/events`, { query: { limit: limit, cursor: cursor }, ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Get execution output
   *
   * @param {MachineLifecycleListExecutionOutputParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleListExecutionOutputResponse>} OK
   *
   * @example
   * ```ts
   * const listExecutionOutput = await client.machineLifecycle.listExecutionOutput({
   *   machine_id: "machineID",
   *   execution_id: "executionID",
   * });
   * ```
   */
  listExecutionOutput(params: MachineLifecycleListExecutionOutputParams, options?: RequestOptions): APIPromise<MachineLifecycleListExecutionOutputResponse> {
    const { machine_id, execution_id, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/executions/${execution_id}/output`, { ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * List previews
   *
   * @param {MachineLifecycleListPreviewsParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleListPreviewsResponse>} OK
   *
   * @example
   * ```ts
   * const listPreviews = await client.machineLifecycle.listPreviews({
   *   machine_id: "machineID",
   * });
   * ```
   */
  listPreviews(params: MachineLifecycleListPreviewsParams, options?: RequestOptions): APIPromise<MachineLifecycleListPreviewsResponse> {
    const { machine_id, limit, cursor, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/previews`, { query: { limit: limit, cursor: cursor }, ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Create preview
   *
   * @param {MachineLifecycleCreatePreviewParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleCreatePreviewResponse>} OK
   *
   * @example
   * ```ts
   * const createPreview = await client.machineLifecycle.createPreview({
   *   machine_id: "machineID",
   *   port: 0,
   * });
   * ```
   */
  createPreview(params: MachineLifecycleCreatePreviewParams, options?: RequestOptions): APIPromise<MachineLifecycleCreatePreviewResponse> {
    const { machine_id, "X-Dedalus-Org-Id": xDedalusOrgID, ...body } = params ?? {};
    return this._client.post(__scalarPath`/v1/machines/${machine_id}/previews`, { body: body, ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Delete preview
   *
   * @param {MachineLifecycleDeletePreviewParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleDeletePreviewResponse>} OK
   *
   * @example
   * ```ts
   * const deletePreview = await client.machineLifecycle.deletePreview({
   *   machine_id: "machineID",
   *   preview_id: "previewID",
   * });
   * ```
   */
  deletePreview(params: MachineLifecycleDeletePreviewParams, options?: RequestOptions): APIPromise<MachineLifecycleDeletePreviewResponse> {
    const { machine_id, preview_id, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.delete(__scalarPath`/v1/machines/${machine_id}/previews/${preview_id}`, { ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Get preview
   *
   * @param {MachineLifecycleRetrievePreviewParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleRetrievePreviewResponse>} OK
   *
   * @example
   * ```ts
   * const retrievePreview = await client.machineLifecycle.retrievePreview({
   *   machine_id: "machineID",
   *   preview_id: "previewID",
   * });
   * ```
   */
  retrievePreview(params: MachineLifecycleRetrievePreviewParams, options?: RequestOptions): APIPromise<MachineLifecycleRetrievePreviewResponse> {
    const { machine_id, preview_id, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/previews/${preview_id}`, { ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Sleep a running machine
   *
   * @param {MachineLifecycleSleepParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleSleepResponse>} OK
   *
   * @example
   * ```ts
   * const sleep = await client.machineLifecycle.sleep({
   *   machine_id: "machineID",
   * });
   * ```
   */
  sleep(params: MachineLifecycleSleepParams, options?: RequestOptions): APIPromise<MachineLifecycleSleepResponse> {
    const { machine_id, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.post(__scalarPath`/v1/machines/${machine_id}/sleep`, { ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * List SSH sessions
   *
   * @param {MachineLifecycleListSSHSessionsParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleListSSHSessionsResponse>} OK
   *
   * @example
   * ```ts
   * const listSSHSessions = await client.machineLifecycle.listSSHSessions({
   *   machine_id: "machineID",
   * });
   * ```
   */
  listSSHSessions(params: MachineLifecycleListSSHSessionsParams, options?: RequestOptions): APIPromise<MachineLifecycleListSSHSessionsResponse> {
    const { machine_id, limit, cursor, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/ssh`, { query: { limit: limit, cursor: cursor }, ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Create SSH session
   *
   * @param {MachineLifecycleCreateSSHSessionParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleCreateSSHSessionResponse>} OK
   *
   * @example
   * ```ts
   * const createSSHSession = await client.machineLifecycle.createSSHSession({
   *   machine_id: "machineID",
   *   public_key: "",
   * });
   * ```
   */
  createSSHSession(params: MachineLifecycleCreateSSHSessionParams, options?: RequestOptions): APIPromise<MachineLifecycleCreateSSHSessionResponse> {
    const { machine_id, "X-Dedalus-Org-Id": xDedalusOrgID, ...body } = params ?? {};
    return this._client.post(__scalarPath`/v1/machines/${machine_id}/ssh`, { body: body, ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Delete SSH session
   *
   * @param {MachineLifecycleDeleteSSHSessionParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleDeleteSSHSessionResponse>} OK
   *
   * @example
   * ```ts
   * const deleteSSHSession = await client.machineLifecycle.deleteSSHSession({
   *   machine_id: "machineID",
   *   session_id: "sessionID",
   * });
   * ```
   */
  deleteSSHSession(params: MachineLifecycleDeleteSSHSessionParams, options?: RequestOptions): APIPromise<MachineLifecycleDeleteSSHSessionResponse> {
    const { machine_id, session_id, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.delete(__scalarPath`/v1/machines/${machine_id}/ssh/${session_id}`, { ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Get SSH session
   *
   * @param {MachineLifecycleRetrieveSSHSessionParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleRetrieveSSHSessionResponse>} OK
   *
   * @example
   * ```ts
   * const retrieveSSHSession = await client.machineLifecycle.retrieveSSHSession({
   *   machine_id: "machineID",
   *   session_id: "sessionID",
   * });
   * ```
   */
  retrieveSSHSession(params: MachineLifecycleRetrieveSSHSessionParams, options?: RequestOptions): APIPromise<MachineLifecycleRetrieveSSHSessionResponse> {
    const { machine_id, session_id, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/ssh/${session_id}`, { ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Streams machine lifecycle updates over Server-Sent Events. Each `status` event contains a full `LifecycleResponse` payload. The stream closes after the machine reaches its current desired state.
   *
   * @param {MachineLifecycleWatchStatusParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<Stream<MachineLifecycleWatchStatusResponse>>} Server-Sent Event stream (`text/event-stream`) of machine lifecycle updates.
   *
   * @example
   * ```ts
   * const stream = await client.machineLifecycle.watchStatus({
   *   machine_id: "machineID",
   * });
   * for await (const event of stream) {
   *   console.log(event);
   * }
   * ```
   */
  watchStatus(params: MachineLifecycleWatchStatusParams, options?: RequestOptions): APIPromise<Stream<MachineLifecycleWatchStatusResponse>> {
    const { machine_id, "X-Dedalus-Org-Id": xDedalusOrgID, "Last-Event-ID": lastEventID } = params ?? {};
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/status/stream`, { ...options, headers: buildHeaders([{ Accept: "text/event-stream", ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}), ...(lastEventID !== undefined ? { "Last-Event-ID": lastEventID } : {}) }, options?.headers]), stream: true });
  }

  /**
   * List terminals
   *
   * @param {MachineLifecycleListTerminalsParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleListTerminalsResponse>} OK
   *
   * @example
   * ```ts
   * const listTerminals = await client.machineLifecycle.listTerminals({
   *   machine_id: "machineID",
   * });
   * ```
   */
  listTerminals(params: MachineLifecycleListTerminalsParams, options?: RequestOptions): APIPromise<MachineLifecycleListTerminalsResponse> {
    const { machine_id, limit, cursor, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/terminals`, { query: { limit: limit, cursor: cursor }, ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Create terminal
   *
   * @param {MachineLifecycleCreateTerminalParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleCreateTerminalResponse>} OK
   *
   * @example
   * ```ts
   * const createTerminal = await client.machineLifecycle.createTerminal({
   *   machine_id: "machineID",
   *   height: 0,
   *   width: 0,
   * });
   * ```
   */
  createTerminal(params: MachineLifecycleCreateTerminalParams, options?: RequestOptions): APIPromise<MachineLifecycleCreateTerminalResponse> {
    const { machine_id, "X-Dedalus-Org-Id": xDedalusOrgID, ...body } = params ?? {};
    return this._client.post(__scalarPath`/v1/machines/${machine_id}/terminals`, { body: body, ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Delete terminal
   *
   * @param {MachineLifecycleDeleteTerminalParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleDeleteTerminalResponse>} OK
   *
   * @example
   * ```ts
   * const deleteTerminal = await client.machineLifecycle.deleteTerminal({
   *   machine_id: "machineID",
   *   terminal_id: "terminalID",
   * });
   * ```
   */
  deleteTerminal(params: MachineLifecycleDeleteTerminalParams, options?: RequestOptions): APIPromise<MachineLifecycleDeleteTerminalResponse> {
    const { machine_id, terminal_id, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.delete(__scalarPath`/v1/machines/${machine_id}/terminals/${terminal_id}`, { ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Get terminal
   *
   * @param {MachineLifecycleRetrieveTerminalParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleRetrieveTerminalResponse>} OK
   *
   * @example
   * ```ts
   * const retrieveTerminal = await client.machineLifecycle.retrieveTerminal({
   *   machine_id: "machineID",
   *   terminal_id: "terminalID",
   * });
   * ```
   */
  retrieveTerminal(params: MachineLifecycleRetrieveTerminalParams, options?: RequestOptions): APIPromise<MachineLifecycleRetrieveTerminalResponse> {
    const { machine_id, terminal_id, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.get(__scalarPath`/v1/machines/${machine_id}/terminals/${terminal_id}`, { ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }

  /**
   * Upgrades to a WebSocket connection for interactive terminal I/O. Clients send JSON `TerminalClientEvent` messages and receive JSON `TerminalServerEvent` messages. Terminal byte streams are base64-encoded inside `input` and `output` events; `resize` events use integer `width` and `height` fields.
   *
   * @param {MachineLifecycleConnectTerminalParams} params - The parameters to send with the request.
   * @param {MachineLifecycleWSClientOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {MachineLifecycleWS} Switching Protocols to WebSocket
   *
   * @example
   * ```ts
   * const connection = client.machineLifecycle.connectTerminal({
   *   machine_id: "machineID",
   *   terminal_id: "terminalID",
   * });
   * try {
   *   for await (const message of connection) {
   *     console.log(message);
   *   }
   * } finally {
   *   connection.close();
   * }
   * ```
   */
  connectTerminal(params: MachineLifecycleConnectTerminalParams, options?: MachineLifecycleWSClientOptions): MachineLifecycleWS {
    const { machine_id, terminal_id, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return new MachineLifecycleWS(this._client, { machine_id: machine_id, terminal_id: terminal_id, ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options);
  }

  /**
   * Wake a sleeping machine
   *
   * @param {MachineLifecycleWakeParams} params - The parameters to send with the request.
   * @param {RequestOptions} [options] - Options to apply to the request, such as headers and an abort signal.
   * @returns {APIPromise<MachineLifecycleWakeResponse>} OK
   *
   * @example
   * ```ts
   * const wake = await client.machineLifecycle.wake({
   *   machine_id: "machineID",
   * });
   * ```
   */
  wake(params: MachineLifecycleWakeParams, options?: RequestOptions): APIPromise<MachineLifecycleWakeResponse> {
    const { machine_id, "X-Dedalus-Org-Id": xDedalusOrgID } = params ?? {};
    return this._client.post(__scalarPath`/v1/machines/${machine_id}/wake`, { ...options, headers: buildHeaders([{ ...(xDedalusOrgID !== undefined ? { "X-Dedalus-Org-Id": xDedalusOrgID } : {}) }, options?.headers]) });
  }
}

export interface CreateMachineRequest {
  /**
   * Memory in MiB.
   * @format int64
   */
  memory_mib: number;
  /**
   * Storage in GiB.
   * @format int64
   */
  storage_gib: number;
  /**
   * CPU in vCPUs.
   * @format double
   */
  vcpu: number;
  /**
   * Idle window before autosleep. Accepts fixed duration units like 30s, 30m, 2h, 7d3h4s, or 1w3d, raw seconds ("1800"), or never to disable.
   */
  autosleep?: string;
}

export interface UpdateMachineRequest {
  /**
   * Idle window before autosleep. Accepts fixed duration units like 30s, 30m, 2h, 7d3h4s, or 1w3d, raw seconds ("1800"), or never to disable.
   */
  autosleep?: string;
  /**
   * Memory in MiB.
   * @format int64
   */
  memory_mib?: number;
  /**
   * Storage in GiB.
   * @format int64
   */
  storage_gib?: number;
  /**
   * CPU in vCPUs.
   * @format double
   */
  vcpu?: number;
}

export interface CreateExecutionRequest {
  command: Array<string> | null;
  cwd?: string;
  env?: Record<string, string>;
  stdin?: string;
  /**
   * @format int64
   */
  timeout_ms?: number;
}

export interface CreatePreviewRequest {
  /**
   * @format int64
   */
  port: number;
  protocol?: "http" | "https";
  visibility?: "public" | "private" | "org";
}

export interface CreateSSHSessionRequest {
  public_key: string;
}

export interface CreateTerminalRequest {
  /**
   * @format int64
   */
  height: number;
  /**
   * @format int64
   */
  width: number;
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
}

export interface MachineLifecycleListParams {
  /**
   * Query param
   * @format int64
   */
  limit?: number;
  /**
   * Query param
   */
  cursor?: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleListResponse {
  items: Array<MachineLifecycleListResponse.Item> | null;
  next_cursor?: string;
}

export namespace MachineLifecycleListResponse {
  export interface Item {
    /**
     * Seconds of inactivity before autosleep. 0 disables autosleep.
     * @format int64
     * @minimum 0
     * @maximum 9223372036
     */
    autosleep_seconds: number;
    /**
     * @format date-time
     */
    created_at: string;
    desired_state: "running" | "sleeping" | "destroyed";
    machine_id: string;
    /**
     * Memory in MiB.
     * @format int64
     */
    memory_mib: number;
    status: Item.Status;
    /**
     * @format int64
     */
    storage_gib: number;
    /**
     * CPU in vCPUs.
     * @format double
     */
    vcpu: number;
  }

  export namespace Item {
    export interface Status {
      /**
       * @format date-time
       */
      last_progress_at: string;
      /**
       * @format date-time
       */
      last_transition_at: string;
      phase: "accepted" | "placement_pending" | "starting" | "running" | "stopping" | "sleeping" | "destroying" | "destroyed" | "failed";
      reason: string;
      retryable: boolean;
      revision: string;
      last_error?: string;
    }
  }
}

export interface MachineLifecycleCreateParams {
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
  /**
   * Body param: Idle window before autosleep. Accepts fixed duration units like 30s, 30m, 2h, 7d3h4s, or 1w3d, raw seconds ("1800"), or never to disable.
   */
  autosleep?: string;
  /**
   * Body param: Memory in MiB.
   * @format int64
   */
  memory_mib: number;
  /**
   * Body param: Storage in GiB.
   * @format int64
   */
  storage_gib: number;
  /**
   * Body param: CPU in vCPUs.
   * @format double
   */
  vcpu: number;
}

export interface MachineLifecycleCreateResponse {
  /**
   * Seconds of inactivity before autosleep. 0 disables autosleep.
   * @format int64
   * @minimum 0
   * @maximum 9223372036
   */
  autosleep_seconds: number;
  desired_state: "running" | "sleeping" | "destroyed";
  machine_id: string;
  /**
   * Memory in MiB.
   * @format int64
   */
  memory_mib: number;
  status: MachineLifecycleCreateResponse.Status;
  /**
   * @format int64
   */
  storage_gib: number;
  /**
   * CPU in vCPUs.
   * @format double
   */
  vcpu: number;
}

export namespace MachineLifecycleCreateResponse {
  export interface Status {
    /**
     * @format date-time
     */
    last_progress_at: string;
    /**
     * @format date-time
     */
    last_transition_at: string;
    phase: "accepted" | "placement_pending" | "starting" | "running" | "stopping" | "sleeping" | "destroying" | "destroyed" | "failed";
    reason: string;
    retryable: boolean;
    revision: string;
    last_error?: string;
  }
}

export interface MachineLifecycleDeleteParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleDeleteResponse {
  /**
   * Seconds of inactivity before autosleep. 0 disables autosleep.
   * @format int64
   * @minimum 0
   * @maximum 9223372036
   */
  autosleep_seconds: number;
  desired_state: "running" | "sleeping" | "destroyed";
  machine_id: string;
  /**
   * Memory in MiB.
   * @format int64
   */
  memory_mib: number;
  status: MachineLifecycleDeleteResponse.Status;
  /**
   * @format int64
   */
  storage_gib: number;
  /**
   * CPU in vCPUs.
   * @format double
   */
  vcpu: number;
}

export namespace MachineLifecycleDeleteResponse {
  export interface Status {
    /**
     * @format date-time
     */
    last_progress_at: string;
    /**
     * @format date-time
     */
    last_transition_at: string;
    phase: "accepted" | "placement_pending" | "starting" | "running" | "stopping" | "sleeping" | "destroying" | "destroyed" | "failed";
    reason: string;
    retryable: boolean;
    revision: string;
    last_error?: string;
  }
}

export interface MachineLifecycleRetrieveParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleRetrieveResponse {
  /**
   * Seconds of inactivity before autosleep. 0 disables autosleep.
   * @format int64
   * @minimum 0
   * @maximum 9223372036
   */
  autosleep_seconds: number;
  desired_state: "running" | "sleeping" | "destroyed";
  machine_id: string;
  /**
   * Memory in MiB.
   * @format int64
   */
  memory_mib: number;
  status: MachineLifecycleRetrieveResponse.Status;
  /**
   * @format int64
   */
  storage_gib: number;
  /**
   * CPU in vCPUs.
   * @format double
   */
  vcpu: number;
}

export namespace MachineLifecycleRetrieveResponse {
  export interface Status {
    /**
     * @format date-time
     */
    last_progress_at: string;
    /**
     * @format date-time
     */
    last_transition_at: string;
    phase: "accepted" | "placement_pending" | "starting" | "running" | "stopping" | "sleeping" | "destroying" | "destroyed" | "failed";
    reason: string;
    retryable: boolean;
    revision: string;
    last_error?: string;
  }
}

export interface MachineLifecyclePatchParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
  /**
   * Body param: Idle window before autosleep. Accepts fixed duration units like 30s, 30m, 2h, 7d3h4s, or 1w3d, raw seconds ("1800"), or never to disable.
   */
  autosleep?: string;
  /**
   * Body param: Memory in MiB.
   * @format int64
   */
  memory_mib?: number;
  /**
   * Body param: Storage in GiB.
   * @format int64
   */
  storage_gib?: number;
  /**
   * Body param: CPU in vCPUs.
   * @format double
   */
  vcpu?: number;
}

export interface MachineLifecyclePatchResponse {
  /**
   * Seconds of inactivity before autosleep. 0 disables autosleep.
   * @format int64
   * @minimum 0
   * @maximum 9223372036
   */
  autosleep_seconds: number;
  desired_state: "running" | "sleeping" | "destroyed";
  machine_id: string;
  /**
   * Memory in MiB.
   * @format int64
   */
  memory_mib: number;
  status: MachineLifecyclePatchResponse.Status;
  /**
   * @format int64
   */
  storage_gib: number;
  /**
   * CPU in vCPUs.
   * @format double
   */
  vcpu: number;
}

export namespace MachineLifecyclePatchResponse {
  export interface Status {
    /**
     * @format date-time
     */
    last_progress_at: string;
    /**
     * @format date-time
     */
    last_transition_at: string;
    phase: "accepted" | "placement_pending" | "starting" | "running" | "stopping" | "sleeping" | "destroying" | "destroyed" | "failed";
    reason: string;
    retryable: boolean;
    revision: string;
    last_error?: string;
  }
}

export interface MachineLifecycleListArtifactsParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Query param
   * @format int64
   */
  limit?: number;
  /**
   * Query param
   */
  cursor?: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleListArtifactsResponse {
  items: Array<MachineLifecycleListArtifactsResponse.Item> | null;
  next_cursor?: string;
}

export namespace MachineLifecycleListArtifactsResponse {
  export interface Item {
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
}

export interface MachineLifecycleDeleteArtifactParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
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
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleDeleteArtifactResponse {
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

export interface MachineLifecycleRetrieveArtifactParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
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
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleRetrieveArtifactResponse {
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

export interface MachineLifecycleListExecutionsParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Query param
   * @format int64
   */
  limit?: number;
  /**
   * Query param
   */
  cursor?: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleListExecutionsResponse {
  items: Array<MachineLifecycleListExecutionsResponse.Item> | null;
  next_cursor?: string;
}

export namespace MachineLifecycleListExecutionsResponse {
  export interface Item {
    command: Array<string> | null;
    /**
     * @format date-time
     */
    created_at: string;
    execution_id: string;
    machine_id: string;
    status: "wake_in_progress" | "queued" | "running" | "succeeded" | "failed" | "cancelled" | "expired";
    artifacts?: Array<Item.Artifact> | null;
    /**
     * @format date-time
     */
    completed_at?: string;
    cwd?: string;
    env_keys?: Array<string> | null;
    error_code?: string;
    error_message?: string;
    /**
     * @format int64
     */
    exit_code?: number;
    /**
     * @format date-time
     */
    expires_at?: string;
    /**
     * @format int64
     */
    retry_after_ms?: number;
    /**
     * @format int64
     */
    signal?: number;
    /**
     * @format date-time
     */
    started_at?: string;
    /**
     * @format int64
     */
    stderr_bytes?: number;
    stderr_truncated?: boolean;
    /**
     * @format int64
     */
    stdout_bytes?: number;
    stdout_truncated?: boolean;
  }

  export namespace Item {
    export interface Artifact {
      artifact_id: string;
      name: string;
    }
  }
}

export interface MachineLifecycleCreateExecutionParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
  /**
   * Body param
   */
  command: Array<string> | null;
  /**
   * Body param
   */
  cwd?: string;
  /**
   * Body param
   */
  env?: Record<string, string>;
  /**
   * Body param
   */
  stdin?: string;
  /**
   * Body param
   * @format int64
   */
  timeout_ms?: number;
}

export interface MachineLifecycleCreateExecutionResponse {
  command: Array<string> | null;
  /**
   * @format date-time
   */
  created_at: string;
  execution_id: string;
  machine_id: string;
  status: "wake_in_progress" | "queued" | "running" | "succeeded" | "failed" | "cancelled" | "expired";
  artifacts?: Array<MachineLifecycleCreateExecutionResponse.Artifact> | null;
  /**
   * @format date-time
   */
  completed_at?: string;
  cwd?: string;
  env_keys?: Array<string> | null;
  error_code?: string;
  error_message?: string;
  /**
   * @format int64
   */
  exit_code?: number;
  /**
   * @format date-time
   */
  expires_at?: string;
  /**
   * @format int64
   */
  retry_after_ms?: number;
  /**
   * @format int64
   */
  signal?: number;
  /**
   * @format date-time
   */
  started_at?: string;
  /**
   * @format int64
   */
  stderr_bytes?: number;
  stderr_truncated?: boolean;
  /**
   * @format int64
   */
  stdout_bytes?: number;
  stdout_truncated?: boolean;
}

export namespace MachineLifecycleCreateExecutionResponse {
  export interface Artifact {
    artifact_id: string;
    name: string;
  }
}

export interface MachineLifecycleDeleteExecutionParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Path param
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  execution_id: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleDeleteExecutionResponse {
  command: Array<string> | null;
  /**
   * @format date-time
   */
  created_at: string;
  execution_id: string;
  machine_id: string;
  status: "wake_in_progress" | "queued" | "running" | "succeeded" | "failed" | "cancelled" | "expired";
  artifacts?: Array<MachineLifecycleDeleteExecutionResponse.Artifact> | null;
  /**
   * @format date-time
   */
  completed_at?: string;
  cwd?: string;
  env_keys?: Array<string> | null;
  error_code?: string;
  error_message?: string;
  /**
   * @format int64
   */
  exit_code?: number;
  /**
   * @format date-time
   */
  expires_at?: string;
  /**
   * @format int64
   */
  retry_after_ms?: number;
  /**
   * @format int64
   */
  signal?: number;
  /**
   * @format date-time
   */
  started_at?: string;
  /**
   * @format int64
   */
  stderr_bytes?: number;
  stderr_truncated?: boolean;
  /**
   * @format int64
   */
  stdout_bytes?: number;
  stdout_truncated?: boolean;
}

export namespace MachineLifecycleDeleteExecutionResponse {
  export interface Artifact {
    artifact_id: string;
    name: string;
  }
}

export interface MachineLifecycleRetrieveExecutionParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Path param
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  execution_id: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleRetrieveExecutionResponse {
  command: Array<string> | null;
  /**
   * @format date-time
   */
  created_at: string;
  execution_id: string;
  machine_id: string;
  status: "wake_in_progress" | "queued" | "running" | "succeeded" | "failed" | "cancelled" | "expired";
  artifacts?: Array<MachineLifecycleRetrieveExecutionResponse.Artifact> | null;
  /**
   * @format date-time
   */
  completed_at?: string;
  cwd?: string;
  env_keys?: Array<string> | null;
  error_code?: string;
  error_message?: string;
  /**
   * @format int64
   */
  exit_code?: number;
  /**
   * @format date-time
   */
  expires_at?: string;
  /**
   * @format int64
   */
  retry_after_ms?: number;
  /**
   * @format int64
   */
  signal?: number;
  /**
   * @format date-time
   */
  started_at?: string;
  /**
   * @format int64
   */
  stderr_bytes?: number;
  stderr_truncated?: boolean;
  /**
   * @format int64
   */
  stdout_bytes?: number;
  stdout_truncated?: boolean;
}

export namespace MachineLifecycleRetrieveExecutionResponse {
  export interface Artifact {
    artifact_id: string;
    name: string;
  }
}

export interface MachineLifecycleListExecutionEventsParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Path param
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  execution_id: string;
  /**
   * Query param
   * @format int64
   */
  limit?: number;
  /**
   * Query param
   */
  cursor?: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleListExecutionEventsResponse {
  items: Array<MachineLifecycleListExecutionEventsResponse.Item> | null;
  next_cursor?: string;
}

export namespace MachineLifecycleListExecutionEventsResponse {
  export interface Item {
    /**
     * @format date-time
     */
    at: string;
    /**
     * @format int64
     */
    sequence: number;
    type: "lifecycle" | "stdout" | "stderr";
    chunk?: string;
    error_code?: string;
    error_message?: string;
    /**
     * @format int64
     */
    exit_code?: number;
    /**
     * @format int64
     */
    signal?: number;
    status?: "wake_in_progress" | "queued" | "running" | "succeeded" | "failed" | "cancelled" | "expired";
  }
}

export interface MachineLifecycleListExecutionOutputParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Path param
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  execution_id: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleListExecutionOutputResponse {
  execution_id: string;
  stderr?: string;
  /**
   * @format int64
   */
  stderr_bytes?: number;
  stderr_truncated?: boolean;
  stdout?: string;
  /**
   * @format int64
   */
  stdout_bytes?: number;
  stdout_truncated?: boolean;
}

export interface MachineLifecycleListPreviewsParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Query param
   * @format int64
   */
  limit?: number;
  /**
   * Query param
   */
  cursor?: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleListPreviewsResponse {
  items: Array<MachineLifecycleListPreviewsResponse.Item> | null;
  next_cursor?: string;
}

export namespace MachineLifecycleListPreviewsResponse {
  export interface Item {
    /**
     * @format date-time
     */
    created_at: string;
    machine_id: string;
    /**
     * @format int64
     */
    port: number;
    preview_id: string;
    status: "wake_in_progress" | "ready" | "closed" | "expired" | "failed";
    visibility: "public" | "private" | "org";
    error_code?: string;
    error_message?: string;
    /**
     * @format date-time
     */
    expires_at?: string;
    protocol?: "http" | "https";
    /**
     * @format date-time
     */
    ready_at?: string;
    /**
     * @format int64
     */
    retry_after_ms?: number;
    url?: string;
  }
}

export interface MachineLifecycleCreatePreviewParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
  /**
   * Body param
   * @format int64
   */
  port: number;
  /**
   * Body param
   */
  protocol?: "http" | "https";
  /**
   * Body param
   */
  visibility?: "public" | "private" | "org";
}

export interface MachineLifecycleCreatePreviewResponse {
  /**
   * @format date-time
   */
  created_at: string;
  machine_id: string;
  /**
   * @format int64
   */
  port: number;
  preview_id: string;
  status: "wake_in_progress" | "ready" | "closed" | "expired" | "failed";
  visibility: "public" | "private" | "org";
  error_code?: string;
  error_message?: string;
  /**
   * @format date-time
   */
  expires_at?: string;
  protocol?: "http" | "https";
  /**
   * @format date-time
   */
  ready_at?: string;
  /**
   * @format int64
   */
  retry_after_ms?: number;
  url?: string;
}

export interface MachineLifecycleDeletePreviewParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Path param
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  preview_id: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleDeletePreviewResponse {
  /**
   * @format date-time
   */
  created_at: string;
  machine_id: string;
  /**
   * @format int64
   */
  port: number;
  preview_id: string;
  status: "wake_in_progress" | "ready" | "closed" | "expired" | "failed";
  visibility: "public" | "private" | "org";
  error_code?: string;
  error_message?: string;
  /**
   * @format date-time
   */
  expires_at?: string;
  protocol?: "http" | "https";
  /**
   * @format date-time
   */
  ready_at?: string;
  /**
   * @format int64
   */
  retry_after_ms?: number;
  url?: string;
}

export interface MachineLifecycleRetrievePreviewParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Path param
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  preview_id: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleRetrievePreviewResponse {
  /**
   * @format date-time
   */
  created_at: string;
  machine_id: string;
  /**
   * @format int64
   */
  port: number;
  preview_id: string;
  status: "wake_in_progress" | "ready" | "closed" | "expired" | "failed";
  visibility: "public" | "private" | "org";
  error_code?: string;
  error_message?: string;
  /**
   * @format date-time
   */
  expires_at?: string;
  protocol?: "http" | "https";
  /**
   * @format date-time
   */
  ready_at?: string;
  /**
   * @format int64
   */
  retry_after_ms?: number;
  url?: string;
}

export interface MachineLifecycleSleepParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleSleepResponse {
  /**
   * Seconds of inactivity before autosleep. 0 disables autosleep.
   * @format int64
   * @minimum 0
   * @maximum 9223372036
   */
  autosleep_seconds: number;
  desired_state: "running" | "sleeping" | "destroyed";
  machine_id: string;
  /**
   * Memory in MiB.
   * @format int64
   */
  memory_mib: number;
  status: MachineLifecycleSleepResponse.Status;
  /**
   * @format int64
   */
  storage_gib: number;
  /**
   * CPU in vCPUs.
   * @format double
   */
  vcpu: number;
}

export namespace MachineLifecycleSleepResponse {
  export interface Status {
    /**
     * @format date-time
     */
    last_progress_at: string;
    /**
     * @format date-time
     */
    last_transition_at: string;
    phase: "accepted" | "placement_pending" | "starting" | "running" | "stopping" | "sleeping" | "destroying" | "destroyed" | "failed";
    reason: string;
    retryable: boolean;
    revision: string;
    last_error?: string;
  }
}

export interface MachineLifecycleListSSHSessionsParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Query param
   * @format int64
   */
  limit?: number;
  /**
   * Query param
   */
  cursor?: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleListSSHSessionsResponse {
  items: Array<MachineLifecycleListSSHSessionsResponse.Item> | null;
  next_cursor?: string;
}

export namespace MachineLifecycleListSSHSessionsResponse {
  export interface Item {
    /**
     * @format date-time
     */
    created_at: string;
    machine_id: string;
    session_id: string;
    status: "wake_in_progress" | "ready" | "closed" | "expired" | "failed";
    connection?: Item.Connection;
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

  export namespace Item {
    export interface Connection {
      endpoint: string;
      /**
       * @format int64
       */
      port: number;
      ssh_username: string;
      host_trust?: Connection.HostTrust;
      user_certificate?: string;
    }

    export namespace Connection {
      export interface HostTrust {
        host_pattern: string;
        kind: "cert_authority";
        public_key: string;
      }
    }
  }
}

export interface MachineLifecycleCreateSSHSessionParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
  /**
   * Body param
   */
  public_key: string;
}

export interface MachineLifecycleCreateSSHSessionResponse {
  /**
   * @format date-time
   */
  created_at: string;
  machine_id: string;
  session_id: string;
  status: "wake_in_progress" | "ready" | "closed" | "expired" | "failed";
  connection?: MachineLifecycleCreateSSHSessionResponse.Connection;
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

export namespace MachineLifecycleCreateSSHSessionResponse {
  export interface Connection {
    endpoint: string;
    /**
     * @format int64
     */
    port: number;
    ssh_username: string;
    host_trust?: Connection.HostTrust;
    user_certificate?: string;
  }

  export namespace Connection {
    export interface HostTrust {
      host_pattern: string;
      kind: "cert_authority";
      public_key: string;
    }
  }
}

export interface MachineLifecycleDeleteSSHSessionParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Path param
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  session_id: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleDeleteSSHSessionResponse {
  /**
   * @format date-time
   */
  created_at: string;
  machine_id: string;
  session_id: string;
  status: "wake_in_progress" | "ready" | "closed" | "expired" | "failed";
  connection?: MachineLifecycleDeleteSSHSessionResponse.Connection;
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

export namespace MachineLifecycleDeleteSSHSessionResponse {
  export interface Connection {
    endpoint: string;
    /**
     * @format int64
     */
    port: number;
    ssh_username: string;
    host_trust?: Connection.HostTrust;
    user_certificate?: string;
  }

  export namespace Connection {
    export interface HostTrust {
      host_pattern: string;
      kind: "cert_authority";
      public_key: string;
    }
  }
}

export interface MachineLifecycleRetrieveSSHSessionParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Path param
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  session_id: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleRetrieveSSHSessionResponse {
  /**
   * @format date-time
   */
  created_at: string;
  machine_id: string;
  session_id: string;
  status: "wake_in_progress" | "ready" | "closed" | "expired" | "failed";
  connection?: MachineLifecycleRetrieveSSHSessionResponse.Connection;
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

export namespace MachineLifecycleRetrieveSSHSessionResponse {
  export interface Connection {
    endpoint: string;
    /**
     * @format int64
     */
    port: number;
    ssh_username: string;
    host_trust?: Connection.HostTrust;
    user_certificate?: string;
  }

  export namespace Connection {
    export interface HostTrust {
      host_pattern: string;
      kind: "cert_authority";
      public_key: string;
    }
  }
}

export interface MachineLifecycleWatchStatusParams {
  /**
   * Path param: Machine identifier.
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Header param: Organization ID header applied to all DCS requests.
   * @format uuid
   */
  "X-Dedalus-Org-Id"?: string;
  /**
   * Header param: Optional resourceVersion bookmark used to resume a previous stream.
   */
  "Last-Event-ID"?: string;
}

export interface MachineLifecycleWatchStatusResponse {
  /**
   * Seconds of inactivity before autosleep. 0 disables autosleep.
   * @format int64
   * @minimum 0
   * @maximum 9223372036
   */
  autosleep_seconds: number;
  desired_state: "running" | "sleeping" | "destroyed";
  machine_id: string;
  /**
   * Memory in MiB.
   * @format int64
   */
  memory_mib: number;
  status: MachineLifecycleWatchStatusResponse.Status;
  /**
   * @format int64
   */
  storage_gib: number;
  /**
   * CPU in vCPUs.
   * @format double
   */
  vcpu: number;
}

export namespace MachineLifecycleWatchStatusResponse {
  export interface Status {
    /**
     * @format date-time
     */
    last_progress_at: string;
    /**
     * @format date-time
     */
    last_transition_at: string;
    phase: "accepted" | "placement_pending" | "starting" | "running" | "stopping" | "sleeping" | "destroying" | "destroyed" | "failed";
    reason: string;
    retryable: boolean;
    revision: string;
    last_error?: string;
  }
}

export interface MachineLifecycleListTerminalsParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Query param
   * @format int64
   */
  limit?: number;
  /**
   * Query param
   */
  cursor?: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleListTerminalsResponse {
  items: Array<MachineLifecycleListTerminalsResponse.Item> | null;
  next_cursor?: string;
}

export namespace MachineLifecycleListTerminalsResponse {
  export interface Item {
    /**
     * @format date-time
     */
    created_at: string;
    /**
     * @format int64
     */
    height: number;
    machine_id: string;
    status: "wake_in_progress" | "ready" | "closed" | "expired" | "failed";
    terminal_id: string;
    /**
     * @format int64
     */
    width: number;
    error_code?: string;
    error_message?: string;
    /**
     * @format date-time
     */
    expires_at?: string;
    protocol?: "websocket";
    /**
     * @format date-time
     */
    ready_at?: string;
    /**
     * @format int64
     */
    retry_after_ms?: number;
    stream_url?: string;
  }
}

export interface MachineLifecycleCreateTerminalParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
  /**
   * Body param
   */
  cwd?: string;
  /**
   * Body param
   */
  env?: Record<string, string>;
  /**
   * Body param
   * @format int64
   */
  height: number;
  /**
   * Body param
   */
  shell?: string;
  /**
   * Body param
   * @format int64
   */
  width: number;
}

export interface MachineLifecycleCreateTerminalResponse {
  /**
   * @format date-time
   */
  created_at: string;
  /**
   * @format int64
   */
  height: number;
  machine_id: string;
  status: "wake_in_progress" | "ready" | "closed" | "expired" | "failed";
  terminal_id: string;
  /**
   * @format int64
   */
  width: number;
  error_code?: string;
  error_message?: string;
  /**
   * @format date-time
   */
  expires_at?: string;
  protocol?: "websocket";
  /**
   * @format date-time
   */
  ready_at?: string;
  /**
   * @format int64
   */
  retry_after_ms?: number;
  stream_url?: string;
}

export interface MachineLifecycleDeleteTerminalParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Path param
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  terminal_id: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleDeleteTerminalResponse {
  /**
   * @format date-time
   */
  created_at: string;
  /**
   * @format int64
   */
  height: number;
  machine_id: string;
  status: "wake_in_progress" | "ready" | "closed" | "expired" | "failed";
  terminal_id: string;
  /**
   * @format int64
   */
  width: number;
  error_code?: string;
  error_message?: string;
  /**
   * @format date-time
   */
  expires_at?: string;
  protocol?: "websocket";
  /**
   * @format date-time
   */
  ready_at?: string;
  /**
   * @format int64
   */
  retry_after_ms?: number;
  stream_url?: string;
}

export interface MachineLifecycleRetrieveTerminalParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Path param
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  terminal_id: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleRetrieveTerminalResponse {
  /**
   * @format date-time
   */
  created_at: string;
  /**
   * @format int64
   */
  height: number;
  machine_id: string;
  status: "wake_in_progress" | "ready" | "closed" | "expired" | "failed";
  terminal_id: string;
  /**
   * @format int64
   */
  width: number;
  error_code?: string;
  error_message?: string;
  /**
   * @format date-time
   */
  expires_at?: string;
  protocol?: "websocket";
  /**
   * @format date-time
   */
  ready_at?: string;
  /**
   * @format int64
   */
  retry_after_ms?: number;
  stream_url?: string;
}

export interface MachineLifecycleConnectTerminalParams {
  /**
   * Path param: Machine identifier.
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Path param: Terminal identifier.
   * @minLength 1
   * @maxLength 253
   * @pattern ^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$
   */
  terminal_id: string;
  /**
   * Header param: Organization ID header applied to all DCS requests.
   * @format uuid
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleWakeParams {
  /**
   * Path param
   * @minLength 4
   * @maxLength 253
   * @pattern ^dm-[a-z0-9]([a-z0-9-]*[a-z0-9])?$
   */
  machine_id: string;
  /**
   * Header param
   */
  "X-Dedalus-Org-Id"?: string;
}

export interface MachineLifecycleWakeResponse {
  /**
   * Seconds of inactivity before autosleep. 0 disables autosleep.
   * @format int64
   * @minimum 0
   * @maximum 9223372036
   */
  autosleep_seconds: number;
  desired_state: "running" | "sleeping" | "destroyed";
  machine_id: string;
  /**
   * Memory in MiB.
   * @format int64
   */
  memory_mib: number;
  status: MachineLifecycleWakeResponse.Status;
  /**
   * @format int64
   */
  storage_gib: number;
  /**
   * CPU in vCPUs.
   * @format double
   */
  vcpu: number;
}

export namespace MachineLifecycleWakeResponse {
  export interface Status {
    /**
     * @format date-time
     */
    last_progress_at: string;
    /**
     * @format date-time
     */
    last_transition_at: string;
    phase: "accepted" | "placement_pending" | "starting" | "running" | "stopping" | "sleeping" | "destroying" | "destroyed" | "failed";
    reason: string;
    retryable: boolean;
    revision: string;
    last_error?: string;
  }
}
export declare namespace MachineLifecycle {
  export {
    type CreateMachineRequest as CreateMachineRequest,
    type UpdateMachineRequest as UpdateMachineRequest,
    type CreateExecutionRequest as CreateExecutionRequest,
    type CreatePreviewRequest as CreatePreviewRequest,
    type CreateSSHSessionRequest as CreateSSHSessionRequest,
    type CreateTerminalRequest as CreateTerminalRequest,
    type MachineLifecycleListResponse as MachineLifecycleListResponse,
    type MachineLifecycleCreateResponse as MachineLifecycleCreateResponse,
    type MachineLifecycleDeleteResponse as MachineLifecycleDeleteResponse,
    type MachineLifecycleRetrieveResponse as MachineLifecycleRetrieveResponse,
    type MachineLifecyclePatchResponse as MachineLifecyclePatchResponse,
    type MachineLifecycleListArtifactsResponse as MachineLifecycleListArtifactsResponse,
    type MachineLifecycleDeleteArtifactResponse as MachineLifecycleDeleteArtifactResponse,
    type MachineLifecycleRetrieveArtifactResponse as MachineLifecycleRetrieveArtifactResponse,
    type MachineLifecycleListExecutionsResponse as MachineLifecycleListExecutionsResponse,
    type MachineLifecycleCreateExecutionResponse as MachineLifecycleCreateExecutionResponse,
    type MachineLifecycleDeleteExecutionResponse as MachineLifecycleDeleteExecutionResponse,
    type MachineLifecycleRetrieveExecutionResponse as MachineLifecycleRetrieveExecutionResponse,
    type MachineLifecycleListExecutionEventsResponse as MachineLifecycleListExecutionEventsResponse,
    type MachineLifecycleListExecutionOutputResponse as MachineLifecycleListExecutionOutputResponse,
    type MachineLifecycleListPreviewsResponse as MachineLifecycleListPreviewsResponse,
    type MachineLifecycleCreatePreviewResponse as MachineLifecycleCreatePreviewResponse,
    type MachineLifecycleDeletePreviewResponse as MachineLifecycleDeletePreviewResponse,
    type MachineLifecycleRetrievePreviewResponse as MachineLifecycleRetrievePreviewResponse,
    type MachineLifecycleSleepResponse as MachineLifecycleSleepResponse,
    type MachineLifecycleListSSHSessionsResponse as MachineLifecycleListSSHSessionsResponse,
    type MachineLifecycleCreateSSHSessionResponse as MachineLifecycleCreateSSHSessionResponse,
    type MachineLifecycleDeleteSSHSessionResponse as MachineLifecycleDeleteSSHSessionResponse,
    type MachineLifecycleRetrieveSSHSessionResponse as MachineLifecycleRetrieveSSHSessionResponse,
    type MachineLifecycleWatchStatusResponse as MachineLifecycleWatchStatusResponse,
    type MachineLifecycleListTerminalsResponse as MachineLifecycleListTerminalsResponse,
    type MachineLifecycleCreateTerminalResponse as MachineLifecycleCreateTerminalResponse,
    type MachineLifecycleDeleteTerminalResponse as MachineLifecycleDeleteTerminalResponse,
    type MachineLifecycleRetrieveTerminalResponse as MachineLifecycleRetrieveTerminalResponse,
    type MachineLifecycleWakeResponse as MachineLifecycleWakeResponse,
    type MachineLifecycleListParams as MachineLifecycleListParams,
    type MachineLifecycleCreateParams as MachineLifecycleCreateParams,
    type MachineLifecycleDeleteParams as MachineLifecycleDeleteParams,
    type MachineLifecycleRetrieveParams as MachineLifecycleRetrieveParams,
    type MachineLifecyclePatchParams as MachineLifecyclePatchParams,
    type MachineLifecycleListArtifactsParams as MachineLifecycleListArtifactsParams,
    type MachineLifecycleDeleteArtifactParams as MachineLifecycleDeleteArtifactParams,
    type MachineLifecycleRetrieveArtifactParams as MachineLifecycleRetrieveArtifactParams,
    type MachineLifecycleListExecutionsParams as MachineLifecycleListExecutionsParams,
    type MachineLifecycleCreateExecutionParams as MachineLifecycleCreateExecutionParams,
    type MachineLifecycleDeleteExecutionParams as MachineLifecycleDeleteExecutionParams,
    type MachineLifecycleRetrieveExecutionParams as MachineLifecycleRetrieveExecutionParams,
    type MachineLifecycleListExecutionEventsParams as MachineLifecycleListExecutionEventsParams,
    type MachineLifecycleListExecutionOutputParams as MachineLifecycleListExecutionOutputParams,
    type MachineLifecycleListPreviewsParams as MachineLifecycleListPreviewsParams,
    type MachineLifecycleCreatePreviewParams as MachineLifecycleCreatePreviewParams,
    type MachineLifecycleDeletePreviewParams as MachineLifecycleDeletePreviewParams,
    type MachineLifecycleRetrievePreviewParams as MachineLifecycleRetrievePreviewParams,
    type MachineLifecycleSleepParams as MachineLifecycleSleepParams,
    type MachineLifecycleListSSHSessionsParams as MachineLifecycleListSSHSessionsParams,
    type MachineLifecycleCreateSSHSessionParams as MachineLifecycleCreateSSHSessionParams,
    type MachineLifecycleDeleteSSHSessionParams as MachineLifecycleDeleteSSHSessionParams,
    type MachineLifecycleRetrieveSSHSessionParams as MachineLifecycleRetrieveSSHSessionParams,
    type MachineLifecycleWatchStatusParams as MachineLifecycleWatchStatusParams,
    type MachineLifecycleListTerminalsParams as MachineLifecycleListTerminalsParams,
    type MachineLifecycleCreateTerminalParams as MachineLifecycleCreateTerminalParams,
    type MachineLifecycleDeleteTerminalParams as MachineLifecycleDeleteTerminalParams,
    type MachineLifecycleRetrieveTerminalParams as MachineLifecycleRetrieveTerminalParams,
    type MachineLifecycleConnectTerminalParams as MachineLifecycleConnectTerminalParams,
    type MachineLifecycleWakeParams as MachineLifecycleWakeParams,
  };
}
export { MachineLifecycle as MachineLifecycleResource };
