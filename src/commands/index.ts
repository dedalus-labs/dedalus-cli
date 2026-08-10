// File generated from our OpenAPI spec by Scalar. See README.md for details.

import type { Command } from 'commander'
import SDK from '../sdk/index'
import { createProgram, type CliClientOptionDefinition, type CliCommandDefinition } from '../cli/runtime'
import { completions } from '../cli/completions'

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

const commands = [] as const satisfies readonly CliCommandDefinition[]

export const getProgram = (): Command =>
  createProgram({
    SDK,
    binaryName: "dedalus",
    version: "0.6.0", // x-release-please-version
    description: "CLI for Dedalus",
    defaultFormat: "auto",
    defaultErrorFormat: "auto",
    clientOptions,
    commands,
    completions,
  })
