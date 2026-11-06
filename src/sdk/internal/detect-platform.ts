// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { VERSION } from '../version';

export const isRunningInBrowser = () => {
  return (
    // @ts-ignore
    typeof window !== 'undefined' &&
    // @ts-ignore
    typeof window.document !== 'undefined' &&
    // @ts-ignore
    typeof navigator !== 'undefined'
  );
};

type DetectedPlatform = 'deno' | 'node' | 'edge' | 'unknown';

/**
 * Note this does not detect 'browser'; for that, use getBrowserInfo().
 */
function getDetectedPlatform(): DetectedPlatform {
  if (typeof Deno !== 'undefined' && Deno.build != null) {
    return 'deno';
  }
  if (typeof EdgeRuntime !== 'undefined') {
    return 'edge';
  }
  if (
    Object.prototype.toString.call(
      typeof (globalThis as any).process !== 'undefined' ? (globalThis as any).process : 0,
    ) === '[object process]'
  ) {
    return 'node';
  }
  return 'unknown';
}

declare const Deno: any;
declare const EdgeRuntime: any;
type Arch = 'x32' | 'x64' | 'arm' | 'arm64' | `other:${string}` | 'unknown';
type PlatformName =
  | 'MacOS'
  | 'Linux'
  | 'Windows'
  | 'FreeBSD'
  | 'OpenBSD'
  | 'iOS'
  | 'Android'
  | `Other:${string}`
  | 'Unknown';
type Browser = 'ie' | 'edge' | 'chrome' | 'firefox' | 'safari';
type PlatformProperties = {
  'X-Scalar-Lang': 'js';
  'X-Scalar-Package-Version': string;
  'X-Scalar-OS': PlatformName;
  'X-Scalar-Arch': Arch;
  'X-Scalar-Runtime': 'node' | 'deno' | 'edge' | `browser:${Browser}` | 'unknown';
  'X-Scalar-Runtime-Version': string;
};
const getPlatformProperties = (): PlatformProperties => {
  const detectedPlatform = getDetectedPlatform();
  if (detectedPlatform === 'deno') {
    return {
      'X-Scalar-Lang': 'js',
      'X-Scalar-Package-Version': VERSION,
      'X-Scalar-OS': normalizePlatform(Deno.build.os),
      'X-Scalar-Arch': normalizeArch(Deno.build.arch),
      'X-Scalar-Runtime': 'deno',
      'X-Scalar-Runtime-Version':
        typeof Deno.version === 'string' ? Deno.version : (Deno.version?.deno ?? 'unknown'),
    };
  }
  if (typeof EdgeRuntime !== 'undefined') {
    return {
      'X-Scalar-Lang': 'js',
      'X-Scalar-Package-Version': VERSION,
      'X-Scalar-OS': 'Unknown',
      'X-Scalar-Arch': `other:${EdgeRuntime}`,
      'X-Scalar-Runtime': 'edge',
      'X-Scalar-Runtime-Version': (globalThis as any).process.version,
    };
  }
  // Check if Node.js
  if (detectedPlatform === 'node') {
    return {
      'X-Scalar-Lang': 'js',
      'X-Scalar-Package-Version': VERSION,
      'X-Scalar-OS': normalizePlatform((globalThis as any).process.platform ?? 'unknown'),
      'X-Scalar-Arch': normalizeArch((globalThis as any).process.arch ?? 'unknown'),
      'X-Scalar-Runtime': 'node',
      'X-Scalar-Runtime-Version': (globalThis as any).process.version ?? 'unknown',
    };
  }

  const browserInfo = getBrowserInfo();
  if (browserInfo) {
    return {
      'X-Scalar-Lang': 'js',
      'X-Scalar-Package-Version': VERSION,
      'X-Scalar-OS': 'Unknown',
      'X-Scalar-Arch': 'unknown',
      'X-Scalar-Runtime': `browser:${browserInfo.browser}`,
      'X-Scalar-Runtime-Version': browserInfo.version,
    };
  }

  // TODO add support for worker runtimes that expose no EdgeRuntime global, etc.
  return {
    'X-Scalar-Lang': 'js',
    'X-Scalar-Package-Version': VERSION,
    'X-Scalar-OS': 'Unknown',
    'X-Scalar-Arch': 'unknown',
    'X-Scalar-Runtime': 'unknown',
    'X-Scalar-Runtime-Version': 'unknown',
  };
};

