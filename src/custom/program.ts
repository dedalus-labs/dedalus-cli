/** Dedalus-owned CLI assembly layered over Scalar's generated SDK. */

import type { Command } from 'commander'
import { createProgram, type CliClientOptionDefinition, type CliCommandDefinition } from '../cli/runtime.js'
import { completions } from '../cli/completions.js'
import { addDedalusCommands, formatDedalusError } from './commands.js'
import { CommandClient } from '../commands/client.js'
import { operationSpecs } from '../commands/operations.generated.js'

const clientOptions = [
  {
    "clientKey": "apiKey",
    "sdkKey": "apiKey",
    "name": "api-key",
    "optionKey": "apiKey",
    "env": "DEDALUS_API_KEY",
    "description": "API key authentication using Bearer token",
    "auth": true
  },
  {
    "clientKey": "xAPIKey",
    "sdkKey": "xAPIKey",
    "name": "x-api-key",
    "optionKey": "xApiKey",
    "env": "DEDALUS_X_API_KEY",
    "description": "API key authentication using X-API-Key header",
    "auth": true
  },
  {
    "clientKey": "bearerAuth",
    "sdkKey": "bearerAuth",
    "name": "bearer-auth",
    "optionKey": "bearerAuth",
    "env": "DEDALUS_BEARER_AUTH",
    "description": "Dedalus API key in Authorization: Bearer <key>.",
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

const commands = operationSpecs.map(({ command }) => command) satisfies readonly CliCommandDefinition[]

export const getProgram = (): Command =>
  addDedalusCommands(createProgram({
    SDK: CommandClient,
    binaryName: "dedalus",
    version: "0.1.0", // x-release-please-version
    description: "CLI for Dedalus",
    defaultFormat: "auto",
    defaultErrorFormat: "auto",
    clientOptions,
    commands,
    formatError: formatDedalusError,
    completions,
  }))
