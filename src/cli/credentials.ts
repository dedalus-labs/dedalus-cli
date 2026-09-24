// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { randomBytes } from 'node:crypto';
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { keychainClear, keychainLookup, keychainRead, keychainStore, keychainSupported } from './keychain';

/** Where the credential store lives. Every field comes from the generated auth definition. */
export type CredentialStoreLocation = {
  readonly storeName: string;
  readonly storeEnv: string;
  /**
   * Which store to use: the operating system's, a file, or the OS one with a file fallback.
   *
   * Resolved per call rather than once at module load so a test can point one command at a scratch
   * file without the process having already decided.
   */
  readonly backend: 'auto' | 'keychain' | 'file';
};

/** Refresh metadata kept beside a stored OAuth access token. */
export type StoredOAuth = {
  readonly refreshToken?: string;
  /** Unix epoch milliseconds the access token stops being usable, when the server said so. */
  readonly expiresAt?: number;
  /** The endpoint a new access token is requested from. */
  readonly refreshUrl?: string;
  /** Legacy refresh endpoint field emitted before `refreshUrl` was kept separately. */
  readonly tokenUrl?: string;
  readonly clientId?: string;
};

/** Credentials stored for one base URL, keyed by client-option name. */
export type StoredProfile = {
  readonly credentials?: Record<string, string>;
  readonly oauth?: Record<string, StoredOAuth>;
  /**
   * Which store actually holds this profile's secret.
   *
   * Only ever set on the *file* entry, which is why it can be trusted: it is written by the same
   * operation that placed the secret, so nothing later has to infer where it went. Inferring it from
   * a lookup cannot work — a helper that is not running and a helper reporting "no such item" are
   * the same answer, and reading the first as the second is how a `logout` comes to report success
   * over a credential that is still live.
   *
   * Absent means the file, which is all a store written before the OS backend existed can hold.
   */
  readonly backend?: StoreBackend;
};

export type CredentialStoreFile = {
  readonly version: number;
  readonly profiles: Record<string, StoredProfile>;
};

const STORE_VERSION = 1;

const EMPTY_STORE: CredentialStoreFile = { version: STORE_VERSION, profiles: {} };

// A generated CLI can be invoked by two shells at once. The short synchronous critical sections
// below need a cross-process lock, not an in-memory mutex that only coordinates one invocation.
const lockPause = new Int32Array(new SharedArrayBuffer(4));
const STORE_LOCK_STALE_MS = 30_000;
// Consecutive filesystem errors while taking the lock before the attempt is abandoned. A lost race
// produces one; a path the filesystem will not answer for produces them without end.
const STORE_LOCK_MAX_ERRORS = 100;

/**
 * The store file path.
 *
 * The environment override wins outright so a credential can be pointed at a scratch file (a test
 * harness, a container with no writable home) without touching the real one.
 */
export const storePath = (location: CredentialStoreLocation): string => {
  const override = process.env[location.storeEnv];
  if (override) return override;
  return join(stateDirectory(), location.storeName, 'credentials.json');
};

// Per-user state, not config: the file holds tokens the CLI rewrites on its own (a refreshed access
// token) rather than settings a user edits, which is exactly what XDG_STATE_HOME is for.
const stateDirectory = (): string => {
  if (process.platform === 'win32') return process.env['APPDATA'] || join(homedir(), 'AppData', 'Roaming');
  return process.env['XDG_STATE_HOME'] || join(homedir(), '.local', 'state');
};

/**
 * Reads the whole store, treating anything unreadable as empty.
 *
 * A missing file is the normal first-run case, and a corrupt one must not wedge every command in
 * the CLI: the worst outcome of ignoring it is one `login` the user has to run again, whereas
 * throwing would take out commands that were never going to need a stored credential at all.
 */
export const readStore = (location: CredentialStoreLocation): CredentialStoreFile => {
  let text: string;
  try {
    text = readFileSync(storePath(location), 'utf8');
  } catch {
    return EMPTY_STORE;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') return EMPTY_STORE;
    const profiles = (parsed as { profiles?: unknown }).profiles;
    if (!profiles || typeof profiles !== 'object') return EMPTY_STORE;
    return { version: STORE_VERSION, profiles: profiles as Record<string, StoredProfile> };
  } catch {
    return EMPTY_STORE;
  }
};

/**
 * Replaces the store file.
 *
 * Written to a sibling temp file and renamed so an interrupted write cannot leave a truncated store
 * behind; the rename carries the temp file's narrow permissions onto the final path.
 */
