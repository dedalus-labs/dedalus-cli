# Dedalus

This library provides convenient access to the Dedalus REST API from the command line.

The full API of this library can be found in [api.md](./api.md).

<br />

## Contents

- [Installation](#installation)
- [Usage](#usage)
- [Feedback](#feedback)
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

The examples in the following sections assume a `client` configured as shown above.

See the [API reference](./api.md) for every available operation.

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

## Streaming

Streaming commands emit one result per line as the server sends it. Use `--max-items <count>` to stop after N items.

<br />

## WebSockets

WebSocket commands stay connected and stream messages. Use `--send <json>` to send a message (or pipe JSON/YAML on stdin) and `--max-items <count>` to bound output.

<br />

## Authentication

Pass credentials to the generated client constructor. Environment variables are read automatically when supported by the target runtime.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--api-key` | `string \| provider` | - | API key authentication using Bearer token Defaults to DEDALUS_API_KEY. |
| `--x-api-key` | `string \| provider` | - | API key authentication using X-API-Key header Defaults to DEDALUS_X_API_KEY. |
| `--bearer-auth` | `string \| provider` | - | Dedalus API key in Authorization: Bearer <key>. Defaults to DEDALUS_BEARER_AUTH. |

Declared schemes:

- `ApiKeyAuth` API key in header `x-api-key`
- `BearerAuth` bearer token
- `Bearer` bearer token

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
