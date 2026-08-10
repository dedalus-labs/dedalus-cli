// File generated from our OpenAPI spec by Scalar. See README.md for details.

export { Dedalus as default } from './client.js';

export { type Uploadable, toFile } from './core/uploads';
export { APIPromise } from './api-promise';
export { type RawWebSocketData, type ReconnectingEvent, type ReconnectingOverrides, type UnsentMessage } from './internal/ws';
export { Dedalus, type ClientOptions, type DedalusOptions, type Logger, type LogLevel } from './client.js';
export {
  DedalusError,
  APIError,
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  BadRequestError,
  AuthenticationError,
  InternalServerError,
  PermissionDeniedError,
  UnprocessableEntityError,
} from './error';