export const writeStore = (location: CredentialStoreLocation, store: CredentialStoreFile): void => {
  assertLockHeld(location);
  const path = storePath(location);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  // `wx` and a random suffix together, not `writeFileSync` with a mode. That call applies the mode
  // only when it creates the file and follows a symlink when it does not, so a predictable temp name
  // — the pid was the only variable — let anyone who could write this directory pre-create the path
  // and be handed the credentials, or leave it `0644` and read them in the window before a chmod.
  // Creating it exclusively fails instead, and the descriptor is what is written, so there is no
  // second lookup of the name between the check and the write.
  const temp = path + '.' + randomBytes(8).toString('hex') + '.tmp';
  const descriptor = openSync(temp, 'wx', 0o600);
  try {
    writeFileSync(descriptor, JSON.stringify(store, null, 2) + '\n');
  } finally {
    closeSync(descriptor);
  }
  try {
    renameSync(temp, path);
  } catch (error) {
    // The rename is what publishes the store; a temp file left behind after it failed is a copy of
    // the credentials under a name nothing will ever read again.
    rmSync(temp, { force: true });
    throw error;
  }
};

/** Deletes the store file entirely. */
export const deleteStore = (location: CredentialStoreLocation): void => {
  assertLockHeld(location);
  rmSync(storePath(location), { force: true });
};

/**
 * Serializes index rewrites across CLI processes.
 *
 * Token acquisition happens before the lock. The lock spans the keychain operation and its index
 * update together, so a concurrent logout cannot clear a newly written secret while it still sees
 * the old index entry. Long-running keychain helpers renew the lock lease before each command.
 */
const withStoreLock = <T>(location: CredentialStoreLocation, operation: () => T): T => {
  const path = storePath(location);
  const lockPath = path + '.lock';
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  // Written into the lock file and checked back on release. A lock this process was too slow to
  // renew can be reclaimed as stale by another one, and after that it is no longer this process's
  // to delete: unlinking it on the way out would drop the new holder's lock and leave two processes
  // rewriting the store at once, where `writeStore` replaces the file wholesale and one of the two
  // profiles is simply lost.
  const token = randomBytes(16).toString('hex');
  let descriptor: number | undefined;
  let consecutiveErrors = 0;
  while (descriptor === undefined) {
    try {
      descriptor = openSync(lockPath, 'wx', 0o600);
      try {
        writeFileSync(descriptor, token);
      } catch (error) {
        // An unstamped lock is worse than none: this process is about to throw, its release will
        // never run, and every other CLI would wait out the full stale window on a file nobody
        // holds. Take it back out first.
        closeSync(descriptor);
        // And give the handle back, so the loop guard still reads "not acquired". Leaving it set
        // would let an error the outer catch decided to swallow fall out of the loop and run the
        // operation with no lock at all, then close this handle a second time on the way out.
        descriptor = undefined;
        rmSync(lockPath, { force: true });
        throw error;
      }
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error;
      try {
        const stale = statSync(lockPath);
        if (Date.now() - stale.mtimeMs > STORE_LOCK_STALE_MS) {
          // Moved aside rather than unlinked outright, and only then removed. An unconditional
          // `rmSync` deletes whatever is at the path *now*, which after a pause between the stat
          // and the call is a fresh lock a waiter has just taken — two processes in the critical
          // section. `renameSync` moves one specific directory entry, so re-checking the inode and
          // mtime afterwards establishes that what moved is the file that was found stale; anything
          // else is put straight back.
          const salvage = lockPath + '.' + token;
          renameSync(lockPath, salvage);
          const moved = statSync(salvage);
          if (moved.ino === stale.ino && moved.mtimeMs === stale.mtimeMs) rmSync(salvage, { force: true });
          else renameSync(salvage, lockPath);
        }
        consecutiveErrors = 0;
      } catch {
        // Either the lock was released or reclaimed between the open and the stat — the benign race,
        // which the next attempt wins — or the filesystem will not answer for this path at all, which
        // retrying never fixes. Only a run of them means the second, so only a run gives up.
        consecutiveErrors += 1;
        if (consecutiveErrors > STORE_LOCK_MAX_ERRORS) {
          throw new Error('Could not take the credential store lock at ' + lockPath + '.');
        }
      }
      // Every path waits, including the two that used to loop straight back to `openSync`. Without
      // this a lock that cannot be stat'd or unlinked spins open+stat at full tilt with nothing on
      // screen — usually for a token refresh the user never asked to watch.
      Atomics.wait(lockPause, 0, 0, 10);
    }
  }
  const previous = heldLock;
  heldLock = { path: lockPath, token };
  try {
    return operation();
  } finally {
    heldLock = previous;
    closeSync(descriptor);
    try {
      // Only this acquisition's own lock comes off; see `token` above.
      if (readFileSync(lockPath, 'utf8') === token) rmSync(lockPath, { force: true });
    } catch {
      // Already gone, which is the outcome this wanted anyway.
    }
  }
};

