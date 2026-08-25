/** Dedalus-owned machine command aliases layered over Scalar's generated client. */

import { Command } from 'commander'

import { CommandClient } from '../commands/client.js'
import type { ClientOptions } from '../sdk/index.js'
import { connectMachine } from './ssh.js'

const machinesCommandName = 'machines'

type MachineShape = {
  readonly autosleep?: string
  readonly memory_mib?: number
  readonly storage_gib?: number
  readonly vcpu?: number
}

export type MachineAPI = {
  readonly createMachine: (body: MachineShape) => Promise<unknown>
  readonly createSSHSession: (machineID: string, publicKey: string) => Promise<unknown>
  readonly getMachineSSHSession: (machineID: string, sessionID: string) => Promise<unknown>
}

export type MachineCommandOptions = {
  readonly api?: (options: ClientOptions) => MachineAPI
  readonly connect?: (api: MachineAPI, machineID: string) => Promise<void>
  readonly writeOutput?: (value: string) => void
}

type CreateOptions = {
  readonly autosleep?: string
  readonly connect?: boolean
  readonly memoryMib?: string
  readonly storageGib?: string
  readonly vcpu?: string
}

type GlobalOptions = {
  readonly apiKey?: ClientOptions['apiKey']
  readonly baseUrl?: string
  readonly bearerAuth?: ClientOptions['bearerAuth']
  readonly debug?: boolean
  readonly dedalusOrgId?: string
  readonly maxRetries?: string
  readonly provider?: string
  readonly providerKey?: string
  readonly providerModel?: string
  readonly timeout?: string
  readonly xApiKey?: ClientOptions['xAPIKey']
}

export const addMachineCommands = (
  program: Command,
  options: MachineCommandOptions = {},
): Command => {
  const generatedMachines = program.commands.find((command) => command.name() === machinesCommandName)
  if (generatedMachines?.commands.some((command) => command.name() === 'create')) {
    throw new Error("Scalar generated the reserved 'machines create' command")
  }

  const api = options.api ?? createMachineAPI
  const connect = options.connect ?? connectMachine
  const writeOutput = options.writeOutput ?? ((value: string) => process.stdout.write(value))
  const machines = generatedMachines ??
    new Command(machinesCommandName).description('Create and manage Dedalus Machines')
  const create = new Command('create')
    .description('Create a machine')
    .option('--connect', 'Open an interactive SSH shell after creating the machine')
    .option('--vcpu <count>', 'CPU in vCPUs')
    .option('--memory-mib <mib>', 'Memory in MiB')
    .option('--storage-gib <gib>', 'Storage in GiB')
    .option('--autosleep <duration>', 'Idle window before autosleep, or never to disable')
    .option('--base-url <url>', 'Override the base URL for API requests')
    .option('--timeout <ms>', 'Request timeout in milliseconds')
    .option('--max-retries <count>', 'Number of retries for retryable failures')
    .option('--api-key <value>', 'API key authentication using Bearer token')
    .option('--x-api-key <value>', 'API key authentication using X-API-Key header')
    .option('--bearer-auth <value>', 'Dedalus API key in Authorization: Bearer <key>')
    .option('--provider <value>', 'Provider name for BYOK mode')
    .option('--provider-key <value>', 'Provider API key for BYOK mode')
    .option('--provider-model <value>', 'Model identifier for BYOK provider')
    .option('--dedalus-org-id <value>', 'Organization ID for request scoping')
    .option('--debug', 'Enable SDK debug logging')
    .action(async (createOptions: CreateOptions, command: Command) => {
      const client = api(clientOptions(command))
      const result = await client.createMachine(machineShape(createOptions))
      const machineID = machineIDFrom(result)
      if (createOptions.connect) {
        await connect(client, machineID)
        return
      }
      writeOutput(`${JSON.stringify(result, null, 2)}\n`)
    })

  machines.addCommand(create)
  if (!generatedMachines) program.addCommand(machines)
  return program
}

export const createMachineAPI = (options: ClientOptions): MachineAPI => {
  const client = new CommandClient(options)
  return {
    createMachine: (body) => client.post('/v1/machines', { body }),
    createSSHSession: async (machineID, publicKey) => operation(client, 'createMachineSSHSession')({
      machine_id: machineID,
      public_key: publicKey,
    }),
    getMachineSSHSession: async (machineID, sessionID) => operation(client, 'getMachineSSHSession')({
      machine_id: machineID,
      session_id: sessionID,
    }),
  }
}

const operation = (
  client: CommandClient,
  name: 'createMachineSSHSession' | 'getMachineSSHSession',
): ((params: Record<string, unknown>) => unknown) => {
  const method = client.operations[name]
  if (!method) throw new Error(`Scalar generated client is missing operation '${name}'`)
  return method
}

const clientOptions = (command: Command): ClientOptions => {
  const options = command.optsWithGlobals<GlobalOptions>()
  const defaultHeaders: Record<string, string> = {
    'X-Scalar-Lang': 'cli',
    'X-Scalar-Runtime': 'cli',
    'X-Scalar-CLI-Command': command.name(),
  }
  if (options.dedalusOrgId !== undefined) {
    defaultHeaders['X-Dedalus-Org-Id'] = options.dedalusOrgId
  }
  return {
    ...(options.baseUrl !== undefined ? { baseURL: options.baseUrl } : {}),
    ...(options.timeout !== undefined ? { timeout: positiveInteger(options.timeout, 'timeout') } : {}),
    ...(options.maxRetries !== undefined
      ? { maxRetries: nonnegativeInteger(options.maxRetries, 'max-retries') }
      : {}),
    ...(options.debug ? { logLevel: 'debug' as const } : {}),
    ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
    ...(options.xApiKey !== undefined ? { xAPIKey: options.xApiKey } : {}),
    ...(options.bearerAuth !== undefined ? { bearerAuth: options.bearerAuth } : {}),
    ...(options.provider !== undefined ? { provider: options.provider } : {}),
    ...(options.providerKey !== undefined ? { providerKey: options.providerKey } : {}),
    ...(options.providerModel !== undefined ? { providerModel: options.providerModel } : {}),
    defaultHeaders,
  }
}

const machineShape = (options: CreateOptions): MachineShape => ({
  ...(options.autosleep !== undefined ? { autosleep: options.autosleep } : {}),
  ...(options.memoryMib !== undefined
    ? { memory_mib: positiveInteger(options.memoryMib, 'memory-mib') }
    : {}),
  ...(options.storageGib !== undefined
    ? { storage_gib: positiveInteger(options.storageGib, 'storage-gib') }
    : {}),
  ...(options.vcpu !== undefined ? { vcpu: positiveNumber(options.vcpu, 'vcpu') } : {}),
})

const machineIDFrom = (value: unknown): string => {
  if (!value || typeof value !== 'object') {
    throw new Error('create machine: server returned an empty response')
  }
  const machineID = (value as Record<string, unknown>).machine_id
  if (typeof machineID !== 'string' || !machineID) {
    throw new Error('create machine: server returned no machine_id')
  }
  return machineID
}

const positiveInteger = (raw: string, name: string): number => {
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer`)
  }
  return value
}

const nonnegativeInteger = (raw: string, name: string): number => {
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`--${name} must be a nonnegative integer`)
  }
  return value
}

const positiveNumber = (raw: string, name: string): number => {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`--${name} must be a positive number`)
  }
  return value
}
