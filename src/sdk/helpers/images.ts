/** Node image workflows. JSON requests use the SDK; signed uploads never carry SDK credentials. */
import { createHash, randomUUID } from 'node:crypto';
import { open } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Dedalus } from '../client.js';

export interface Image {
  image_id: string;
  state: string;
  [key: string]: unknown;
}
export interface PollOptions {
  /** Total wait limit, in milliseconds. Timing out does not cancel preparation. */
  timeoutMs?: number;
  pollIntervalMs?: number;
  signal?: AbortSignal;
  onProgress?: (image: Image) => void;
}
export interface ImportOptions extends PollOptions {
  /** Wait for readiness by default. False returns after registration. */
  wait?: boolean;
  name?: string;
  platform?: 'linux/amd64';
  idempotencyKey?: string;
  /** Separate storage transport, without the API client's auth headers. */
  uploadFetch?: typeof fetch;
}
export class ImagePreparationError extends Error {
  constructor(
    public readonly image: Image,
    message: string,
  ) {
    super(`Image ${image.image_id}: ${message}`);
    this.name = 'ImagePreparationError';
  }
}
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid image API response');
  return value as Record<string, unknown>;
};
const readImage = (value: unknown, expectedID?: string): Image => {
  const image = record(value);
  if (
    typeof image.image_id !== 'string' ||
    !image.image_id ||
    typeof image.state !== 'string' ||
    !image.state ||
    (expectedID !== undefined && image.image_id !== expectedID)
  ) {
    throw new Error('Invalid or mismatched image API response');
  }
  return { ...image, image_id: image.image_id, state: image.state };
};
const checkFailure = (image: Image): void => {
  if (!['failed', 'rejected', 'revoked'].includes(image.state)) return;
  const error = image.error == null ? {} : record(image.error);
  const message =
    typeof error.message === 'string'
      ? error.message
      : typeof image.reason === 'string'
        ? image.reason
        : image.state;
  const code = typeof error.error_code === 'string' ? `${error.error_code}: ` : '';
  throw new ImagePreparationError(image, `${code}${message}`);
};
const positive = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 86_400_000) {
    throw new Error(`${name} must be an integer between 1 and 86400000 milliseconds`);
  }
  return value;
};
const deadline = (options: PollOptions): AbortSignal => {
  const timeout = AbortSignal.timeout(positive(options.timeoutMs ?? 3_600_000, 'timeoutMs'));
  return options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
};

/** Wait for one image. Unknown states keep polling, bounded by the deadline. */
export async function pollImage(
  client: Dedalus,
  image: string | Image,
  options: PollOptions = {},
): Promise<Image> {
  const id = typeof image === 'string' ? image : image.image_id;
  if (!id || /\s/u.test(id)) throw new Error('image ID must be a nonempty string without whitespace');
  const signal = deadline(options);
  const interval = positive(options.pollIntervalMs ?? 2000, 'pollIntervalMs');
  const retrieve = () => client.get<unknown>(`/v1/images/${encodeURIComponent(id)}`, { signal });
  try {
    signal.throwIfAborted();
    let current = readImage(typeof image === 'string' ? await retrieve() : image, id);
    for (;;) {
      options.onProgress?.(current);
      checkFailure(current);
      if (current.state === 'ready') return current;
      await sleep(interval, undefined, { signal });
      current = readImage(await retrieve(), id);
    }
  } catch (error) {
    if (signal.aborted && signal.reason?.name === 'TimeoutError') {
      throw new ImagePreparationError(
        { image_id: id, state: 'unknown' },
        'Timed out waiting. Preparation continues; use this image ID to resume polling.',
      );
    }
    throw error;
  }
}

/** Upload a docker-save archive, register it, and wait until ready unless wait is false. */
export async function importImage(
  client: Dedalus,
  path: string,
  options: ImportOptions = {},
): Promise<Image> {
  const signal = deadline(options);
  positive(options.pollIntervalMs ?? 2000, 'pollIntervalMs');
  const platform = options.platform ?? 'linux/amd64';
  if (platform !== 'linux/amd64') throw new Error('Custom images currently require linux/amd64');
  const idempotencyKey = options.idempotencyKey ?? randomUUID();
  const file = await open(path, 'r');
  try {
    signal.throwIfAborted();
    const before = await file.stat();
    if (!before.isFile() || before.size <= 0 || before.size > 5 * 1024 ** 3) {
      throw new Error('Image archive must be a regular file between 1 byte and 5 GiB');
    }
    const hash = createHash('sha256');
    let count = 0;
    for await (const chunk of file.createReadStream({
      autoClose: false,
      start: 0,
      end: before.size - 1,
      signal,
    })) {
      hash.update(chunk);
      count += chunk.length;
    }
    const after = await file.stat();
    if (count !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
      throw new Error('Image archive changed while hashing');
    }
    const sha256 = hash.digest('hex');
    const reservation = record(
      await client.post<unknown>('/v1/images/uploads', {
        body: { sha256, size_bytes: before.size, platform },
        signal,
        idempotencyKey,
      }),
    );
    const source = record(reservation.source);
    const upload = record(reservation.upload);
    if (
      source.kind !== 'docker_archive' ||
      source.sha256 !== sha256 ||
      typeof source.upload_id !== 'string' ||
      !source.upload_id ||
      typeof upload.url !== 'string' ||
      upload.method !== 'PUT' ||
      typeof upload.expires_at !== 'string'
    ) {
      throw new Error('Invalid image upload capability');
    }
    let endpoint: URL;
    try {
      endpoint = new URL(upload.url);
    } catch {
      throw new Error('Invalid image upload capability');
    }
    const headers = new Headers();
    for (const [key, values] of Object.entries(record(upload.headers))) {
      if (
        /^(authorization|proxy-authorization|cookie)$/iu.test(key) ||
        !Array.isArray(values) ||
        !values.every((value): value is string => typeof value === 'string')
      ) {
        throw new Error('Invalid image upload headers');
      }
      for (const value of values) headers.append(key, value);
    }
    const expires = Date.parse(upload.expires_at);
    if (
      endpoint.protocol !== 'https:' ||
      endpoint.username ||
      endpoint.password ||
      endpoint.hash ||
      !Number.isFinite(expires) ||
      expires <= Date.now() ||
      headers.get('if-none-match') !== '*' ||
      headers.get('content-length') !== String(before.size) ||
      (headers.get('x-amz-checksum-sha256') ?? endpoint.searchParams.get('X-Amz-Checksum-Sha256')) !==
        Buffer.from(sha256, 'hex').toString('base64')
    ) {
      throw new Error('Invalid image upload capability');
    }
    const body = file.createReadStream({ autoClose: false, start: 0, end: before.size - 1, signal });
    try {
      const response = await (options.uploadFetch ?? fetch)(endpoint, {
        method: 'PUT',
        headers,
        body: body as unknown as BodyInit,
        duplex: 'half',
        redirect: 'error',
        signal,
      } as RequestInit & { duplex: 'half' });
      await response.body?.cancel();
      // The API verifies the existing object after a repeated immutable upload.
      if (!response.ok && response.status !== 412)
        throw new Error(`Image archive upload failed: HTTP ${response.status}`);
    } finally {
      body.destroy();
    }
    const image = readImage(
      await client.post<unknown>('/v1/images', {
        body: { source, platform, ...(options.name === undefined ? {} : { name: options.name }) },
        signal,
        idempotencyKey,
      }),
    );
    if (options.wait === false) {
      options.onProgress?.(image);
      checkFailure(image);
      return image;
    }
    return await pollImage(client, image, { ...options, signal });
  } finally {
    await file.close();
  }
}
