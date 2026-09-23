# Dedalus CLI API

Complete reference of every operation, grouped by resource. See [the README](./README.md) for usage and configuration.

## Contents

- [`Machines`](#machines)
  - [List machines](#list-machines)
  - [Create machine](#create-machine)
  - [Get machine](#get-machine)
  - [Update machine](#update-machine)
  - [Destroy machine](#destroy-machine)
  - [Sleep a running machine](#sleep-a-running-machine)
  - [Wake a sleeping machine](#wake-a-sleeping-machine)
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
    - [`connect`](#connect)

## `Machines`

### List machines

```sh
dedalus machines list --api-key "$DEDALUS_API_KEY" --max-items 10
```

### Create machine

```sh
dedalus machines create \
  --api-key "$DEDALUS_API_KEY" \
  --autosleep '300s' \
  --memory-mib '4096' \
  --storage-gib '10' \
  --vcpu '1'
```

### Get machine

```sh
dedalus machines retrieve \
  --api-key "$DEDALUS_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

### Update machine

```sh
dedalus machines update \
  --api-key "$DEDALUS_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

### Destroy machine

```sh
dedalus machines delete \
  --api-key "$DEDALUS_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

### Sleep a running machine

```sh
dedalus machines sleep \
  --api-key "$DEDALUS_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

### Wake a sleeping machine

```sh
dedalus machines wake \
  --api-key "$DEDALUS_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

### `Machines Ssh`

#### List SSH sessions

```sh
dedalus machines:ssh list \
  --api-key "$DEDALUS_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --max-items 10
```

#### Create SSH session

```sh
dedalus machines:ssh create \
  --api-key "$DEDALUS_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --public-key ''
```

#### Get SSH session

```sh
dedalus machines:ssh retrieve \
  --api-key "$DEDALUS_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --session-id 'session_id'
```

#### Delete SSH session

```sh
dedalus machines:ssh delete \
  --api-key "$DEDALUS_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --session-id 'session_id'
```

### `Machines Executions`

#### List executions

```sh
dedalus machines:executions list \
  --api-key "$DEDALUS_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --max-items 10
```

#### Create execution

```sh
dedalus machines:executions create \
  --api-key "$DEDALUS_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --command '[""]'
```

#### Get execution

```sh
dedalus machines:executions retrieve \
  --api-key "$DEDALUS_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --execution-id 'execution_id'
```

#### Delete execution

```sh
dedalus machines:executions delete \
  --api-key "$DEDALUS_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --execution-id 'execution_id'
```

#### Get execution output

```sh
dedalus machines:executions output \
  --api-key "$DEDALUS_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --execution-id 'execution_id'
```

#### List execution events

```sh
dedalus machines:executions events \
  --api-key "$DEDALUS_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --execution-id 'execution_id' \
  --max-items 10
```

### `Machines Terminals`

#### `connect`

```sh
dedalus machines:terminals connect \
  --api-key "$DEDALUS_API_KEY" \
  --machine-id 'machine_id' \
  --terminal-id 'terminal_id' \
  --send '{}' \
  --max-items 10
```