type BrowserInfo = {
  browser: Browser;
  version: string;
};

declare const navigator: { userAgent: string } | undefined;

/**
 * Reads the browser family and version from `navigator.userAgent`, or returns `null` outside a
 * browser or for an agent it does not recognise.
 *
 * Every major browser also carries the tokens of the engines it grew out of (Edge says `Chrome/` and
 * `Safari/`, Chrome says `Safari/`), so the most specific token is checked first.
 */
function getBrowserInfo(): BrowserInfo | null {
  if (typeof navigator === 'undefined' || !navigator || typeof navigator.userAgent !== 'string') {
    return null;
  }
  const userAgent = navigator.userAgent;
  const tokens = userAgentTokens(userAgent);
  /** Returns the version of the first of `names` the agent carries a token for. */
  const pick = (...names: string[]): string | undefined =>
    names.map((name) => tokens.get(name)).find((version) => version !== undefined);

  const edge = pick('Edg', 'Edge', 'EdgA', 'EdgiOS');
  if (edge) return { browser: 'edge', version: edge };
  // IE 11 dropped `MSIE`; it is told apart by its `Trident/` engine token and an `rv:` version.
  const ie =
    /\bMSIE (\d+(?:\.\d+)*)/.exec(userAgent)?.[1] ??
    (tokens.has('Trident') ? /\brv:(\d+(?:\.\d+)*)/.exec(userAgent)?.[1] : undefined);
  if (ie) return { browser: 'ie', version: ie };
  const firefox = pick('Firefox', 'FxiOS');
  if (firefox) return { browser: 'firefox', version: firefox };
  const chrome = pick('Chrome', 'CriOS', 'HeadlessChrome');
  if (chrome) return { browser: 'chrome', version: chrome };
  // Safari's own version is the `Version/` token; its `Safari/` token is the WebKit build, so an
  // iOS app's web view that carries only `Safari/` is still Safari, at a version it does not state.
  if (tokens.has('Safari')) return { browser: 'safari', version: tokens.get('Version') ?? 'unknown' };
  return null;
}

/**
 * Collects the `Name/1.2.3` product tokens of a user-agent string, keeping the first version seen for
 * each name.
 */
function userAgentTokens(userAgent: string): Map<string, string> {
  const tokens = new Map<string, string>();
  // The lookbehind starts a name only where a run of letters starts, so a long run is scanned once
  // rather than retried from every letter in it.
  for (const match of userAgent.matchAll(/(?<![A-Za-z])([A-Za-z]+)\/(\d+(?:\.\d+)*)/g)) {
    if (!tokens.has(match[1]!)) tokens.set(match[1]!, match[2]!);
  }
  return tokens;
}

const normalizeArch = (arch: string): Arch => {
  // Node docs:
  // - https://nodejs.org/api/process.html#processarch
  // Deno docs:
  // - https://doc.deno.land/deno/stable/~/Deno.build
  if (arch === 'x32') return 'x32';
  if (arch === 'x86_64' || arch === 'x64') return 'x64';
  if (arch === 'arm') return 'arm';
  if (arch === 'aarch64' || arch === 'arm64') return 'arm64';
  if (arch) return `other:${arch}`;
  return 'unknown';
};

const normalizePlatform = (platform: string): PlatformName => {
  // Node platforms:
  // - https://nodejs.org/api/process.html#processplatform
  // Deno platforms:
  // - https://doc.deno.land/deno/stable/~/Deno.build
  // - https://github.com/denoland/deno/issues/14799

  platform = platform.toLowerCase();

  // NOTE: this iOS check is untested and may not work
  // Node does not work natively on IOS, there is a fork at
  // https://github.com/nodejs-mobile/nodejs-mobile
  // however it is unknown at the time of writing how to detect if it is running
  if (platform.includes('ios')) return 'iOS';
  if (platform === 'android') return 'Android';
  if (platform === 'darwin') return 'MacOS';
  if (platform === 'win32') return 'Windows';
  if (platform === 'freebsd') return 'FreeBSD';
  if (platform === 'openbsd') return 'OpenBSD';
  if (platform === 'linux') return 'Linux';
  if (platform) return `Other:${platform}`;
  return 'Unknown';
};

let _platformHeaders: PlatformProperties;
export const getPlatformHeaders = () => {
  return (_platformHeaders ??= getPlatformProperties());
};