/** The lock this process currently holds, for {@link assertLockHeld} to check a write against. */
let heldLock: { readonly path: string; readonly token: string } | undefined;

/**
 * Refuses a store rewrite this process no longer holds the lock for.
 *
 * Taking the lock is not the same as still having it. A holder stopped long enough to pass
 * `STORE_LOCK_STALE_MS` — a suspended laptop, a SIGSTOP, a filesystem that blocked — has its lock
 * reclaimed and another process completes a whole read-modify-write; if the first then resumes and
 * writes the snapshot it read beforehand, the second's profile is gone, and under the keychain
 * backend its index entry was the only record of a live keyring item. `writeStore` replaces the
 * file wholesale, so there is no merge to save it. Checking the stamp again here is what makes the
 * window survivable: the late writer fails loudly instead of quietly winning.
 */
const assertLockHeld = (location: CredentialStoreLocation): void => {
  const lock = heldLock;
  if (!lock || lock.path !== storePath(location) + '.lock') return;
  let stamp: string;
  try {
    stamp = readFileSync(lock.path, 'utf8');
  } catch {
    stamp = '';
  }
  if (stamp !== lock.token) {
    throw new Error(
      'The credential store changed underneath this command. Nothing was written; run it again.',
    );
  }
};

/** Renews a held lock before a keychain helper can spend up to ten seconds waiting for the OS. */
const refreshStoreLock = (location: CredentialStoreLocation): void => {
  const now = new Date();
  try {
    utimesSync(storePath(location) + '.lock', now, now);
  } catch {
    // The lock holder may already be unwinding after an interrupted filesystem operation.
  }
};

/**
 * The key one base URL's credentials are filed under.
 *
 * Keying on the URL is what keeps a sandbox token from being sent to production: a request with a
 * different `--base-url` looks up a different profile and simply finds nothing.
 */
export const profileKey = (baseUrl: string): string => {
  const trimmed = baseUrl.replace(/\/+$/u, '');
  if (!trimmed) return 'default';
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    // Not a URL this can take apart — an unusual `--base-url`, or the `default` case above. Keyed
    // verbatim, which still files it consistently; it simply gets none of the normalization below.
    return trimmed;
  }
  // Credentials never belong in the key. A `--base-url https://user:pass@host` would otherwise put
  // them in the keychain account, which the Linux helper passes on its command line for any other
  // process to read — the one thing this whole module is arranged to prevent.
  url.username = '';
  url.password = '';
  // `URL` lower-cases the host and drops a port that is the scheme's default, so two spellings of
  // one host cannot end up as two profiles — a `login` under one and a request under the other
  // would look, to the user, like the sign-in simply had not taken.
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/+$/u, '');
};

/** Where a profile's secrets actually live. */
export type StoreBackend = 'keychain' | 'file';

/**
 * Whether this run may use the operating system's store at all.
 *
 * Nothing is probed here. Under `auto` the real operation decides: a keychain write that fails
 * falls back to the file, and a keychain read that finds nothing falls through to it. That is both
 * cheaper than a probe — which costs three subprocess spawns on every command — and more honest,
 * since the thing that has to work is the operation itself, not a proxy for it.
 */
const mayUseKeychain = (location: CredentialStoreLocation): boolean => location.backend !== 'file';

/** Human-readable name for where a credential landed, for `login` and `logout` to print. */
export const storeDescription = (location: CredentialStoreLocation, backend: StoreBackend): string =>
  backend === 'keychain'
    ? 'your ' + osStoreName() + ' (the index of signed-in hosts is at ' + storePath(location) + ')'
    : storePath(location);

const osStoreName = (): string => {
  if (process.platform === 'win32') return 'Windows Credential Manager';
  return 'system keyring';
};

