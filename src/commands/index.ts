// File generated from our OpenAPI spec by Scalar. See README.md for details.

import type { Command } from 'commander'
import SDK from '../sdk/index'
import { createProgram, type CliClientOptionDefinition, type CliCommandDefinition } from '../cli/runtime'

const clientOptions = [
  {
    "clientKey": "apiKeyAuth",
    "sdkKey": "apiKeyAuth",
    "name": "api-key-auth",
    "optionKey": "apiKeyAuth",
    "env": "API_KEY_AUTH",
    "description": "API key authentication using X-API-Key header",
    "auth": true
  },
  {
    "clientKey": "bearerAuth",
    "sdkKey": "bearerAuth",
    "name": "bearer-auth",
    "optionKey": "bearerAuth",
    "env": "BEARER_AUTH",
    "description": "Dedalus API key in Authorization: Bearer <key>.",
    "auth": true
  },
  {
    "clientKey": "bearer",
    "sdkKey": "bearer",
    "name": "bearer",
    "optionKey": "bearer",
    "env": "BEARER",
    "description": "API key authentication using Bearer token",
    "auth": true
  },
  {
    "clientKey": "provider",
    "sdkKey": "provider",
    "name": "provider",
    "optionKey": "provider",
    "env": "DEDALUS_PROVIDER",
    "description": "Provider name for BYOK mode.",
    "auth": false
  },
  {
    "clientKey": "providerKey",
    "sdkKey": "providerKey",
    "name": "provider-key",
    "optionKey": "providerKey",
    "env": "DEDALUS_PROVIDER_KEY",
    "description": "Provider API key for BYOK mode.",
    "auth": false
  },
  {
    "clientKey": "providerModel",
    "sdkKey": "providerModel",
    "name": "provider-model",
    "optionKey": "providerModel",
    "env": "DEDALUS_PROVIDER_MODEL",
    "description": "Model identifier for BYOK provider.",
    "auth": false
  }
] as const satisfies readonly CliClientOptionDefinition[]

