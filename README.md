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
- [Authentication](#authentication)
- [Errors](#errors)
- [Client Options](#client-options)
- [Retries and Timeouts](#retries-and-timeouts)
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
```

Create a machine with the API defaults and open an interactive SSH shell:

```sh
dedalus machines create --connect
```

Scalar owns the low-level software development kit (SDK), CLI runtime, and its
generated entry points. The published `dedalus` executable uses the
Dedalus-owned entry point under `src/custom` and imports Scalar's runtime
directly. Narrow runtime hooks are maintained on `scalar-next` through Scalar's
three-way merge; the SDK client and generated entry points remain untouched.
The resource-command table and API reference are deterministically regenerated
from `openapi.augmented.json` with `npm run generate:commands`. Keep
authentication, stored credentials, and other handwritten commands behind the
`src/custom` boundary.

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

## Authentication

Sign in through the browser with Clerk Authorization Code and S256 Proof Key
for Code Exchange (PKCE). The command-line interface (CLI) stores Clerk's OAuth
2.0 token set in protected local storage. The canonical service-account
application programming interface (API) key stays on the server:

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

The checked-in version 1 authentication bundle targets the development Clerk
application and `https://dev.admin.api.dedaluslabs.ai/dcs`. OAuth sessions are
accepted only for a Clerk development issuer and are sent only to that exact
gateway. Production needs its own checked-in issuer, client, and gateway bundle;
arbitrary HTTPS gateway overrides fail closed.

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

Non-success responses throw generated API errors. Error objects expose status, headers, response body, and request metadata where the target runtime supports it.

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

## Helpers

- `--format <format>` — output format: `auto`, `json`, `jsonl`, `pretty`, `raw`, or `yaml`.
- `--format-error <format>` — error output format: `auto`, `json`, `jsonl`, `pretty`, `raw`, or `yaml`.
- `--transform <path>` and `--transform-error <path>` — dot-path transform for data/error output.
- `--raw-output`, `-r` — print transformed string values without JSON quotes.
- `--max-items <count>` — bound iterator, streaming, and WebSocket command output.

<br />

## Logging

- Pass `--debug` to any command to enable SDK debug logging on stderr.

<br />

## Requirements

- Node.js 20 or newer
- OpenSSH (`ssh` and `ssh-keygen`) when using `machines create --connect`

Powered by Scalar.
