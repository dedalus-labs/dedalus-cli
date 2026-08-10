# Dedalus CLI API

Complete reference of every operation, grouped by resource. See [the README](./README.md) for usage and configuration.

## Contents

- [`MachineLifecycle`](#machinelifecycle)
  - [List machines](#list-machines)
  - [Create machine](#create-machine)
  - [Destroy machine](#destroy-machine)
  - [Get machine](#get-machine)
  - [Update machine](#update-machine)
  - [List artifacts](#list-artifacts)
  - [Delete artifact](#delete-artifact)
  - [Get artifact](#get-artifact)
  - [List executions](#list-executions)
  - [Create execution](#create-execution)
  - [Delete execution](#delete-execution)
  - [Get execution](#get-execution)
  - [List execution events](#list-execution-events)
  - [Get execution output](#get-execution-output)
  - [List previews](#list-previews)
  - [Create preview](#create-preview)
  - [Delete preview](#delete-preview)
  - [Get preview](#get-preview)
  - [Sleep a running machine](#sleep-a-running-machine)
  - [List SSH sessions](#list-ssh-sessions)
  - [Create SSH session](#create-ssh-session)
  - [Delete SSH session](#delete-ssh-session)
  - [Get SSH session](#get-ssh-session)
  - [Watch machine lifecycle status](#watch-machine-lifecycle-status)
  - [List terminals](#list-terminals)
  - [Create terminal](#create-terminal)
  - [Delete terminal](#delete-terminal)
  - [Get terminal](#get-terminal)
  - [Connect to terminal WebSocket stream](#connect-to-terminal-websocket-stream)
  - [Wake a sleeping machine](#wake-a-sleeping-machine)
- [`Usage`](#usage)
  - [Get usage summary](#get-usage-summary)
  - [`Usage Machines`](#usage-machines)
    - [List machine compute usage breakdown](#list-machine-compute-usage-breakdown)
    - [List machine storage usage breakdown](#list-machine-storage-usage-breakdown)

## `MachineLifecycle`

### List machines

```sh
dedalus machine-lifecycle list --bearer "$BEARER"
```

### Create machine

```sh
dedalus machine-lifecycle create --bearer "$BEARER" --memory-mib '1' --storage-gib '1' --vcpu '1'
```

### Destroy machine

```sh
dedalus machine-lifecycle delete --bearer "$BEARER" --machine-id 'machine_id'
```

### Get machine

```sh
dedalus machine-lifecycle retrieve --bearer "$BEARER" --machine-id 'machine_id'
```

### Update machine

```sh
dedalus machine-lifecycle patch --bearer "$BEARER" --machine-id 'machine_id'
```

### List artifacts

```sh
dedalus machine-lifecycle list-artifacts --bearer "$BEARER" --machine-id 'machine_id'
```

### Delete artifact

```sh
dedalus machine-lifecycle delete-artifact --bearer "$BEARER" --machine-id 'machine_id' --artifact-id 'artifact_id'
```

### Get artifact

```sh
dedalus machine-lifecycle retrieve-artifact --bearer "$BEARER" --machine-id 'machine_id' --artifact-id 'artifact_id'
```

### List executions

```sh
dedalus machine-lifecycle list-executions --bearer "$BEARER" --machine-id 'machine_id'
```

### Create execution

```sh
dedalus machine-lifecycle create-execution --bearer "$BEARER" --machine-id 'machine_id' --command '["command"]'
```

### Delete execution

```sh
dedalus machine-lifecycle delete-execution --bearer "$BEARER" --machine-id 'machine_id' --execution-id 'execution_id'
```

### Get execution

```sh
dedalus machine-lifecycle retrieve-execution --bearer "$BEARER" --machine-id 'machine_id' --execution-id 'execution_id'
```

### List execution events

```sh
dedalus machine-lifecycle list-execution-events --bearer "$BEARER" --machine-id 'machine_id' --execution-id 'execution_id'
```

### Get execution output

```sh
dedalus machine-lifecycle list-execution-output --bearer "$BEARER" --machine-id 'machine_id' --execution-id 'execution_id'
```

### List previews

```sh
dedalus machine-lifecycle list-previews --bearer "$BEARER" --machine-id 'machine_id'
```

### Create preview

```sh
dedalus machine-lifecycle create-preview --bearer "$BEARER" --machine-id 'machine_id' --port '1'
```

### Delete preview

```sh
dedalus machine-lifecycle delete-preview --bearer "$BEARER" --machine-id 'machine_id' --preview-id 'preview_id'
```

### Get preview

```sh
dedalus machine-lifecycle retrieve-preview --bearer "$BEARER" --machine-id 'machine_id' --preview-id 'preview_id'
```

### Sleep a running machine

```sh
dedalus machine-lifecycle sleep --bearer "$BEARER" --machine-id 'machine_id'
```

### List SSH sessions

```sh
dedalus machine-lifecycle list-ssh-sessions --bearer "$BEARER" --machine-id 'machine_id'
```

### Create SSH session

```sh
dedalus machine-lifecycle create-ssh-session --bearer "$BEARER" --machine-id 'machine_id' --public-key 'public_key'
```

### Delete SSH session

```sh
dedalus machine-lifecycle delete-ssh-session --bearer "$BEARER" --machine-id 'machine_id' --session-id 'session_id'
```

### Get SSH session

```sh
dedalus machine-lifecycle retrieve-ssh-session --bearer "$BEARER" --machine-id 'machine_id' --session-id 'session_id'
```

### Watch machine lifecycle status

Streams machine lifecycle updates over Server-Sent Events. Each `status` event contains a full `LifecycleResponse` payload. The stream closes after the machine reaches its current desired state.

```sh
dedalus machine-lifecycle watch-status --bearer "$BEARER" --machine-id 'machine_id' --max-items 10
```

### List terminals

```sh
dedalus machine-lifecycle list-terminals --bearer "$BEARER" --machine-id 'machine_id'
```

### Create terminal

```sh
dedalus machine-lifecycle create-terminal --bearer "$BEARER" --machine-id 'machine_id' --height '1' --width '1'
```

### Delete terminal

```sh
dedalus machine-lifecycle delete-terminal --bearer "$BEARER" --machine-id 'machine_id' --terminal-id 'terminal_id'
```

### Get terminal

```sh
dedalus machine-lifecycle retrieve-terminal --bearer "$BEARER" --machine-id 'machine_id' --terminal-id 'terminal_id'
```

### Connect to terminal WebSocket stream

Upgrades to a WebSocket connection for interactive terminal I/O. Clients send JSON `TerminalClientEvent` messages and receive JSON `TerminalServerEvent` messages. Terminal byte streams are base64-encoded inside `input` and `output` events; `resize` events use integer `width` and `height` fields.

```sh
dedalus machine-lifecycle connect-terminal --bearer "$BEARER" --machine-id 'machine_id' --terminal-id 'terminal_id' --max-items 10
```

### Wake a sleeping machine

```sh
dedalus machine-lifecycle wake --bearer "$BEARER" --machine-id 'machine_id'
```

## `Usage`

### Get usage summary

```sh
dedalus usage list --bearer "$BEARER"
```

### `Usage Machines`

#### List machine compute usage breakdown

```sh
dedalus usage:machines list-compute-usage --bearer "$BEARER"
```

#### List machine storage usage breakdown

```sh
dedalus usage:machines list-storage-usage --bearer "$BEARER"
```
