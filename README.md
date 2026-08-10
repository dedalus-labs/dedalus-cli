# Dedalus

Generated CLI SDK for Dedalus API.
Controlplane API for Dedalus Cloud Services (DCS).

<br />

## Contents

- [Installation](#installation)
- [Usage](#usage)
- [API Reference](./api.md)
- [Streaming](#streaming)
- [WebSockets](#websockets)
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
npm install -g dedalus-cli
```

<br />

## Usage

```sh
dedalus [resource] [command] [flags]

dedalus machine-lifecycle list --bearer "$BEARER"
```

The examples in the following sections assume a `client` configured as shown above.

See the [API reference](./api.md) for every available operation.

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
| `--api-key-auth` | `string \| provider` | - | API key authentication using X-API-Key header Defaults to API_KEY_AUTH. |
| `--bearer-auth` | `string \| provider` | - | Dedalus API key in Authorization: Bearer <key>. Defaults to BEARER_AUTH. |
| `--bearer` | `string \| provider` | - | API key authentication using Bearer token Defaults to BEARER. |

Declared schemes:

- `ApiKeyAuth` API key in header `x-api-key`
- `BearerAuth` bearer token
- `Bearer` bearer token

<br />

## Errors

Non-success responses throw generated API errors. Error objects expose status, headers, response body, and request metadata where the target runtime supports it.

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

Powered by Scalar.


## Contributions

This SDK is generated programmatically. Manual edits to generated files will be
overwritten on the next build.

### SDK created by [Scalar](https://www.scalar.com/?utm_source=dedalus-cloud-services-api-cli&utm_campaign=sdk)
