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
  /**
   * Builds the whole of standard input for a helper that reads its command there, secret included.
   *
   * `undefined` refuses the operation before anything is spawned. That is how a request that cannot
   * be written onto the helper's command line exactly — too long, or carrying a character the line
   * cannot hold — fails instead of reaching the helper garbled.
   */
  readonly input?: (
    mode: 'lookup' | 'store' | 'clear',
    service: string,
    account: string,
    secret?: string,
  ) => string | undefined;
  /** Turns what a lookup printed back into the secret, undoing whatever `input` encoded. */
  readonly decode?: (stored: string) => string;
  /**
   * Whether a non-zero exit status is the helper answering "no such item".
   *
   * Without this, every non-zero exit is read that way. A helper that can tell a missing item from a
   * store it could not open says which status is which, so a locked store is not mistaken for an
   * empty one by a caller about to merge into what it read.
   */
  readonly notFound?: (status: number) => boolean;
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
 * macOS's `security add-generic-password` takes the password only as the argument to `-w`, so it is
 * never run with one. `security -i` reads whole commands from standard input instead, and the store
 * goes through that: the secret sits on a line of stdin rather than in any process's argv. See
 * {@link securityStoreCommand} for what that line has to survive.
 */
const HELPERS: Readonly<Record<string, KeychainHelper>> = {
  // Linux: the freedesktop Secret Service, which GNOME Keyring and KWallet both implement.
  // Spawned by bare name only because Linux has no fixed place for it, so whatever comes first on
  // `PATH` answers; Windows and macOS, which do have one, use an absolute path.
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
  // macOS: the user's default keychain, through the `security` tool every Mac ships. Spawned by
  // absolute path, unlike `secret-tool`: a Mac always has it at `/usr/bin/security`, where SIP keeps
  // it Apple's, while a bare name resolves through `PATH` — and Homebrew's user-writable
  // `/opt/homebrew/bin` or a project's `node_modules/.bin` usually sits ahead of `/usr/bin`, so a
  // stray `security` there would be handed the whole profile. It is also the binary the items it
  // writes trust, which is what lets every install read them without a prompt. Only the store runs
  // interactively; a lookup and a clear carry nothing but the service and account, which are no more
  // secret here than on Linux.
  darwin: {
    file: '/usr/bin/security',
    lookup: (service, account) => ['find-generic-password', '-s', service, '-a', account, '-w'],
    store: () => ['-i'],
    clear: (service, account) => ['delete-generic-password', '-s', service, '-a', account],
    input: (mode, service, account, secret) =>
      mode === 'store' && secret !== undefined ? securityStoreCommand(service, account, secret) : '',
    decode: (stored) =>
      stored.startsWith(SECURITY_SECRET_PREFIX)
        ? Buffer.from(stored.slice(SECURITY_SECRET_PREFIX.length), 'base64').toString('utf8')
        : stored,
    // `security` exits with the low byte of the OSStatus it hit, and errSecItemNotFound (-25300)
    // comes out as 44. Anything else — a locked keychain over ssh is errSecInteractionNotAllowed,
    // 36 — means the keychain could not be asked, not that it has nothing under this key.
    notFound: (status) => status === 44,
  },
};

/** Whether this platform has a credential helper the CLI can drive at all. */
export const keychainSupported = (): boolean => HELPERS[process.platform] !== undefined;

/**
 * Marks a secret stored base64-encoded, so a lookup knows to decode it.
 *
 * `security find-generic-password -w` prints a password containing any byte that is not printable
 * ASCII as hex instead, with nothing to say it did. A profile with one non-ASCII character in it
 * would then come back as a hex string — not JSON, so the stored credential would be unreadable.
 * Base64 is printable throughout, so it always comes back exactly as written.
 */
const SECURITY_SECRET_PREFIX = 'base64:';

/**
 * The longest command line `security -i` reads whole, newline included.
 *
 * It reads each line into a 4096-byte buffer, and a line that does not fit is not rejected: the
 * rest is read as the *next* command. Staying well inside the buffer is the only safe answer, and a
 * profile that cannot fit fails the store, which `auto` turns into the file.
 */
const SECURITY_LINE_LIMIT = 4000;

/**
 * Quotes one argument for `security -i`.
 *
 * Its line parser is not a shell. Inside double quotes a backslash escapes the next character and
 * the closing quote ends the argument, and nothing else is special — no variables, no globbing, and
 * no joining of adjacent quoted pieces, so the shell trick of `'...'"'"'...'` would split one
 * argument into three. Escaping every backslash and double quote is therefore complete.
 */
const securityQuote = (value: string): string => '"' + value.replace(/[\\"]/gu, '\\$&') + '"';

/**
 * The single `add-generic-password` line that stores one secret through `security -i`.
 *
 * `-U` updates an existing item in place, so signing in again replaces the credential rather than
 * failing on a duplicate. The service and account are quoted rather than encoded, so the item reads
 * the same in Keychain Access as the lookup and clear that address it in argv. A control character
 * in either is refused: a newline would end the command early and start another, and a NUL ends the
 * argument where C reads it. The base URL key never carries one in practice; refusing it keeps a
 * hostile `--base-url` from writing a second command.
 */
const securityStoreCommand = (service: string, account: string, secret: string): string | undefined => {
  if (/[\u0000-\u001f\u007f]/u.test(service + account)) return undefined;
  const encoded = SECURITY_SECRET_PREFIX + Buffer.from(secret, 'utf8').toString('base64');
  const line =
    [
      'add-generic-password',
      '-U',
      '-s',
      securityQuote(service),
      '-a',
      securityQuote(account),
      '-w',
      securityQuote(encoded),
    ].join(' ') + '\n';
  return Buffer.byteLength(line, 'utf8') <= SECURITY_LINE_LIMIT ? line : undefined;
};

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
  if (!result.ok) return { unavailable: result.unavailable };
  const stored = result.stdout.replace(/\n$/u, '');
  const decode = HELPERS[process.platform]?.decode;
  return { secret: decode ? decode(stored) : stored, unavailable: false };
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
  // the environment beside the service and account; a direct helper takes the secret on stdin, and
  // an interactive one takes it inside the command it reads there.
  const input = helper.input ? helper.input(mode, service, account, secret) : (script ?? secret ?? '');
  if (input === undefined) return { ok: false, stdout: '', unavailable: false };
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
    // is how every implementation spells "no such item" — and, for a helper that also has a status
    // for "could not open the store", only that one status means it.
    if (result.error) return { ok: false, stdout: '', unavailable: true };
    if (result.status !== 0) {
      const unavailable = helper.notFound !== undefined && !helper.notFound(result.status ?? -1);
      return { ok: false, stdout: '', unavailable };
    }
    return { ok: true, stdout: result.stdout ?? '', unavailable: false };
  } catch {
    // ENOENT for a helper this machine does not have is the common case, and it is not an error:
    // it is the signal to fall back.
    return { ok: false, stdout: '', unavailable: true };
  }
};