const commands = [
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "list"
    ],
    "methodName": "list",
    "summary": "List machines",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "limit",
        "optionKey": "limit",
        "paramKey": "limit",
        "location": "query",
        "required": false,
        "valueKind": "integer"
      },
      {
        "name": "cursor",
        "optionKey": "cursor",
        "paramKey": "cursor",
        "location": "query",
        "required": false,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "create"
    ],
    "methodName": "create",
    "summary": "Create machine",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      },
      {
        "name": "autosleep",
        "optionKey": "autosleep",
        "paramKey": "autosleep",
        "location": "body",
        "required": false,
        "description": "Idle window before autosleep. Accepts fixed duration units like 30s, 30m, 2h, 7d3h4s, or 1w3d, raw seconds (\"1800\"), or never to disable.",
        "valueKind": "string"
      },
      {
        "name": "memory-mib",
        "optionKey": "memoryMib",
        "paramKey": "memory_mib",
        "location": "body",
        "required": true,
        "description": "Memory in MiB.",
        "valueKind": "integer"
      },
      {
        "name": "storage-gib",
        "optionKey": "storageGib",
        "paramKey": "storage_gib",
        "location": "body",
        "required": true,
        "description": "Storage in GiB.",
        "valueKind": "integer"
      },
      {
        "name": "vcpu",
        "optionKey": "vcpu",
        "paramKey": "vcpu",
        "location": "body",
        "required": true,
        "description": "CPU in vCPUs.",
        "valueKind": "number"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "delete"
    ],
    "methodName": "delete",
    "summary": "Destroy machine",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "retrieve"
    ],
    "methodName": "retrieve",
    "summary": "Get machine",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "patch"
    ],
    "methodName": "patch",
    "summary": "Update machine",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      },
      {
        "name": "autosleep",
        "optionKey": "autosleep",
        "paramKey": "autosleep",
        "location": "body",
        "required": false,
        "description": "Idle window before autosleep. Accepts fixed duration units like 30s, 30m, 2h, 7d3h4s, or 1w3d, raw seconds (\"1800\"), or never to disable.",
        "valueKind": "string"
      },
      {
        "name": "memory-mib",
        "optionKey": "memoryMib",
        "paramKey": "memory_mib",
        "location": "body",
        "required": false,
        "description": "Memory in MiB.",
        "valueKind": "integer"
      },
      {
        "name": "storage-gib",
        "optionKey": "storageGib",
        "paramKey": "storage_gib",
        "location": "body",
        "required": false,
        "description": "Storage in GiB.",
        "valueKind": "integer"
      },
      {
        "name": "vcpu",
        "optionKey": "vcpu",
        "paramKey": "vcpu",
        "location": "body",
        "required": false,
        "description": "CPU in vCPUs.",
        "valueKind": "number"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "list-artifacts"
    ],
    "methodName": "listArtifacts",
    "summary": "List artifacts",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "limit",
        "optionKey": "limit",
        "paramKey": "limit",
        "location": "query",
        "required": false,
        "valueKind": "integer"
      },
      {
        "name": "cursor",
        "optionKey": "cursor",
        "paramKey": "cursor",
        "location": "query",
        "required": false,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "delete-artifact"
    ],
    "methodName": "deleteArtifact",
    "summary": "Delete artifact",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "artifact-id",
        "optionKey": "artifactId",
        "paramKey": "artifact_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "retrieve-artifact"
    ],
    "methodName": "retrieveArtifact",
    "summary": "Get artifact",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "artifact-id",
        "optionKey": "artifactId",
        "paramKey": "artifact_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "list-executions"
    ],
    "methodName": "listExecutions",
    "summary": "List executions",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "limit",
        "optionKey": "limit",
        "paramKey": "limit",
        "location": "query",
        "required": false,
        "valueKind": "integer"
      },
      {
        "name": "cursor",
        "optionKey": "cursor",
        "paramKey": "cursor",
        "location": "query",
        "required": false,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "create-execution"
    ],
    "methodName": "createExecution",
    "summary": "Create execution",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      },
      {
        "name": "command",
        "optionKey": "command",
        "paramKey": "command",
        "location": "body",
        "required": true,
        "valueKind": "array"
      },
      {
        "name": "cwd",
        "optionKey": "cwd",
        "paramKey": "cwd",
        "location": "body",
        "required": false,
        "valueKind": "string"
      },
      {
        "name": "env",
        "optionKey": "env",
        "paramKey": "env",
        "location": "body",
        "required": false,
        "valueKind": "object"
      },
      {
        "name": "stdin",
        "optionKey": "stdin",
        "paramKey": "stdin",
        "location": "body",
        "required": false,
        "valueKind": "string"
      },
      {
        "name": "timeout-ms",
        "optionKey": "timeoutMs",
        "paramKey": "timeout_ms",
        "location": "body",
        "required": false,
        "valueKind": "integer"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "delete-execution"
    ],
    "methodName": "deleteExecution",
    "summary": "Delete execution",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "execution-id",
        "optionKey": "executionId",
        "paramKey": "execution_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "retrieve-execution"
    ],
    "methodName": "retrieveExecution",
    "summary": "Get execution",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "execution-id",
        "optionKey": "executionId",
        "paramKey": "execution_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "list-execution-events"
    ],
    "methodName": "listExecutionEvents",
    "summary": "List execution events",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "execution-id",
        "optionKey": "executionId",
        "paramKey": "execution_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "limit",
        "optionKey": "limit",
        "paramKey": "limit",
        "location": "query",
        "required": false,
        "valueKind": "integer"
      },
      {
        "name": "cursor",
        "optionKey": "cursor",
        "paramKey": "cursor",
        "location": "query",
        "required": false,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "list-execution-output"
    ],
    "methodName": "listExecutionOutput",
    "summary": "Get execution output",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "execution-id",
        "optionKey": "executionId",
        "paramKey": "execution_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "list-previews"
    ],
    "methodName": "listPreviews",
    "summary": "List previews",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "limit",
        "optionKey": "limit",
        "paramKey": "limit",
        "location": "query",
        "required": false,
        "valueKind": "integer"
      },
      {
        "name": "cursor",
        "optionKey": "cursor",
        "paramKey": "cursor",
        "location": "query",
        "required": false,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "create-preview"
    ],
    "methodName": "createPreview",
    "summary": "Create preview",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      },
      {
        "name": "port",
        "optionKey": "port",
        "paramKey": "port",
        "location": "body",
        "required": true,
        "valueKind": "integer"
      },
      {
        "name": "protocol",
        "optionKey": "protocol",
        "paramKey": "protocol",
        "location": "body",
        "required": false,
        "valueKind": "string"
      },
      {
        "name": "visibility",
        "optionKey": "visibility",
        "paramKey": "visibility",
        "location": "body",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "delete-preview"
    ],
    "methodName": "deletePreview",
    "summary": "Delete preview",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "preview-id",
        "optionKey": "previewId",
        "paramKey": "preview_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "retrieve-preview"
    ],
    "methodName": "retrievePreview",
    "summary": "Get preview",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "preview-id",
        "optionKey": "previewId",
        "paramKey": "preview_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "sleep"
    ],
    "methodName": "sleep",
    "summary": "Sleep a running machine",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "list-ssh-sessions"
    ],
    "methodName": "listSSHSessions",
    "summary": "List SSH sessions",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "limit",
        "optionKey": "limit",
        "paramKey": "limit",
        "location": "query",
        "required": false,
        "valueKind": "integer"
      },
      {
        "name": "cursor",
        "optionKey": "cursor",
        "paramKey": "cursor",
        "location": "query",
        "required": false,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "create-ssh-session"
    ],
    "methodName": "createSSHSession",
    "summary": "Create SSH session",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      },
      {
        "name": "public-key",
        "optionKey": "publicKey",
        "paramKey": "public_key",
        "location": "body",
        "required": true,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "delete-ssh-session"
    ],
    "methodName": "deleteSSHSession",
    "summary": "Delete SSH session",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "session-id",
        "optionKey": "sessionId",
        "paramKey": "session_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "retrieve-ssh-session"
    ],
    "methodName": "retrieveSSHSession",
    "summary": "Get SSH session",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "session-id",
        "optionKey": "sessionId",
        "paramKey": "session_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "watch-status"
    ],
    "methodName": "watchStatus",
    "summary": "Watch machine lifecycle status",
    "description": "Streams machine lifecycle updates over Server-Sent Events. Each `status` event contains a full `LifecycleResponse` payload. The stream closes after the machine reaches its current desired state.",
    "transport": "http",
    "streaming": "sse",
    "iterable": true,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "description": "Machine identifier.",
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "description": "Organization ID header applied to all DCS requests.",
        "valueKind": "string"
      },
      {
        "name": "last-event-id",
        "optionKey": "lastEventId",
        "paramKey": "Last-Event-ID",
        "location": "header",
        "required": false,
        "description": "Optional resourceVersion bookmark used to resume a previous stream.",
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "list-terminals"
    ],
    "methodName": "listTerminals",
    "summary": "List terminals",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "limit",
        "optionKey": "limit",
        "paramKey": "limit",
        "location": "query",
        "required": false,
        "valueKind": "integer"
      },
      {
        "name": "cursor",
        "optionKey": "cursor",
        "paramKey": "cursor",
        "location": "query",
        "required": false,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "create-terminal"
    ],
    "methodName": "createTerminal",
    "summary": "Create terminal",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      },
      {
        "name": "cwd",
        "optionKey": "cwd",
        "paramKey": "cwd",
        "location": "body",
        "required": false,
        "valueKind": "string"
      },
      {
        "name": "env",
        "optionKey": "env",
        "paramKey": "env",
        "location": "body",
        "required": false,
        "valueKind": "object"
      },
      {
        "name": "height",
        "optionKey": "height",
        "paramKey": "height",
        "location": "body",
        "required": true,
        "valueKind": "integer"
      },
      {
        "name": "shell",
        "optionKey": "shell",
        "paramKey": "shell",
        "location": "body",
        "required": false,
        "valueKind": "string"
      },
      {
        "name": "width",
        "optionKey": "width",
        "paramKey": "width",
        "location": "body",
        "required": true,
        "valueKind": "integer"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "delete-terminal"
    ],
    "methodName": "deleteTerminal",
    "summary": "Delete terminal",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "terminal-id",
        "optionKey": "terminalId",
        "paramKey": "terminal_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "retrieve-terminal"
    ],
    "methodName": "retrieveTerminal",
    "summary": "Get terminal",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "terminal-id",
        "optionKey": "terminalId",
        "paramKey": "terminal_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "connect-terminal"
    ],
    "methodName": "connectTerminal",
    "summary": "Connect to terminal WebSocket stream",
    "description": "Upgrades to a WebSocket connection for interactive terminal I/O. Clients send JSON `TerminalClientEvent` messages and receive JSON `TerminalServerEvent` messages. Terminal byte streams are base64-encoded inside `input` and `output` events; `resize` events use integer `width` and `height` fields.",
    "transport": "websocket",
    "iterable": true,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "description": "Machine identifier.",
        "valueKind": "string"
      },
      {
        "name": "terminal-id",
        "optionKey": "terminalId",
        "paramKey": "terminal_id",
        "location": "path",
        "required": true,
        "description": "Terminal identifier.",
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "description": "Organization ID header applied to all DCS requests.",
        "valueKind": "string"
      },
      {
        "name": "send",
        "optionKey": "send",
        "paramKey": "send",
        "location": "body",
        "required": false,
        "description": "JSON message to send after connecting.",
        "valueKind": "unknown"
      }
    ]
  },
  {
    "resourcePath": [
      "machineLifecycle"
    ],
    "commandPath": [
      "machine-lifecycle",
      "wake"
    ],
    "methodName": "wake",
    "summary": "Wake a sleeping machine",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "path",
        "required": true,
        "valueKind": "string"
      },
      {
        "name": "x-dedalus-org-id",
        "optionKey": "xDedalusOrgId",
        "paramKey": "X-Dedalus-Org-Id",
        "location": "header",
        "required": false,
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "usage"
    ],
    "commandPath": [
      "usage",
      "list"
    ],
    "methodName": "list",
    "summary": "Get usage summary",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "period-start",
        "optionKey": "periodStart",
        "paramKey": "period_start",
        "location": "query",
        "required": false,
        "description": "Billing period start (YYYY-MM-DD). Defaults to first of current month.",
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "usage",
      "machines"
    ],
    "commandPath": [
      "usage:machines",
      "list-compute-usage"
    ],
    "methodName": "listComputeUsage",
    "summary": "List machine compute usage breakdown",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "period-start",
        "optionKey": "periodStart",
        "paramKey": "period_start",
        "location": "query",
        "required": false,
        "description": "Usage period start (YYYY-MM-DD). Defaults to first of current month.",
        "valueKind": "string"
      },
      {
        "name": "period-end",
        "optionKey": "periodEnd",
        "paramKey": "period_end",
        "location": "query",
        "required": false,
        "description": "Last UTC usage date to include (YYYY-MM-DD). Defaults to current time.",
        "valueKind": "string"
      },
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "query",
        "required": false,
        "description": "Optional machine ID filter.",
        "valueKind": "string"
      },
      {
        "name": "granularity",
        "optionKey": "granularity",
        "paramKey": "granularity",
        "location": "query",
        "required": false,
        "description": "Usage breakdown granularity: hour or day. Defaults to hour.",
        "valueKind": "string"
      }
    ]
  },
  {
    "resourcePath": [
      "usage",
      "machines"
    ],
    "commandPath": [
      "usage:machines",
      "list-storage-usage"
    ],
    "methodName": "listStorageUsage",
    "summary": "List machine storage usage breakdown",
    "transport": "http",
    "iterable": false,
    "callShape": "params",
    "positional": [],
    "flags": [
      {
        "name": "period-start",
        "optionKey": "periodStart",
        "paramKey": "period_start",
        "location": "query",
        "required": false,
        "description": "Usage period start (YYYY-MM-DD). Defaults to first of current month.",
        "valueKind": "string"
      },
      {
        "name": "period-end",
        "optionKey": "periodEnd",
        "paramKey": "period_end",
        "location": "query",
        "required": false,
        "description": "Last UTC usage date to include (YYYY-MM-DD). Defaults to current time.",
        "valueKind": "string"
      },
      {
        "name": "machine-id",
        "optionKey": "machineId",
        "paramKey": "machine_id",
        "location": "query",
        "required": false,
        "description": "Optional machine ID filter.",
        "valueKind": "string"
      }
    ]
  }
] as const satisfies readonly CliCommandDefinition[]

export const getProgram = (): Command =>
  createProgram({
    SDK,
    binaryName: "dedalus",
    version: "0.1.4",
    description: "CLI for Dedalus",
    defaultFormat: "auto",
    defaultErrorFormat: "auto",
    clientOptions,
    commands,
  })
