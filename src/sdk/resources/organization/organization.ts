// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { APIResource } from '../../resource';
import { APIPromise } from '../../api-promise';
import type { RequestOptions } from '../../internal/request-options';
import * as AutoresizingAPI from './autoresizing';
import { Autoresizing, type Policy, type AutoresizingUpdateParams } from './autoresizing';

export class Organization extends APIResource {
  autoresizing: AutoresizingAPI.Autoresizing = new AutoresizingAPI.Autoresizing(this._client);
}

Organization.Autoresizing = Autoresizing;

export declare namespace Organization {
  export {
    Autoresizing as Autoresizing,
    type Policy as Policy,
    type AutoresizingUpdateParams as AutoresizingUpdateParams,
  };
}
