// File generated from our OpenAPI spec by Scalar. See README.md for details.

import type { Dedalus } from './client';

export abstract class APIResource {
  protected _client: Dedalus;

  constructor(client: Dedalus) {
    this._client = client;
  }
}
