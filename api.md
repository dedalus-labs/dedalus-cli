# Dedalus CLI API

Complete reference of every operation, grouped by resource. See [the README](./README.md) for usage and configuration.

## Contents

- [`Machines`](#machines)
  - [List machines](#list-machines)
  - [Create machine](#create-machine)
  - [Get machine](#get-machine)
  - [Update machine](#update-machine)
  - [Destroy machine](#destroy-machine)
  - [Watch machine lifecycle status](#watch-machine-lifecycle-status)
  - [Sleep a running machine](#sleep-a-running-machine)
  - [Wake a sleeping machine](#wake-a-sleeping-machine)
  - [`Machines Network`](#machines-network)
    - [Get machine network identity](#get-machine-network-identity)
  - [`Machines Artifacts`](#machines-artifacts)
    - [List artifacts](#list-artifacts)
    - [Get artifact](#get-artifact)
    - [Delete artifact](#delete-artifact)
  - [`Machines Ports`](#machines-ports)
    - [List ports](#list-ports)
    - [Create port](#create-port)
    - [Get port](#get-port)
    - [Delete port](#delete-port)
  - [`Machines Ssh`](#machines-ssh)
    - [List SSH sessions](#list-ssh-sessions)
    - [Create SSH session](#create-ssh-session)
    - [Get SSH session](#get-ssh-session)
    - [Delete SSH session](#delete-ssh-session)
  - [`Machines Executions`](#machines-executions)
    - [List executions](#list-executions)
    - [Create execution](#create-execution)
    - [Get execution](#get-execution)
    - [Delete execution](#delete-execution)
    - [Get execution output](#get-execution-output)
    - [List execution events](#list-execution-events)
  - [`Machines Terminals`](#machines-terminals)
    - [List terminals](#list-terminals)
    - [Create terminal](#create-terminal)
    - [Get terminal](#get-terminal)
    - [Delete terminal](#delete-terminal)
    - [Connect to terminal WebSocket stream](#connect-to-terminal-websocket-stream)
- [`Networks`](#networks)
  - [Get network details](#get-network-details)
- [`Usage`](#usage)
  - [Get usage summary](#get-usage-summary)
  - [List machine compute usage breakdown](#list-machine-compute-usage-breakdown)
  - [List machine storage usage breakdown](#list-machine-storage-usage-breakdown)

## `Machines`

### List machines

```sh
dedalus machines list --api-key "$DEDALUS_API_KEY" --max-items 10
```

### Create machine

```sh
dedalus machines create --api-key "$DEDALUS_API_KEY" --memory-mib '0' --storage-gib '0' --vcpu '0'
```

### Get machine

```sh
dedalus machines retrieve --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id'
```

### Update machine

```sh
dedalus machines update --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id'
```

### Destroy machine

```sh
dedalus machines delete --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id'
```

### Watch machine lifecycle status

Streams machine lifecycle updates over Server-Sent Events. Each `status` event contains a full `LifecycleResponse` payload. The stream closes after the machine reaches its current desired state.

```sh
dedalus machines watch --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --max-items 10
```

### Sleep a running machine

```sh
dedalus machines sleep --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id'
```

### Wake a sleeping machine

```sh
dedalus machines wake --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id'
```

### `Machines Network`

#### Get machine network identity

```sh
dedalus machines network retrieve --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id'
```

### `Machines Artifacts`

#### List artifacts

```sh
dedalus machines artifacts list --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --max-items 10
```

#### Get artifact

```sh
dedalus machines artifacts retrieve --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --artifact-id 'artifact_id'
```

#### Delete artifact

```sh
dedalus machines artifacts delete --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --artifact-id 'artifact_id'
```

### `Machines Ports`

#### List ports

```sh
dedalus machines ports list --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --max-items 10
```

#### Create port

```sh
dedalus machines ports create --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --port '0'
```

#### Get port

```sh
dedalus machines ports retrieve --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --port-id 'port_id'
```

#### Delete port

```sh
dedalus machines ports delete --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --port-id 'port_id'
```

### `Machines Ssh`

#### List SSH sessions

```sh
dedalus machines ssh list --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --max-items 10
```

#### Create SSH session

```sh
dedalus machines ssh create --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --public-key ''
```

#### Get SSH session

```sh
dedalus machines ssh retrieve --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --session-id 'session_id'
```

#### Delete SSH session

```sh
dedalus machines ssh delete --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --session-id 'session_id'
```

### `Machines Executions`

#### List executions

```sh
dedalus machines executions list --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --max-items 10
```

#### Create execution

```sh
dedalus machines executions create --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --command '[""]'
```

#### Get execution

```sh
dedalus machines executions retrieve --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --execution-id 'execution_id'
```

#### Delete execution

```sh
dedalus machines executions delete --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --execution-id 'execution_id'
```

#### Get execution output

```sh
dedalus machines executions output --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --execution-id 'execution_id'
```

#### List execution events

```sh
dedalus machines executions events --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --execution-id 'execution_id' --max-items 10
```

### `Machines Terminals`

#### List terminals

```sh
dedalus machines terminals list --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --max-items 10
```

#### Create terminal

```sh
dedalus machines terminals create --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --height '0' --width '0'
```

#### Get terminal

```sh
dedalus machines terminals retrieve --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --terminal-id 'terminal_id'
```

#### Delete terminal

```sh
dedalus machines terminals delete --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --terminal-id 'terminal_id'
```

#### Connect to terminal WebSocket stream

Upgrades to a WebSocket connection for interactive terminal I/O. Clients send JSON `TerminalClientEvent` messages and receive JSON `TerminalServerEvent` messages. Terminal byte streams are base64-encoded inside `input` and `output` events; `resize` events use integer `width` and `height` fields.

```sh
dedalus machines terminals connect --api-key "$DEDALUS_API_KEY" --machine-id 'machine_id' --terminal-id 'terminal_id' --send '{"data":"","type":"input"}' --max-items 10
```

## `Networks`

### Get network details

```sh
dedalus networks retrieve --api-key "$DEDALUS_API_KEY" --network-id 'network_id'
```

## `Usage`

### Get usage summary

```sh
dedalus usage retrieve --api-key "$DEDALUS_API_KEY"
```

### List machine compute usage breakdown

```sh
dedalus usage machine-compute --api-key "$DEDALUS_API_KEY"
```

### List machine storage usage breakdown

```sh
dedalus usage machine-storage --api-key "$DEDALUS_API_KEY"
```
