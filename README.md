# Dedalus

This library provides convenient access to the Dedalus REST API from the command line.

The full API of this library can be found in [api.md](./api.md).

<br />

## Contents

- [Installation](#installation)
- [Usage](#usage)
- [API Reference](./api.md)
- [Shell Completion](#shell-completion)
- [Manual Pages](#manual-pages)
- [Streaming](#streaming)
- [WebSockets](#websockets)
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
# npm (requires Node.js)
npm install -g dedalus-cli
```

<br />

## Usage

```sh
dedalus [resource] [command] [flags]

dedalus machines create --api-key "$DEDALUS_API_KEY" --autosleep '300s' --memory-mib '4096' --storage-gib '10' --vcpu '1'
```

Scalar generates the SDK, resource commands, API reference, and manual pages from
the DCS OpenAPI input. Handwritten code lives with its feature: `src/auth` owns
login and credentials, while `src/cli/program.ts` assembles the executable.

Wrap handwritten modules and modifications in `// @custom start` and
`// @custom end`, with a normal comment explaining each range. Preserve Scalar's generated provenance headers.
These markers document ownership; they do not exempt code from review or tests.
Scalar carries edits on `scalar-next` through its three-way merge.

The CLI registers nested resources as command words (`machines executions list`).
Completion reads the assembled command tree so nested resources and auth commands
stay consistent with help. The SDK owns HTTP, pagination, SSE, and WebSocket
transports. A small authentication subclass adds bounded OAuth recovery and supplies
the stored bearer token to Scalar 0.32.3's WebSocket transport.

See the [API reference](./api.md) for every available operation.

<br />

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

Installing the package globally also installs man pages. `man dedalus` lists the command groups and global options, while `man dedalus-completion` documents shell completion.

```sh
man dedalus
man dedalus-completion
```

<br />

## Streaming

Streaming commands emit one result per line as the server sends it. Use `--max-items <count>` to stop after N items.

<br />

## WebSockets

WebSocket commands stay connected and stream messages. Use `--send <json>` to send a message (or pipe JSON/YAML on stdin) and `--max-items <count>` to bound output.

<br />

## Authentication

Sign in through the browser with Clerk Authorization Code and S256 Proof Key
for Code Exchange (PKCE). The command-line interface (CLI) stores Clerk's OAuth
2.0 token set in protected local storage and uses the access token for
authenticated requests:

```sh
dedalus auth login
dedalus auth status
dedalus auth status --offline
dedalus auth logout
```

Normal resource commands resolve one credential in this order: an explicit
API-key flag, its environment variable, then the stored browser-login
OAuth session. Once selected, a rejected credential fails in place and never
falls back to another source. `--offline` reads only stored status metadata.
Add `--json` to auth or generated resource commands for structured output that
excludes secret values.

Browser login defaults to the development environment and also supports the
configured staging environment. Each OAuth session is restricted to the gateway
for its configured issuer. Production browser login is not configured in this
version. See [authentication configuration](./src/auth/README.md#configuration)
for supported overrides.

Workload credentials may also be supplied explicitly:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--api-key` | `string \| provider` | - | API key authentication using Bearer token. Defaults to `DEDALUS_API_KEY`. |
| `--x-api-key` | `string \| provider` | - | API key authentication using X-API-Key header. Defaults to `DEDALUS_X_API_KEY`. |
| `--bearer-auth` | `string \| provider` | - | Reserved for the stored OAuth adapter; direct CLI and environment overrides are rejected. |

Declared schemes:

- `ApiKeyAuth` API key in header `x-api-key`
- `BearerAuth` bearer token

<br />

## Errors

Failed requests print a structured error to standard error and exit with a status that identifies the failure class. The error body carries the API's own `message` plus a stable `code`, the HTTP `status`, the `requestId`, and — where one applies — an actionable `hint`. Usage errors (exit `2`) are reported as a plain message instead, since no request was made. Exit statuses: `0` success, `1` `error`, `2` `usage`, `10` `auth-failed`, `11` `not-found`, `12` `rate-limited`, `13` `client-error`, `14` `server-error`, `15` `connection-error`.

Documented error statuses: `400`, `401`, `403`, `409`, `429`, `500`, `502`, `503`, `default`.

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
- Errors carry a stable `code` and an actionable `hint` beside the API's own message, and each failure class exits with its own status: `1` `error`, `2` `usage`, `10` `auth-failed`, `11` `not-found`, `12` `rate-limited`, `13` `client-error`, `14` `server-error`, `15` `connection-error`.

<br />

## Logging

- Pass `--debug` to any command to enable SDK debug logging on stderr.

<br />

## Requirements

- Node.js 20 or newer

Powered by Scalar.

## OAuth request recovery

OAuth commands refresh tokens shortly before expiry. If an HTTP request returns
401 unexpectedly, the custom client reloads credentials under the lifecycle lock,
uses a newer token if another process refreshed it, or refreshes once. It retries
the request once with the same body and idempotency key. Another 401 is returned
to the caller. API keys, 403 permission denials, and consumed request streams do
not enter this recovery path. WebSocket reconnection is outside this HTTP retry.

A temporary refresh failure preserves stored credentials so a later command can
try again. Permanent provider failures are cached for that credential within the
current process and require signing in again. This does not guarantee recovery
if a rotated refresh-token response is lost before it can be saved.

Recovery lives in `src/auth/client.ts` and `src/auth/`. The SDK's shared
request method has one visibility change (`private` to `protected`); Scalar still
owns request construction, pagination, response parsing, and transient retries.
