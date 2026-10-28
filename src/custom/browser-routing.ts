/** Restricts browser credentials before the CLI constructs an API client. */

import { UsageError } from '../cli/login.js';

const API = 'https://dcs.dedaluslabs.ai';

/** Keeps browser tokens on their production API and rejects competing credentials. */
export const routeBrowserCredential = (
  options: Record<string, unknown>,
): Record<string, unknown> => {
  const browserToken = options['browserToken'] ?? process.env['DEDALUS_BROWSER_TOKEN']?.trim();
  if (!browserToken) return options;
  if (options['apiKey'] || options['xAPIKey'] ||
    process.env['DEDALUS_API_KEY']?.trim() || process.env['DEDALUS_X_API_KEY']?.trim()) {
    throw new UsageError('Choose browser authentication or an API key, not both.');
  }
  const endpoint = options['baseURL'] ?? (process.env['DEDALUS_BASE_URL']?.trim() || API);
  if (endpoint !== API && endpoint !== API + '/') {
    throw new UsageError('Production browser credentials can only be used with the production DCS API.');
  }
  if (options['environment'] !== undefined && options['environment'] !== 'production') {
    throw new UsageError('Production browser credentials require the production environment.');
  }
  return { ...options, browserToken, baseURL: API };
};
