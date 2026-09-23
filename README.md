# Dedalus

This library provides convenient access to the Dedalus REST API from the command line.

The full API of this library can be found in [api.md](./api.md).

<br />

## Contents

- [Installation](#installation)
- [Usage](#usage)
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
# npm (requires Node.js)
npm install -g dedalus-cli

# Homebrew — standalone binary, no Node.js required
brew install dedalus-labs/tap/dedalus

# Direct download — standalone binary, no Node.js required
curl -fsSL "https://github.com/dedalus-labs/dedalus-cli/releases/latest/download/dedalus-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/').tar.gz" | tar xz
sudo mv dedalus /usr/local/bin/

# Windows — download and extract dedalus-windows-x64.zip, then add it to PATH
# https://github.com/dedalus-labs/dedalus-cli/releases/latest/download/dedalus-windows-x64.zip
```

<br />

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

See the [API reference](./api.md) for every available operation.

<br />

## Signing In

`dedalus login` signs you in and saves the credential for later commands, so it does not have to be passed every time. It goes into your operating system's credential store — the system keyring on Linux, Credential Manager on Windows — and falls back to a file in your state directory, readable only by you, when no such store is available. On macOS it is always that file, because the system's own tool accepts a password only on its command line, where other processes could read it. Either way it is filed under the base URL it was captured for, so a credential saved for one host is never sent to another. `dedalus logout` forgets it. A credential passed with a flag, or set in the environment, still takes precedence over a saved one. Sign-in methods: api-key, x-api-key. Pass `--flow <name>` to pick one without being asked.

```sh
dedalus login
dedalus login --flow api-key
dedalus logout
dedalus logout --all
```

<br />

## File Arguments

Any command flag or credential reads its value from a file when the value begins with `@`, so a body field holding a whole document does not have to survive shell quoting. `@file://` always sends the file as text and `@data://` always sends it base64-encoded; a bare `@` lets the file decide. A flag that uploads a file takes its path with or without the `@`. Escape a literal value that begins with `@` as `\@`. The global options (`--base-url`, `--timeout`, `--format` and the rest) are read exactly as written.

```sh
dedalus COMMAND --FLAG @./body.json
dedalus COMMAND --FLAG @file://./notes.txt
dedalus COMMAND --FLAG @data://./logo.png
dedalus COMMAND --FLAG '\@not-a-file'
```

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
| `--api-key` | `string \| provider` | - | Dedalus API key or short-lived delegated access token in Authorization: Bearer <credential>. Defaults to DEDALUS_API_KEY. |
| `--x-api-key` | `string \| provider` | - | Dedalus API key. Alternative to Bearer token. Defaults to DEDALUS_X_API_KEY. |

Declared schemes:

- `ApiKeyAuth` API key in header `x-api-key`
- `BearerAuth` bearer token

<br />

## Errors

Failed requests print a structured error to standard error and exit with a status that identifies the failure class. The error body carries the API's own `message` plus a stable `code`, the HTTP `status`, the `requestId`, and — where one applies — an actionable `hint`. Usage errors (exit `2`) are reported as a plain message instead, since no request was made. Exit statuses: `0` success, `1` `error`, `2` `usage`, `10` `auth-failed`, `11` `not-found`, `12` `rate-limited`, `13` `client-error`, `14` `server-error`, `15` `connection-error`.

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
- Errors carry a stable `code` and an actionable `hint` beside the API's own message, and each failure class exits with its own status: `1` `error`, `2` `usage`, `10` `auth-failed`, `11` `not-found`, `12` `rate-limited`, `13` `client-error`, `14` `server-error`, `15` `connection-error`.

<br />

## Logging

- Pass `--debug` to any command to enable SDK debug logging on stderr.

<br />

## Requirements

- Node.js 20 or newer — for the npm install only; the standalone binaries bundle their own runtime.

Powered by Scalar.
