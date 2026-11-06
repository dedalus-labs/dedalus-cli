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
  - [Resize machine](#resize-machine)
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
      - [Create execution log read token](#create-execution-log-read-token)
  - [`Machines Autoresizing`](#machines-autoresizing)
    - [Read this machine's autoresizing settings](#read-this-machines-autoresizing-settings)
    - [Set this machine's autoresizing settings](#set-this-machines-autoresizing-settings)
- [`Organization`](#organization)
  - [`Organization Autoresizing`](#organization-autoresizing)
    - [Read organization autoresizing policy](#read-organization-autoresizing-policy)
    - [Set organization autoresizing policy](#set-organization-autoresizing-policy)
- [`Images`](#images)
  - [List image IDs owned by the authenticated organization](#list-image-ids-owned-by-the-authenticated-organization)
  - [Register an immutable OCI image for preparation](#register-an-immutable-oci-image-for-preparation)
  - [Read preparation status for an organization-owned image](#read-preparation-status-for-an-organization-owned-image)
  - [Rename an organization-owned image](#rename-an-organization-owned-image)
  - [Delete an organization-owned image](#delete-an-organization-owned-image)
  - [`Images Uploads`](#images-uploads)
    - [Reserve an immutable Docker image archive upload](#reserve-an-immutable-docker-image-archive-upload)

## `Machines`

### List machines

```sh
dedalus machines list --browser-token "$DEDALUS_BROWSER_TOKEN" --max-items 10
```

### Create machine

```sh
dedalus machines create \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --autosleep '300s' \
  --memory-mib '4096' \
  --storage-gib '10' \
  --vcpu '1'
```

### Get machine

```sh
dedalus machines retrieve \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

### Update machine

Changes settings such as autosleep.

```sh
dedalus machines update \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

### Destroy machine

```sh
dedalus machines delete \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

### Sleep a running machine

```sh
dedalus machines sleep \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

### Wake a sleeping machine

```sh
dedalus machines wake \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

### Reboot a machine with fresh memory

Checkpoints files and replaces the runtime. The machine ID and filesystem are preserved. RAM, processes, and temporary mounts are cleared. Poll the machine until its phase is running. Retry the same Idempotency-Key after a lost response.

```sh
dedalus machines reboot \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

### Resize machine

Wakes a sleeping Machine, then waits up to 30 seconds for the host to confirm CPU and RAM. Returns the Machine with its confirmed size. After RESIZE_TIMEOUT, repeat the same request and Idempotency-Key to wait again.

```sh
dedalus machines resize \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

### `Machines Ssh`

#### List SSH sessions

```sh
dedalus machines ssh list \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --max-items 10
```

#### Create SSH session

```sh
dedalus machines ssh create \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --public-key ''
```

#### Get SSH session

```sh
dedalus machines ssh retrieve \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --session-id 'session_id'
```

#### Delete SSH session

```sh
dedalus machines ssh delete \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --session-id 'session_id'
```

### `Machines Executions`

#### List executions

```sh
dedalus machines executions list \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --max-items 10
```

#### Create execution

```sh
dedalus machines executions create \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --command '[""]'
```

#### Get execution

```sh
dedalus machines executions retrieve \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --execution-id 'execution_id'
```

#### Delete execution

```sh
dedalus machines executions delete \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --execution-id 'execution_id'
```

#### Get execution output

```sh
dedalus machines executions output \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --execution-id 'execution_id'
```

#### List execution events

```sh
dedalus machines executions events \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --execution-id 'execution_id' \
  --max-items 10
```

#### `Machines Executions Logs`

##### Get execution log status

```sh
dedalus machines executions logs retrieve \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --execution-id 'execution_id'
```

##### Create execution log read token

```sh
dedalus machines executions logs create-token \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' \
  --execution-id 'execution_id'
```

### `Machines Autoresizing`

#### Read this machine's autoresizing settings

```sh
dedalus machines autoresizing retrieve \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

#### Set this machine's autoresizing settings

Changes RAM, CPU or both for this machine. An absent resource keeps its setting.

```sh
dedalus machines autoresizing update \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --machine-id '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'
```

## `Organization`

### `Organization Autoresizing`

#### Read organization autoresizing policy

```sh
dedalus organization autoresizing retrieve --browser-token "$DEDALUS_BROWSER_TOKEN"
```

#### Set organization autoresizing policy

Changes defaults copied to new Machines. Existing Machines retain their own policy.

```sh
dedalus organization autoresizing update --browser-token "$DEDALUS_BROWSER_TOKEN"
```

## `Images`

### List image IDs owned by the authenticated organization

Pages through the organization's images in ID order. A deleted image is left out; it still reads by ID.

```sh
dedalus images list --browser-token "$DEDALUS_BROWSER_TOKEN" --limit '100'
```

### Register an immutable OCI image for preparation

Requires an entitled organization and linux/amd64 on the current fleet. Acceptance queues preparation; only a ready image can launch a machine. Private registry credentials are not yet supported.

```sh
dedalus images create \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --platform 'linux/amd64' \
  --source '{"kind":""}'
```

### Read preparation status for an organization-owned image

A preparing image reports its stage, the worker's last step and an estimated percent of the whole preparation. A failed image names the cause: IMAGE_OS_UNSUPPORTED, IMAGE_SOURCE_INVALID, IMAGE_SOURCE_NOT_FOUND and IMAGE_SOURCE_UNAUTHORIZED describe the image or its reference and are final; IMAGE_SOURCE_UNAVAILABLE, IMAGE_REGISTRY_UNREACHABLE, IMAGE_REGISTRY_RATE_LIMITED, IMAGE_ARCHIVE_UNAVAILABLE and IMAGE_EXECUTION_FAILED describe this attempt and are retryable with a new idempotency key.

```sh
dedalus images retrieve --browser-token "$DEDALUS_BROWSER_TOKEN" --image-id 'image_id'
```

### Rename an organization-owned image

Changes only the name. The image's source, platform and state are immutable.

```sh
dedalus images update \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --image-id 'image_id' \
  --name ''
```

### Delete an organization-owned image

The image can create no new Machine and no longer counts against the organization's image limit. Machines already running from it keep working. The image stays readable, and deleting it again returns the same image.

```sh
dedalus images delete --browser-token "$DEDALUS_BROWSER_TOKEN" --image-id 'image_id'
```

### `Images Uploads`

#### Reserve an immutable Docker image archive upload

```sh
dedalus images uploads create \
  --browser-token "$DEDALUS_BROWSER_TOKEN" \
  --platform '' \
  --sha256 '' \
  --size-bytes '0'
```
