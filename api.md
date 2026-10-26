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
  - [Reboot a machine with fresh memory](#reboot-a-machine-with-fresh-memory)
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
    - [`Machines Executions Logs`](#machines-executions-logs)
      - [Get execution log status](#get-execution-log-status)
      - [Reauthorize execution log publication](#reauthorize-execution-log-publication)
      - [Create execution log read token](#create-execution-log-read-token)
  - [`Machines Autoresizing`](#machines-autoresizing)
    - [Read this machine's RAM autoresizing settings](#read-this-machines-ram-autoresizing-settings)
    - [Set this machine's RAM autoresizing settings](#set-this-machines-ram-autoresizing-settings)
- [`Organization`](#organization)
  - [`Organization Autoresizing`](#organization-autoresizing)
    - [Read organization RAM autoresizing policy](#read-organization-ram-autoresizing-policy)
    - [Set organization RAM autoresizing policy](#set-organization-ram-autoresizing-policy)

## `Machines`

### List machines

```sh
dedalus machines list --x-api-key "$DEDALUS_X_API_KEY" --max-items 10
```

### Create machine

```sh
dedalus machines create \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --autosleep '300s' \
  --memory-mib '4096' \
  --storage-gib '10' \
  --vcpu '1'
```

### Get machine

```sh
dedalus machines retrieve \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

### Update machine

```sh
dedalus machines update \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

### Destroy machine

```sh
dedalus machines delete \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

### Sleep a running machine

```sh
dedalus machines sleep \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

### Wake a sleeping machine

```sh
dedalus machines wake \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

### Reboot a machine with fresh memory

Checkpoints files and replaces the runtime. The machine ID and filesystem are preserved. RAM, processes, and temporary mounts are cleared. Poll the machine until its phase is running. Retry the same Idempotency-Key after a lost response.

```sh
dedalus machines reboot \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

### `Machines Ssh`

#### List SSH sessions

```sh
dedalus machines ssh list \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --max-items 10
```

#### Create SSH session

```sh
dedalus machines ssh create \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --public-key ''
```

#### Get SSH session

```sh
dedalus machines ssh retrieve \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --session-id 'session_id'
```

#### Delete SSH session

```sh
dedalus machines ssh delete \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --session-id 'session_id'
```

### `Machines Executions`

#### List executions

```sh
dedalus machines executions list \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --max-items 10
```

#### Create execution

```sh
dedalus machines executions create \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --command '[""]'
```

#### Get execution

```sh
dedalus machines executions retrieve \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --execution-id 'execution_id'
```

#### Delete execution

```sh
dedalus machines executions delete \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --execution-id 'execution_id'
```

#### Get execution output

```sh
dedalus machines executions output \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --execution-id 'execution_id'
```

#### List execution events

```sh
dedalus machines executions events \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --execution-id 'execution_id' \
  --max-items 10
```

#### `Machines Executions Logs`

##### Get execution log status

```sh
dedalus machines executions logs retrieve \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --execution-id 'execution_id'
```

##### Reauthorize execution log publication

```sh
dedalus machines executions logs reauthorize \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --execution-id 'execution_id'
```

##### Create execution log read token

```sh
dedalus machines executions logs create-token \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --execution-id 'execution_id'
```

### `Machines Autoresizing`

#### Read this machine's RAM autoresizing settings

```sh
dedalus machines autoresizing retrieve \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

#### Set this machine's RAM autoresizing settings

```sh
dedalus machines autoresizing update \
  --x-api-key "$DEDALUS_X_API_KEY" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --enabled
```

## `Organization`

### `Organization Autoresizing`

#### Read organization RAM autoresizing policy

```sh
dedalus organization autoresizing retrieve --x-api-key "$DEDALUS_X_API_KEY"
```

#### Set organization RAM autoresizing policy

```sh
dedalus organization autoresizing update --x-api-key "$DEDALUS_X_API_KEY" --enabled
```
