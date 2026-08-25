# Dedalus CLI API

Complete reference of every operation, grouped by resource. See [the README](./README.md) for usage and authentication.

## machine-lifecycle

### `dedalus machine-lifecycle list`

`GET /v1/machines` — List machines

Flags: `--x-dedalus-org-id`, `--limit`, `--cursor`

### `dedalus machine-lifecycle create`

`POST /v1/machines` — Create machine

Flags: `--x-dedalus-org-id`, `--idempotency-key` (required), `--autosleep`, `--memory-mib` (required), `--storage-gib` (required), `--vcpu` (required)

### `dedalus machine-lifecycle delete`

`DELETE /v1/machines/{machine_id}` — Destroy machine

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--idempotency-key` (required)

### `dedalus machine-lifecycle retrieve`

`GET /v1/machines/{machine_id}` — Get machine

Flags: `--x-dedalus-org-id`, `--machine-id` (required)

### `dedalus machine-lifecycle patch`

`PATCH /v1/machines/{machine_id}` — Update machine

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--idempotency-key` (required), `--autosleep`, `--memory-mib`, `--storage-gib`, `--vcpu`

### `dedalus machine-lifecycle list-artifacts`

`GET /v1/machines/{machine_id}/artifacts` — List artifacts

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--limit`, `--cursor`

### `dedalus machine-lifecycle delete-artifact`

`DELETE /v1/machines/{machine_id}/artifacts/{artifact_id}` — Delete artifact

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--artifact-id` (required)

### `dedalus machine-lifecycle retrieve-artifact`

`GET /v1/machines/{machine_id}/artifacts/{artifact_id}` — Get artifact

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--artifact-id` (required)

### `dedalus machine-lifecycle list-executions`

`GET /v1/machines/{machine_id}/executions` — List executions

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--limit`, `--cursor`

### `dedalus machine-lifecycle create-execution`

`POST /v1/machines/{machine_id}/executions` — Create execution

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--idempotency-key` (required), `--command` (required), `--cwd`, `--env`, `--stdin`, `--timeout-ms`

### `dedalus machine-lifecycle delete-execution`

`DELETE /v1/machines/{machine_id}/executions/{execution_id}` — Delete execution

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--execution-id` (required)

### `dedalus machine-lifecycle retrieve-execution`

`GET /v1/machines/{machine_id}/executions/{execution_id}` — Get execution

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--execution-id` (required)

### `dedalus machine-lifecycle list-execution-events`

`GET /v1/machines/{machine_id}/executions/{execution_id}/events` — List execution events

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--execution-id` (required), `--limit`, `--cursor`

### `dedalus machine-lifecycle list-execution-output`

`GET /v1/machines/{machine_id}/executions/{execution_id}/output` — Get execution output

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--execution-id` (required)

### `dedalus machine-lifecycle get-network`

`GET /v1/machines/{machine_id}/network` — Get machine network identity

Flags: `--x-dedalus-org-id`, `--machine-id` (required)

### `dedalus machine-lifecycle list-ports`

`GET /v1/machines/{machine_id}/ports` — List ports

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--limit`, `--cursor`

### `dedalus machine-lifecycle create-port`

`POST /v1/machines/{machine_id}/ports` — Create port

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--idempotency-key` (required), `--port` (required), `--protocol`

### `dedalus machine-lifecycle delete-port`

`DELETE /v1/machines/{machine_id}/ports/{port_id}` — Delete port

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--port-id` (required)

### `dedalus machine-lifecycle retrieve-port`

`GET /v1/machines/{machine_id}/ports/{port_id}` — Get port

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--port-id` (required)

### `dedalus machine-lifecycle sleep`

`POST /v1/machines/{machine_id}/sleep` — Sleep a running machine

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--idempotency-key` (required)

### `dedalus machine-lifecycle list-ssh-sessions`

`GET /v1/machines/{machine_id}/ssh` — List SSH sessions

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--limit`, `--cursor`

### `dedalus machine-lifecycle create-ssh-session`

`POST /v1/machines/{machine_id}/ssh` — Create SSH session

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--idempotency-key` (required), `--public-key` (required)

### `dedalus machine-lifecycle delete-ssh-session`

`DELETE /v1/machines/{machine_id}/ssh/{session_id}` — Delete SSH session

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--session-id` (required)

### `dedalus machine-lifecycle retrieve-ssh-session`

`GET /v1/machines/{machine_id}/ssh/{session_id}` — Get SSH session

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--session-id` (required)

### `dedalus machine-lifecycle watch-status`

`GET /v1/machines/{machine_id}/status/stream` — Watch machine lifecycle status

Streams machine lifecycle updates over Server-Sent Events. Each `status` event contains a full `LifecycleResponse` payload. The stream closes after the machine reaches its current desired state.

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--last-event-id`

### `dedalus machine-lifecycle list-terminals`

`GET /v1/machines/{machine_id}/terminals` — List terminals

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--limit`, `--cursor`

### `dedalus machine-lifecycle create-terminal`

`POST /v1/machines/{machine_id}/terminals` — Create terminal

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--idempotency-key` (required), `--cwd`, `--env`, `--height` (required), `--shell`, `--width` (required)

### `dedalus machine-lifecycle delete-terminal`

`DELETE /v1/machines/{machine_id}/terminals/{terminal_id}` — Delete terminal

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--terminal-id` (required)

### `dedalus machine-lifecycle retrieve-terminal`

`GET /v1/machines/{machine_id}/terminals/{terminal_id}` — Get terminal

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--terminal-id` (required)

### `dedalus machine-lifecycle connect-terminal`

`GET /v1/machines/{machine_id}/terminals/{terminal_id}/stream` — Connect to terminal WebSocket stream

Upgrades to a WebSocket connection for interactive terminal I/O. Clients send JSON `TerminalClientEvent` messages and receive JSON `TerminalServerEvent` messages. Terminal byte streams are base64-encoded inside `input` and `output` events; `resize` events use integer `width` and `height` fields.

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--terminal-id` (required), `--send`

### `dedalus machine-lifecycle wake`

`POST /v1/machines/{machine_id}/wake` — Wake a sleeping machine

Flags: `--x-dedalus-org-id`, `--machine-id` (required), `--idempotency-key` (required)

## networks

### `dedalus networks retrieve`

`GET /v1/networks/{network_id}` — Get network details

Flags: `--x-dedalus-org-id`, `--network-id` (required)

## usage

### `dedalus usage list`

`GET /v1/usage` — Get usage summary

Flags: `--period-start`

## usage:machines

### `dedalus usage:machines list-compute-usage`

`GET /v1/usage/machines/compute` — List machine compute usage breakdown

Flags: `--period-start`, `--period-end`, `--machine-id`, `--granularity`

### `dedalus usage:machines list-storage-usage`

`GET /v1/usage/machines/storage` — List machine storage usage breakdown

Flags: `--period-start`, `--period-end`, `--machine-id`
