// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { spawnSync } from 'node:child_process';

/**
 * One platform's credential helper, as the three commands this needs from it.
 *
 * Every helper is a command-line tool the operating system ships (or, on Windows, a script run
 * through the shell it ships), because the alternative is a native addon: `keytar` and friends are
 * compiled per platform and per Node version, and a generated CLI is meant to stay dependency-free
 * and installable as plain JavaScript.
 */
type KeychainHelper = {
  readonly file: string;
  /** Argv for reading a secret back. The secret is the command's standard output. */
  readonly lookup: (service: string, account: string) => readonly string[];
  /** Argv for writing. The secret never appears here; see {@link HELPERS} for where it travels. */
  readonly store: (service: string, account: string) => readonly string[];
  readonly clear: (service: string, account: string) => readonly string[];
  /**
   * Script fed on standard input, for a helper driven through a shell.
   *
   * A helper with one reads its service, account and secret from the environment, because the shell
   * has already taken standard input for the script.
   */
  readonly script?: (mode: 'lookup' | 'store' | 'clear') => string;
};

/**
 * Absolute path to Windows PowerShell.
 *
 * Never the bare name: on Windows a command name with no separator is resolved against the *current
 * working directory* before `PATH`, so `spawn('powershell', ...)` inside a checked-out repository
 * that happens to contain `powershell.exe` would run that instead — and hand it the secret.
 */
export const windowsPowerShell = (): string =>
  (process.env['SystemRoot'] ?? 'C:\\Windows') + '\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';

/**
 * The secret NEVER travels in argv.
 *
 * A process's command line is readable by other processes — `ps`, `/proc/<pid>/cmdline` — so a
 * credential passed as an argument is exposed to every other program running as that user, and on
 * many systems to other users too.
 *
 * That rule is what decides which platforms are here. `secret-tool store` reads the secret from
 * standard input by design. The Windows helper cannot — `powershell -Command -` reads *all* of
 * standard input as the script to run, leaving nothing for the script itself to read — so its secret
 * goes through the environment instead, which on Windows one process cannot read from another
 * without debug privileges, unlike a command line.
 *
 * macOS is deliberately absent. `security add-generic-password` takes the password only as the
 * argument to `-w`; with no value there it is a usage error, and with a value the secret is in the
 * command line. It has no standard-input form and no interactive mode this can drive safely, so a
 * Mac gets the `0600` file — the same place the widely used CLIs that do not ship a native helper
 * binary keep theirs.
 */
const HELPERS: Readonly<Record<string, KeychainHelper>> = {
  // Linux: the freedesktop Secret Service, which GNOME Keyring and KWallet both implement.
  // A bare command name is safe here: only Windows resolves one against the working directory.
  linux: {
    file: 'secret-tool',
    lookup: (service, account) => ['lookup', 'service', service, 'account', account],
    store: (service, account) => ['store', '--label=' + service, 'service', service, 'account', account],
    clear: (service, account) => ['clear', 'service', service, 'account', account],
  },
  // Windows Credential Manager, through the PasswordVault WinRT API that Windows PowerShell exposes.
  // The script arrives on standard input (`-Command -`) so neither it nor the secret reaches argv.
  win32: {
    file: windowsPowerShell(),
    lookup: () => ['-NoProfile', '-NonInteractive', '-Command', '-'],
    store: () => ['-NoProfile', '-NonInteractive', '-Command', '-'],
    clear: () => ['-NoProfile', '-NonInteractive', '-Command', '-'],
    script: (mode) => windowsScript(mode),
  },
};

/** Whether this platform has a credential helper the CLI can drive at all. */
export const keychainSupported = (): boolean => HELPERS[process.platform] !== undefined;

/**
 * PowerShell for one Credential Manager operation.
 *
 * The service, the account and — for a store — the secret are all read from environment variables
 * rather than pasted into the script, so a base URL can never close a quote and become PowerShell.
 * Standard input is not available for any of them: the shell has already taken it for this script.
 */
