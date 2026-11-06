// File generated from our OpenAPI spec by Scalar. See README.md for details.

import type { Dedalus } from './client';
import type { FinalRequestOptions } from './internal/request-options';
import {
  MAX_RESPONSE_BODY_BYTES,
  readBodyText,
  readUnderDeadline,
  releaseDeadline,
} from './internal/utils/body';

export type APIResponseProps = {
  readonly response: Response;
  readonly options: FinalRequestOptions;
  readonly controller: AbortController;
  readonly requestLogID?: string | undefined;
  readonly retryOfRequestLogID?: string | undefined;
  readonly startTime?: number | undefined;
};

export type ParseResponse<T> = (client: Dedalus, props: APIResponseProps) => T | Promise<T>;

// The read runs under the request deadline, which `makeRequest` left armed for it and which is
// disarmed here once the body is in, however the read ends.
export const defaultParseResponse = async <T>(_client: unknown, props: APIResponseProps): Promise<T> =>
  readUnderDeadline(props, async () => {
    const { response } = props;
    if (response.status === 204) return null as T;
    if (props.options.__binaryResponse) return response as T;
    const contentType = response.headers.get('content-type');
    const mediaType = contentType?.split(';')[0]?.trim();
    const isJson = mediaType?.includes('application/json') || mediaType?.endsWith('+json');
    if (isJson && response.headers.get('content-length') === '0') return undefined as T;
    if (isJson) return JSON.parse(await readBodyText(response, MAX_RESPONSE_BODY_BYTES)) as T;
    return (await readBodyText(response, MAX_RESPONSE_BODY_BYTES)) as unknown as T;
  });

/** A Promise subclass providing SDK response helpers. */
export class APIPromise<T> extends Promise<T> {
  private parsedPromise: Promise<T> | undefined;

  constructor(
    private readonly client: Dedalus,
    private readonly responsePromise: Promise<APIResponseProps>,
    private readonly parseResponse: ParseResponse<T> = defaultParseResponse,
  ) {
    super((resolve) => {
      resolve(undefined as T);
    });
  }

  _thenUnwrap<U>(transform: (data: T, props: APIResponseProps) => U): APIPromise<U> {
    return new APIPromise(this.client, this.responsePromise, async (client, props) =>
      transform(await this.parseResponse(client, props), props),
    );
  }

  asResponse(): Promise<Response> {
    // The caller reads this body at its own pace, so the request deadline stops here.
    return this.responsePromise.then((props) => {
      releaseDeadline(props.controller);
      return props.response;
    });
  }

  async withResponse(): Promise<{ data: T; response: Response }> {
    // Not `asResponse()`, which would disarm the deadline the body parse runs under.
    const [data, response] = await Promise.all([
      this.parse(),
      this.responsePromise.then((props) => props.response),
    ]);
    return { data, response };
  }

  private parse(): Promise<T> {
    if (!this.parsedPromise) {
      this.parsedPromise = this.responsePromise.then((props) => this.parseResponse(this.client, props));
    }
    return this.parsedPromise;
  }

  override then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    return this.parse().then(onfulfilled, onrejected);
  }

  override catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<T | TResult> {
    return this.parse().catch(onrejected);
  }

  override finally(onfinally?: (() => void) | undefined | null): Promise<T> {
    return this.parse().finally(onfinally);
  }
}
