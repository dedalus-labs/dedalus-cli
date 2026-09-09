// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { defaultParseResponse } from '../internal/parse';
import { APIPromise } from './api-promise';
import { type APIResponseProps } from '../internal/parse';
import type { Dedalus } from '../client';
import { DedalusError } from './error';
import type { FinalRequestOptions } from '../internal/request-options';
import { maybeObj } from '../internal/utils/values';

export type PageRequestOptions = Pick<FinalRequestOptions, 'query' | 'headers' | 'body' | 'path' | 'method'>;

export abstract class AbstractPage<Item> implements AsyncIterable<Item> {
  protected readonly client: Dedalus;
  protected readonly options: FinalRequestOptions;
  protected readonly response: Response;
  protected readonly body: unknown;

  constructor(client: Dedalus, response: Response, body: unknown, options: FinalRequestOptions) {
    this.client = client;
    this.response = response;
    this.body = body;
    // An idempotency key belongs to the one request it was sent with. A page only ever uses these
    // options to build the *next* request, so the key is dropped here and each page gets its own.
    const { idempotencyKey: _idempotencyKey, ...pageOptions } = options;
    this.options = pageOptions;
  }

  abstract nextPageRequestOptions(): PageRequestOptions | null;
  abstract getPaginatedItems(): readonly Item[];

  hasNextPage(): boolean {
    const items = this.getPaginatedItems();
    if (!items.length) return false;
    return this.nextPageRequestOptions() !== null;
  }

  async getNextPage(): Promise<this> {
    const nextOptions = this.nextPageRequestOptions();
    if (!nextOptions)
      throw new DedalusError(
        'No next page expected; please check `.hasNextPage()` before calling `.getNextPage()`.',
      );
    return await this.client.requestAPIList(this.constructor as PageConstructor<this, Item>, nextOptions);
  }

  async *iterPages(): AsyncGenerator<this> {
    let page: this = this;
    yield page;
    while (page.hasNextPage()) {
      page = await page.getNextPage();
      yield page;
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<Item> {
    for await (const page of this.iterPages()) {
      for (const item of page.getPaginatedItems()) yield item;
    }
  }
}

export type PageConstructor<Page extends AbstractPage<Item>, Item> = new (
  client: Dedalus,
  response: Response,
  body: unknown,
  options: FinalRequestOptions,
) => Page;

export class PagePromise<
    Page extends AbstractPage<Item>,
    Item = ReturnType<Page['getPaginatedItems']>[number],
  >
  extends APIPromise<Page>
  implements AsyncIterable<Item>
{
  constructor(client: Dedalus, request: Promise<APIResponseProps>, Page: PageConstructor<Page, Item>) {
    super(
      client,
      request,
      async (client, props) =>
        new Page(client, props.response, await defaultParseResponse(client, props), props.options),
    );
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<Item> {
    const page = await this;
    for await (const item of page) yield item;
  }
}

export interface CursorPageParams {
  cursor?: string;

  limit?: number;
}

export interface CursorPageResponse<Item> {
  items: Array<Item>;
  next_cursor: string | null;
}

export class CursorPage<Item> extends AbstractPage<Item> implements CursorPageResponse<Item> {
  items: Array<Item>;

  next_cursor: string | null;

  constructor(client: Dedalus, response: Response, body: unknown, options: FinalRequestOptions) {
    super(client, response, body, options);
    const parsed = body as CursorPageResponse<Item>;

    this.items = parsed.items || [];
    this.next_cursor = parsed.next_cursor ?? null;
  }

  getPaginatedItems(): Item[] {
    const items = this.items;
    return Array.isArray(items) ? items : [];
  }

  nextPageRequestOptions(): PageRequestOptions | null {
    const cursor = this.next_cursor;
    if (!hasNextCursor(cursor)) {
      return null;
    }

    return {
      ...this.options,
      query: {
        ...maybeObj(this.options.query),
        cursor: cursor,
      },
    };
  }
}

const hasNextCursor = (cursor: unknown): boolean => {
  if (typeof cursor === 'string') return cursor.length > 0;
  if (typeof cursor === 'number') return Number.isFinite(cursor);
  return false;
};
