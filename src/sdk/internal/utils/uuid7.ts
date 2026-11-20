// File generated from our OpenAPI spec by Scalar. See README.md for details.

/**
 * A time-ordered (version 7) UUID per RFC 9562: a 48-bit Unix millisecond timestamp, then the
 * version and variant bits, with every other bit random.
 */
export const uuid7 = function (): string {
  const { crypto } = globalThis as any;
  const bytes = new Uint8Array(16);
  if (crypto?.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = (Math.random() * 0x100) & 0xff;
  }
  // A clock set before 1970 writes a zero timestamp rather than wrapping to the far future.
  const ms = Math.max(0, Date.now());
  // Bitwise operators work on 32 bits, so the timestamp's top 16 bits are split off arithmetically.
  const high = Math.floor(ms / 0x100000000);
  bytes[0] = (high >>> 8) & 0xff;
  bytes[1] = high & 0xff;
  bytes[2] = (ms >>> 24) & 0xff;
  bytes[3] = (ms >>> 16) & 0xff;
  bytes[4] = (ms >>> 8) & 0xff;
  bytes[5] = ms & 0xff;
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
