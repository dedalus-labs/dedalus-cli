# Dedalus

This library provides convenient access to the Dedalus REST API from the command line.

The full API of this library can be found in [api.md](./api.md).

<br />

## Contents

- [Installation](#installation)
- [Usage](#usage)
- [Image import](#image-import)
- [Feedback](#feedback)
- [Staging package testing](#staging-package-testing)
- [API Reference](./api.md)
- [Signing In](#signing-in)
- [File Arguments](#file-arguments)
- [Shell Completion](#shell-completion)
- [Manual Pages](#manual-pages)
- [Authentication](#authentication)
- [Errors](#errors)
- [Client Options](#client-options)
- [Retries and Timeouts](#retries-and-timeouts)
- [Pagination](#pagination)
- [Helpers](#helpers)
- [Logging](#logging)
- [Requirements](#requirements)

<br />

## Installation

```sh
# macOS, Linux, and Windows (requires Node.js 20+ and pnpm)
pnpm add --global dedalus-cli

# Homebrew installs Node and the same CLI package
brew install dedalus-labs/tap/dedalus

# macOS and Linux installer (requires Node.js 20+ and pnpm)
curl -fsSL https://www.dedaluslabs.ai/install/dedalus | bash
```

### Upgrading

Run `pnpm add --global dedalus-cli@latest` to upgrade a pnpm installation.
`dedalus upgrade --check` checks for a release, and `dedalus upgrade` uses the
package manager that owns the installation. Homebrew installations use Homebrew.

New releases ship a Node package instead of native executables. Existing direct
downloads must migrate with the installation command above. Remove the old
executable if it takes precedence over pnpm's `dedalus` on your `PATH`.
If pnpm reports that its global bin directory is missing, run `pnpm setup` and
open a new shell before installing.

<br />

## Image import

Save a Docker image as an archive, then import it:

```sh
docker save my-app:latest -o my-app.tar
dedalus images import my-app.tar --name my-app --platform linux/amd64
```

Import hashes and streams the file to signed storage, registers the image, then
polls until it is ready. Progress goes to stderr; stdout contains one final image
object. A failed, rejected, or revoked image makes the command exit nonzero.

Use `--no-wait` to return after upload and registration while preparation continues:

```sh
dedalus images import my-app.tar --name my-app --no-wait
```

`--wait` is accepted explicitly but is already the default. `--wait-timeout 3600`
sets the total import budget in seconds; the global `--timeout` remains a per-request
limit in milliseconds. Timing out or pressing Ctrl-C stops the client and does not
cancel accepted preparation. Keep the image ID from progress output to check its
status later. Use `--idempotency-key <key>` to reuse the same import identity when
retrying the same archive and options.

Archives must be regular, nonempty `docker save` files of at most 5 GiB. This command
requires the image API to be deployed and enabled for your organization; it does not
bypass access controls. Shell completion for this custom command is not yet included.

Custom image imports currently require an Ubuntu 24.04 `linux/amd64` Docker-save
archive. On Apple silicon, build or pull with `--platform linux/amd64` before
saving the archive. The image provides the filesystem; container entrypoint,
CMD, environment, working directory, and user settings are not applied. Start
processes using Machine exec or SSH after the Machine reaches running.

## Usage

```sh
dedalus [resource] [command] [flags]

dedalus machines create \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --autosleep '300s' \
  --memory-mib '4096' \
  --storage-gib '10' \
  --vcpu '1'
```

Every command accepts the global flags below, so the examples that follow show only what is specific to them.

Create a machine with API defaults and open an interactive SSH shell:

```sh
dedalus machines create --ssh
```

`--ssh` reuses the connection flow from `dedalus ssh <machine-id>`, including
the selected API endpoint, credentials, and organization. OpenSSH (`ssh` and
`ssh-keygen`) must be in PATH. SSH owns the terminal output and exit status.
Without `--ssh`, creation prints the usual response in the selected format.
If SSH fails or is cancelled, the machine remains available. The CLI prints
its ID and a reconnect command on stderr before opening the session.

Piped JSON can supply machine options while SSH reads from the controlling
terminal. A missing controlling terminal is reported before creating a machine.

The reconnect command retains the selected API endpoint and organization.
On Windows, run the printed command in PowerShell, not Command Prompt.
Credential flags use environment-variable references. Set each variable to the
credential used for creation before running the command. Credential file
references are retained. Environment credentials and saved login remain in use.

See the [API reference](./api.md) for every available operation.

<br />

## Signing In

Run `dedalus login` and select “Sign in with a browser” at the prompt.

`dedalus login` signs you in and saves the credential for later commands, so it does not have to be passed every time. It goes into your operating system's credential store — the Keychain on macOS, the system keyring on Linux, Credential Manager on Windows — and falls back to a file in your state directory, readable only by you, when no such store is available. Either way it is filed under the base URL it was captured for, so a credential saved for one host is never sent to another. `dedalus logout` forgets it. It also asks the provider to revoke a saved OAuth token when a revocation endpoint is known. The local copy is removed first, so if the provider cannot be reached the credential is still gone from this machine; the failure is printed as a warning and the command still succeeds. A credential passed with a flag, or set in the environment, still takes precedence over a saved one. Choose **Sign in with a browser** or **Use an API key**. To skip the menu, pass `--flow oauth-browser` or `--flow api-key`.

```sh
dedalus login
dedalus machines list
dedalus logout
dedalus logout --all
```

<br />

Browser sessions send API requests directly to `https://dcs.dedaluslabs.ai`. API-key authentication uses the same endpoint by default, or your selected API endpoint. Do not combine browser-token flags or environment variables with API-key credentials.

## File Arguments

Any command flag or credential reads its value from a file when the value begins with `@`, so a body field holding a whole document does not have to survive shell quoting. `@file://` always sends the file as text and `@data://` always sends it base64-encoded; a bare `@` lets the file decide. A flag that uploads a file takes its path with or without the `@`. Escape a literal value that begins with `@` as `\@`. The global options (`--base-url`, `--timeout`, `--format` and the rest) are read exactly as written.

```sh
dedalus COMMAND --FLAG @./body.json
dedalus COMMAND --FLAG @file://./notes.txt
dedalus COMMAND --FLAG @data://./logo.png
dedalus COMMAND --FLAG '\@not-a-file'
```

<br />
## Feedback

```sh
dedalus feedback "Machine creation failed" --include-logs auto
dedalus feedback "A suggestion" --include-logs false
dedalus feedback "Connection problem" --include-logs true
dedalus doctor --json
```

`--include-logs auto` is the default. It attaches diagnostics from a failed command
within the last 15 minutes for the same API host, credentials, and organization.
`false` sends no files; a recent server request receipt may still be included as
metadata. `true` includes a local runtime and proxy-configuration report even when
no failed command is available. Proxy values are omitted.

For a failed command, the receipt comes from its last API response, including a
successful response followed by a local connection failure. A later response
without a receipt clears the candidate. Successful responses are not reported as
HTTP failures.

The CLI records command names, route templates, response status, duration, and
server-issued request IDs under `~/.dedalus/debug`. It excludes command arguments,
request and response bodies, credentials, terminal output, and workspace files.
Files expire after 10 days and the directory is capped at 50 MiB. Cleanup runs
when recording new diagnostics. Each process partition is capped at 1,000 events
and 10 MiB. Feedback submissions never become diagnostic candidates themselves.

Selected files are rebuilt from permitted fields and sent with their exact byte
size and SHA-256 digest. HTTP retries reuse one idempotency key. A successful
response means the report was accepted for delivery; it does not confirm that
support has received it yet.

## Staging package testing

The `CLI SDK CI` workflow builds a versioned package, installs it in a temporary
directory, runs the tests against the installed package, and uploads the
`dedalus-cli-staging` artifact. The artifact contains a `.tgz` and its checksum
record. This workflow does not publish to npm or Homebrew.

CI builds and tests the Node package with pnpm on Linux. Releases use
GitHub-hosted Ubuntu for npm trusted publishing and attach the same Node package
archive to GitHub. Homebrew installs that archive through pnpm and supplies Node.

Test packages are marked private and retain the production API default.
Set `DEDALUS_TEST_BASE_URL` to your test API and pass it explicitly:

```sh
mkdir -p /tmp/dedalus-feedback-test
npm install --prefix /tmp/dedalus-feedback-test /absolute/path/to/dedalus-cli-VERSION.tgz
/tmp/dedalus-feedback-test/node_modules/.bin/dedalus doctor --json
/tmp/dedalus-feedback-test/node_modules/.bin/dedalus feedback "Staging smoke test" \
  --include-logs false --base-url "${DEDALUS_TEST_BASE_URL:?Set the test API URL}"
```

Set `DEDALUS_API_KEY` to a staging credential before submitting. To reproduce CI
locally, run `pnpm install --frozen-lockfile`, `pnpm build`, and `pnpm test:package`.
Custom feedback code lives under `src/feedback` and is integrated on `scalar-next`.
Validate Scalar regeneration there before promoting a release.
Release workflow customizations live under `ci/`. After merging generated output,
run `pnpm ci:generate` and the package checks before releasing. CI rejects drift
in any generated workflow, including the release workflows.

## Shell Completion

`dedalus completion <shell>` prints a completion script for bash, zsh, and fish. Add the matching line to your shell startup file to complete commands, subcommands, and flags with Tab.

```sh
# bash (~/.bashrc)
eval "$(dedalus completion bash)"

# zsh (~/.zshrc)
eval "$(dedalus completion zsh)"

# fish (~/.config/fish/config.fish)
dedalus completion fish | source
```

<br />

## Manual Pages

Installing the package globally also installs man pages. `man dedalus` lists every command, and each command has its own page named after the command with spaces and `:` replaced by `-`.

```sh
man dedalus
man dedalus-<resource>-<command>
```

<br />

## Authentication

Pass credentials to the generated client constructor. Environment variables are read automatically when supported by the target runtime.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--api-key` | `<value>` | - | Dedalus API key or short-lived delegated access token in Authorization: Bearer \<credential>. Defaults to DEDALUS_API_KEY. |
| `--x-api-key` | `<value>` | - | Dedalus API key. Alternative to Bearer token. Defaults to DEDALUS_X_API_KEY. |

Declared schemes:

- `ApiKeyAuth` API key in header `x-api-key`
- `BearerAuth` bearer token

<br />

## Errors

Failed requests print a structured error to standard error and exit with a status that identifies the failure class. The error body carries the API's own `message` plus a stable `code`, the HTTP `status`, the `requestId`, and — where one applies — an actionable `hint`. When the API answered with a JSON error payload, its parsed form is under `body`, so structured details such as an API-specific error code or field errors can be read without parsing `message`. Usage errors (exit `2`) are reported as a plain message instead, since no request was made. Exit statuses: `0` success, `1` `error`, `2` `usage`, `10` `auth-failed`, `11` `not-found`, `12` `rate-limited`, `13` `client-error`, `14` `server-error`, `15` `connection-error`.

Documented error statuses: `401`, `403`, `409`, `429`, `503`, `default`.

<br />

## Client Options

Configure the generated client by setting any of these options when you create it.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--base-url` | `<url>` | - | Override the base URL for API requests. |
| `--timeout` | `<ms>` | - | Request timeout in milliseconds. |
| `--max-retries` | `<count>` | - | Number of retries for retryable failures. |
| `--debug` | `flag` | - | Enable SDK debug logging. |

<br />

## Retries and Timeouts

Generated clients support request timeouts and retry temporary failures such as network errors, 408, 409, 429, and 5xx responses. Retry delays honor `Retry-After` headers when present. Tune the retry and timeout client options shown above, or override them per request.

<br />

## Pagination

Paginated commands fetch subsequent pages for you. Use `--max-items <count>` to cap the total number of items returned.

<br />

## Helpers

- `--format <format>` — output format: `auto`, `json`, `jsonl`, `pretty`, `raw`, `toon`, or `yaml`.
- `--format-error <format>` — error output format: `auto`, `json`, `jsonl`, `pretty`, `raw`, `toon`, or `yaml`.
- `--format toon` — token-efficient structured output for AI agents; uniform lists collapse into one header plus a row per item, with a definitive item count.
- `--transform <path>` and `--transform-error <path>` — dot-path transform for data/error output.
- `--raw-output`, `-r` — print transformed string values without JSON quotes.
- `--max-items <count>` — bound iterator, streaming, and WebSocket command output.
- `--no-input` — never prompt: a command that would ask fails instead, the same as it does without a terminal.
- Errors carry a stable `code` and an actionable `hint` beside the API's own message, and each failure class exits with its own status: `1` `error`, `2` `usage`, `10` `auth-failed`, `11` `not-found`, `12` `rate-limited`, `13` `client-error`, `14` `server-error`, `15` `connection-error`.

<br />

## Logging

- Pass `--debug` to any command to enable SDK debug logging on stderr.

<br />

## Requirements

- Node.js 20 or newer and pnpm. Homebrew installs its own Node dependency.

Powered by Scalar.

<!-- @custom start -->
### Automatic retry identity

Client-generated idempotency keys use the API's 32-character UUIDv7 format.
Automatic retries reuse the original key. Independent submissions receive new
keys, and callers can still supply an explicit key when retrying a saved request.
<!-- @custom end -->