/**
 * One stored profile.
 *
 * When the secret is in the OS store the file holds only the *index* — which base URLs are signed
 * in, and for each one which store has it. That split is what makes `logout --all` possible: a
 * keychain offers no portable way to list what is in it, so the set of profiles has to be recorded
 * somewhere, and a list of hostnames is not a secret.
 *
 * The index also decides where to look, rather than the OS store being tried first and the file
 * second. Trying in turn cannot tell an unreachable helper from an empty one, so it would answer
 * with a file copy while a different, live secret sat in the OS store.
 */
export const readProfile = (location: CredentialStoreLocation, key: string): StoredProfile =>
  readProfileResult(location, key).profile;

/**
 * A profile read, and whether the store actually answered.
 *
 * `unreadable` says the marker points at the OS store and the helper never answered, so the empty
 * profile beside it is the absence of an answer rather than the answer "nothing is stored". A read
 * can treat the two alike — both send the user to `login` — but a write cannot: merging an update
 * into an empty profile and storing the result replaces whatever was really under that key, so a
 * keyring that is momentarily unreachable would cost the user every *other* credential filed there.
 */
const readProfileResult = (
  location: CredentialStoreLocation,
  key: string,
): { readonly profile: StoredProfile; readonly unreadable: boolean } => {
  const entry = indexEntry(location, key);
  if (entry.backend !== 'keychain') {
    // `keychain` exists to keep secrets out of a file, so one an earlier build left there is not a
    // credential this may send — an organisation that chose the setting to forbid secrets at rest
    // would otherwise keep authenticating from exactly the file it banned. It is left where it is
    // rather than deleted, because a read is not the place to destroy anything; the next `login`
    // replaces it.
    return { profile: location.backend === 'keychain' ? {} : entry, unreadable: false };
  }
  // Nothing falls through to the file: the index says the secret is not there. A helper that cannot
  // run reads as "no credential", which sends the user to `login` rather than to a stale one — but
  // it is reported alongside, so a *write* can refuse rather than overwrite what it could not see.
  if (!mayUseKeychain(location)) {
    // The configured backend is the file while the marker still says keychain. Replacing the entry
    // is the intended migration here, not a loss, so this is not unreadable.
    return { profile: {}, unreadable: false };
  }
  const read = keychainRead(location.storeName, key);
  if (read.secret === undefined) return { profile: {}, unreadable: read.unavailable };
  try {
    const parsed: unknown = JSON.parse(read.secret);
    if (parsed && typeof parsed === 'object') return { profile: parsed as StoredProfile, unreadable: false };
  } catch {
    // An item this cannot parse is treated as absent, for the same reason a corrupt file is: one
    // `login` again beats taking out every command that needed no credential.
  }
  return { profile: {}, unreadable: false };
};

/** The file entry for one profile: the credential itself, or the marker saying where it really is. */
const indexEntry = (location: CredentialStoreLocation, key: string): StoredProfile => {
  const { profiles } = readStore(location);
  // Own-property lookup only: a store carrying a key like `constructor` would otherwise resolve to
  // something off `Object.prototype` that is not a profile at all.
  if (!Object.prototype.hasOwnProperty.call(profiles, key)) return {};
  const profile = profiles[key];
  return profile && typeof profile === 'object' ? profile : {};
};

/** Merges an update into one stored profile under the transaction lock, reporting where it landed. */
export const writeProfile = (
  location: CredentialStoreLocation,
  key: string,
  update: StoredProfile,
): StoreBackend =>
  // The keychain write and the index write are one transaction. Locking only the file rewrite leaves
  // a logout able to clear a newly stored secret while still reading the index entry that predates
  // it, so both go inside the same lock.
  withStoreLock(location, () => writeProfileLocked(location, key, update));

/**
 * Merges a refreshed token into a profile that is still signed in, and does nothing when it is not.
 *
 * The silent refresh runs on the request path of an ordinary command: it reads the profile, spends a
 * network round trip on the exchange, and only then writes the result back. A `logout` in another
 * shell fits comfortably inside that window. Writing unconditionally there would file a freshly
 * issued credential under a host the user has just signed out of — and under the keychain backend
 * that means planting a new secret in their keyring *after* a sign-out that reported success, with
 * an index entry to match. The lock serializes the two writes; this is what makes the later one
 * conditional on what the earlier one left behind.
 */
export const refreshProfile = (
  location: CredentialStoreLocation,
  key: string,
  update: StoredProfile,
): void => {
  withStoreLock(location, () => {
    if (!Object.prototype.hasOwnProperty.call(readStore(location).profiles, key)) return;
    // A refresh is preparation for a command, not the command, so a store that cannot be read is a
    // reason to leave the credential where it is rather than to fail what the user asked for. The
    // write below would refuse anyway; catching it here keeps that refusal off the request path.
    if (readProfileResult(location, key).unreadable) return;
    writeProfileLocked(location, key, update);
  });
};

