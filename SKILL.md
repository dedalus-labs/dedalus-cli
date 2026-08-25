---
name: dedalus-cli-sdk
description: "CLI SDK for Dedalus API. Use when writing CLI code that calls Dedalus API with the dedalus-cli package: installing it, constructing and authenticating the client, and calling API operations."
---

# Dedalus CLI SDK

Generated CLI client for Dedalus API, published as `dedalus-cli`. Use the generated client instead of hand-writing HTTP requests.

## Install

```sh
# npm (requires Node.js)
npm install -g dedalus-cli
```

## Client setup and authentication

Provide credentials using the options below. Environment variables are read automatically when the target runtime supports them:

- `--api-key` (env: `DEDALUS_API_KEY`) — API key authentication using Bearer token
- `--x-api-key` (env: `DEDALUS_X_API_KEY`) — API key authentication using X-API-Key header
- `--bearer-auth` (env: `DEDALUS_BEARER_AUTH`) — Dedalus API key in Authorization: Bearer <key>.

## Calling operations

```sh
dedalus [resource] [command] [flags]
```

Method names, parameter shapes, and response types are generated from the API description — do not guess them. Look up the exact call signature in [api.md](./api.md) before writing a call.

## Error handling

Non-success responses throw generated API errors. Error objects expose status, headers, response body, and request metadata where the target runtime supports it.

## Requirements

- Node.js 20 or newer

## Reference files

- [README.md](./README.md) — full feature tour: client options, retries and timeouts, logging.
- [api.md](./api.md) — complete catalogue of every operation with request and response types.
