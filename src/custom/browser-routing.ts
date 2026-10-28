/** Restricts browser credentials before the CLI constructs an API client. */

import { UsageError } from '../cli/login.js';

const API = 'https://dcs.dedaluslabs.ai';

/** Names the API-key credential that competes with a browser token, so the user knows what to unset. */
const competingAPIKey = (options: Record<string, unknown>): string | undefined => {
  if (options['apiKey'] || process.env['DEDALUS_API_KEY']?.trim()) return '--api-key or DEDALUS_API_KEY';
  if (options['xAPIKey'] || process.env['DEDALUS_X_API_KEY']?.trim()) return '--x-api-key or DEDALUS_X_API_KEY';
  return undefined;
};

/** Keeps browser tokens on their production API and rejects competing credentials. */
export const routeBrowserCredential = (
  options: Record<string, unknown>,
): Record<string, unknown> => {
  const browserToken = options['browserToken'] ?? process.env['DEDALUS_BROWSER_TOKEN']?.trim();
  if (!browserToken) return options;
  const apiKey = competingAPIKey(options);
  if (apiKey) {
    throw new UsageError(`Use browser sign-in or an API key (${apiKey}), not both.`);
  }
  const source = options['baseURL'] !== undefined ? '--base-url' : 'DEDALUS_BASE_URL';
  const endpoint = options['baseURL'] ?? (process.env['DEDALUS_BASE_URL']?.trim() || API);
  if (endpoint !== API && endpoint !== API + '/') {
    throw new UsageError(
      `Browser sign-in only works with the production DCS API (${API}), but ${source} is ${endpoint}. ` +
        `Unset ${source}, or use an API key.`,
    );
  }
  if (options['environment'] !== undefined && options['environment'] !== 'production') {
    throw new UsageError('Production browser credentials require the production environment.');
  }
  return { ...options, browserToken, baseURL: API };
};