/** The body of a profile write, for the callers above that have already taken the store lock. */
const writeProfileLocked = (
  location: CredentialStoreLocation,
  key: string,
  update: StoredProfile,
): StoreBackend => {
  const marker = indexEntry(location, key);
  // Merging only after acquiring the lock preserves credentials captured by another flow while
  // this flow was waiting to save its own result.
  if (marker.backend === 'keychain') refreshStoreLock(location);
  const existing = readProfileResult(location, key);
  // Refused rather than merged into nothing. The write below replaces the whole profile, so going
  // ahead on a read that never answered would file this one credential over however many were
  // already there — silently, on a keyring hiccup no louder than a daemon restart.
  if (existing.unreadable) {
    throw new Error(
      'Could not read the credentials already saved for this host from your ' +
        osStoreName() +
        '. Nothing was written. Try again, or run logout for this host first.',
    );
  }
  const profile = mergeProfile(existing.profile, update);
  if (mayUseKeychain(location)) {
    refreshStoreLock(location);
    if (keychainStore(location.storeName, key, JSON.stringify(withoutMarker(profile)))) {
      try {
        // The file records only that this base URL is signed in and which store has it — no secret
        // — so `logout --all` can find it without one ever reaching disk.
        writeIndex(location, key, { backend: 'keychain' });
      } catch (error) {
        // The secret reached the OS store but nothing on disk points at it, and the index is the
        // only thing `logout --all` can enumerate. Take it back out rather than leaving a
        // credential in the user's keyring that this CLI can neither find nor remove — but only
        // when this write is what put it there. `keychainStore` overwrites, so if the store was
        // already holding this key the item here is the user's working credential, and clearing it
        // would destroy the very thing the failed sign-in was meant to replace.
        if (marker.backend !== 'keychain') {
          refreshStoreLock(location);
          keychainClear(location.storeName, key);
        }
        throw error;
      }
      return 'keychain';
    }
    if (location.backend === 'keychain') {
      throw new Error(
        keychainSupported()
          ? 'Could not save the credential to your ' + osStoreName() + '.'
          : 'This system has no credential store ' + location.storeName + ' can use.',
      );
    }
  }
  // Whatever this key already had in the OS store comes out before the file takes over, so the two
  // cannot disagree. Only the marker decides what a later read uses, so an item left behind can no
  // longer shadow this one — which is why a helper that will not answer is not worth failing the
  // sign-in over. It is reported instead: wedging `login` would leave the user no way forward at
  // all, since `logout` would be refusing for exactly the same reason.
  if (marker.backend === 'keychain' && removeSecret(location, key) !== 'removed') {
    warn(
      'Your ' + osStoreName() + ' may still hold an older credential for this host; remove it there if so.',
    );
  }
  writeIndex(location, key, { ...withoutMarker(profile), backend: 'file' });
  return 'file';
};

const warnings: string[] = [];

/**
 * Notes something the user should know without failing what they asked for.
 *
 * Collected rather than printed. The same store code runs under `login` and under the silent token
 * refresh that precedes an ordinary command, and writing to standard error there would interleave
 * prose with the JSON document `--format-error json` puts on that same stream. Only `login` and
 * `logout` drain this, so a warning reaches the one place a user is already reading sentences.
 */
const warn = (message: string): void => {
  if (!warnings.includes(message)) warnings.push(message);
};

/** Takes the warnings collected so far, leaving none behind. */
export const takeWarnings = (): readonly string[] => warnings.splice(0, warnings.length);

/**
 * Takes one secret out of the OS store, reporting what could be established.
 *
 * `keychainClear` answers `false` both for an item that is not there and for a helper that cannot
 * run, so its word alone is never enough. A lookup afterwards settles the only question that
 * matters: `kept` means the secret is still retrievable, and so removing the index entry would be a
 * lie. Anything else means this CLI can no longer get at it, which is what being signed out is —
 * `unconfirmed` says so while admitting the store may still hold something, because a helper that
 * could not run cannot prove otherwise.
 *
 * Nothing here throws. Earlier versions failed the command when a clear did not succeed, which
 * wedged `login` and `logout` together for anyone whose item had simply been removed by hand or
 * whose helper had gone: both refused, and nothing the CLI offered could ever clear the entry.
 */