const windowsScript = (mode: 'lookup' | 'store' | 'clear'): string => {
  const prelude = [
    '$ErrorActionPreference = "Stop"',
    // Windows PowerShell encodes `[Console]::Out` with the console output code page (an OEM page
    // such as CP850) when stdout is a pipe, while `spawnSync` here decodes it as UTF-8. Without
    // this, a stored credential carrying any non-ASCII character comes back mangled — and a
    // credential that is wrong but still parses is worse than one that fails to, because every
    // command then authenticates with it, and `login` appears to fix it while storing a correct
    // value that is read back wrong again.
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    '[void][Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime]',
    '$vault = New-Object Windows.Security.Credentials.PasswordVault',
    '$svc = $env:SCALAR_KEYCHAIN_SERVICE',
    '$acct = $env:SCALAR_KEYCHAIN_ACCOUNT',
  ];
  if (mode === 'lookup') {
    return [
      ...prelude,
      '$item = $vault.Retrieve($svc, $acct)',
      '$item.RetrievePassword()',
      '[Console]::Out.Write($item.Password)',
    ].join('\n');
  }
  if (mode === 'clear') {
    return [...prelude, '$item = $vault.Retrieve($svc, $acct)', '$vault.Remove($item)'].join('\n');
  }
  return [
    ...prelude,
    '$secret = $env:SCALAR_KEYCHAIN_SECRET',
    'try { $vault.Remove($vault.Retrieve($svc, $acct)) } catch { }',
    '$vault.Add((New-Object Windows.Security.Credentials.PasswordCredential($svc, $acct, $secret)))',
  ].join('\n');
};

/**
 * Reads one secret back, saying which kind of nothing it got when there is no secret.
 *
 * `unavailable` is the distinction a plain lookup cannot make: the helper never ran (missing,
 * timed out, no session bus over ssh) rather than ran and reported no such item. A caller about to
 * *replace* a profile needs it, because merging into the empty result of a failed read and writing
 * that back is how the other credentials under the same key get dropped.
 */
export const keychainRead = (
  service: string,
  account: string,
): { readonly secret?: string; readonly unavailable: boolean } => {
  const result = run('lookup', service, account);
  // `secret-tool` terminates its output with a newline the stored value never had; `security`
  // does the same. Nothing this stores is meant to end in one, so a single trailing newline comes off.
  if (result.ok) return { secret: result.stdout.replace(/\n$/u, ''), unavailable: false };
  return { unavailable: result.unavailable };
};

/** Reads one secret back, or `undefined` when the helper has no such item (or cannot run). */
export const keychainLookup = (service: string, account: string): string | undefined =>
  keychainRead(service, account).secret;

/** Writes one secret, reporting whether the helper accepted it. */
export const keychainStore = (service: string, account: string, secret: string): boolean =>
  run('store', service, account, secret).ok;

/**
 * Removes one secret, reporting whether the helper accepted the removal.
 *
 * A helper asked for an item it does not have reports failure, so callers establish that the item
 * exists first and read this as "the secret is gone" only when it is `true`.
 */
export const keychainClear = (service: string, account: string): boolean => run('clear', service, account).ok;

const run = (
  mode: 'lookup' | 'store' | 'clear',
  service: string,
  account: string,
  secret?: string,
): { readonly ok: boolean; readonly stdout: string; readonly unavailable: boolean } => {
  const helper = HELPERS[process.platform];
  if (!helper) return { ok: false, stdout: '', unavailable: true };
  const script = helper.script?.(mode);
  // A scripted helper consumes the whole of standard input as its script, so its secret travels in
  // the environment beside the service and account; a direct helper takes the secret on stdin.
  const input = script ?? secret ?? '';
  try {
    const result = spawnSync(helper.file, [...helper[mode](service, account)], {
      input,
      encoding: 'utf8',
      // A helper that blocks — a locked keychain putting up a dialog, a Secret Service with no
      // daemon answering — must not hang every command. The timeout turns that into a fallback.
      timeout: 10000,
      env: {
        ...process.env,
        SCALAR_KEYCHAIN_SERVICE: service,
        SCALAR_KEYCHAIN_ACCOUNT: account,
        ...(script !== undefined && secret !== undefined ? { SCALAR_KEYCHAIN_SECRET: secret } : {}),
      },
    });
    // A spawn that reports an `error` never delivered the question — the helper is missing, or the
    // timeout above fired. A non-zero status is the helper answering, which for a lookup or a clear
    // is how every implementation spells "no such item".
    if (result.error) return { ok: false, stdout: '', unavailable: true };
    if (result.status !== 0) return { ok: false, stdout: '', unavailable: false };
    return { ok: true, stdout: result.stdout ?? '', unavailable: false };
  } catch {
    // ENOENT for a helper this machine does not have is the common case, and it is not an error:
    // it is the signal to fall back.
    return { ok: false, stdout: '', unavailable: true };
  }
};