const removeSecret = (location: CredentialStoreLocation, key: string): 'removed' | 'unconfirmed' | 'kept' => {
  refreshStoreLock(location);
  if (keychainClear(location.storeName, key)) return 'removed';
  refreshStoreLock(location);
  return keychainLookup(location.storeName, key) === undefined ? 'unconfirmed' : 'kept';
};

/** The profile without the index's own bookkeeping, which is not part of the secret. */
const withoutMarker = (profile: StoredProfile): StoredProfile => ({
  ...(profile.credentials ? { credentials: profile.credentials } : {}),
  ...(profile.oauth ? { oauth: profile.oauth } : {}),
});

/**
 * Removes one stored profile, reporting what became of it.
 *
 * A secret the OS store will not give up fails the whole removal rather than being written off.
 * `readProfile` looks the OS store up by key and never through the index, so dropping the index
 * entry while the secret stays behind would leave a credential that still authenticates every
 * command — and that `logout --all`, which enumerates the index, could no longer even find.
 */
export const deleteProfile = (location: CredentialStoreLocation, key: string): 'removed' | 'absent' =>
  withStoreLock(location, () => {
    const entry = indexEntry(location, key);
    if (entry.backend === 'keychain') {
      const outcome = removeSecret(location, key);
      if (outcome === 'kept') {
        // The one case worth refusing: the secret answered a lookup after the clear, so it is still
        // there and still usable. Dropping the entry would report a sign-out over a live credential
        // and lose the only record of where it is.
        throw new Error('Could not remove the credential from your ' + osStoreName() + '.');
      }
      if (outcome === 'unconfirmed') {
        warn('Your ' + osStoreName() + ' may still hold a credential for this host; remove it there if so.');
      }
    }
    const store = readStore(location);
    if (!Object.prototype.hasOwnProperty.call(store.profiles, key)) return 'absent';
    const profiles = { ...store.profiles };
    delete profiles[key];
    writeStore(location, { version: STORE_VERSION, profiles });
    return 'removed';
  });

/**
 * Forgets everything, in both places.
 *
 * The keychain items go one by one, taken from the index, before the index itself does: deleting the
 * file first would strand the secrets in the OS store with nothing left pointing at them — invisible
 * to this CLI and never cleaned up.
 */
export const clearAll = (location: CredentialStoreLocation): void => {
  const kept = withStoreLock(location, () => {
    // The keychain clears and the index rewrite share one lock with login. It can hold the lock for
    // several helper calls, but that is preferable to acknowledging a logout that strands a secret.
    const entries = Object.entries(readStore(location).profiles);
    const outcomes = entries.map(
      ([key, profile]) =>
        [key, profile?.backend === 'keychain' ? removeSecret(location, key) : 'removed'] as const,
    );
    const kept = outcomes.filter(([, outcome]) => outcome === 'kept').map(([key]) => key);
    if (outcomes.some(([, outcome]) => outcome === 'unconfirmed')) {
      warn('Your ' + osStoreName() + ' may still hold credentials this could not remove.');
    }
    const remaining = entries.filter(([key]) => kept.includes(key));
    if (remaining.length === 0) deleteStore(location);
    else writeStore(location, { version: STORE_VERSION, profiles: Object.fromEntries(remaining) });
    return kept;
  });
  if (kept.length === 0) return;
  // The index entry is the only record of which base URLs have a secret in the OS store, so one
  // still holding a retrievable secret keeps its entry: dropping it would strand the credential
  // there — still live, and invisible to this CLI for good.
  throw new Error(
    'Could not remove every credential from your ' +
      osStoreName() +
      '; ' +
      String(kept.length) +
      ' still there.',
  );
};

/** Writes one profile into the on-disk store while the caller holds the credential-store lock. */
const writeIndex = (location: CredentialStoreLocation, key: string, profile: StoredProfile): void => {
  const store = readStore(location);
  writeStore(location, {
    version: STORE_VERSION,
    profiles: { ...store.profiles, [key]: profile },
  });
};

// Empty maps are dropped rather than written as `{}`: a store a user opens should show what is
// actually saved, and a token-only sign-in has no OAuth metadata to speak of.
const mergeProfile = (existing: StoredProfile, update: StoredProfile): StoredProfile => {
  const credentials = { ...(existing.credentials ?? {}), ...(update.credentials ?? {}) };
  const oauth = { ...(existing.oauth ?? {}), ...(update.oauth ?? {}) };
  return {
    ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
    ...(Object.keys(oauth).length > 0 ? { oauth } : {}),
  };
};
