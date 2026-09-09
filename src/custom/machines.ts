/** Adds default sizing and SSH orchestration to Scalar's machine commands. */
import { Command, InvalidArgumentError } from 'commander'
import SDK from '../sdk/index.js'
import type { CliCommandDefinition, CreateProgramOptions } from '../cli/runtime.js'
import { connectMachine } from './ssh.js'

export type MachineAPI = {
  readonly createSSHSession: (machineID: string, publicKey: string) => Promise<unknown>
  readonly getMachineSSHSession: (machineID: string, sessionID: string) => Promise<unknown>
}

const defaultShape = new Set(['vcpu', 'memory_mib', 'storage_gib'])

// The server accepts omitted sizing; the connected OpenAPI input still requires it.
export const withMachineDefaults = (definition: CliCommandDefinition): CliCommandDefinition => {
  if (definition.resourcePath.length !== 1 || definition.resourcePath[0] !== 'machines' || definition.methodName !== 'create') return definition
  return { ...definition, flags: definition.flags.map((flag) => defaultShape.has(flag.paramKey)
    ? { ...flag, required: false, description: (flag.description ?? '') + ' Omit to use the server default.' }
    : flag) }
}

export const addMachineCommands = (program: Command): Command => {
  const machines = program.commands.find((command) => command.name() === 'machines')
  const create = machines?.commands.find((command) => command.name() === 'create')
  if (!create) throw new Error("Scalar is missing the 'machines create' command")
  create.option('--ssh', 'Open an interactive SSH shell after creating the machine')
  for (const name of ['vcpu', 'memory-mib', 'storage-gib']) {
    const option = create.options.find((option) => option.long === '--' + name)
    if (!option) throw new Error(`Scalar is missing the '${name}' machine option`)
    option.argParser((raw: string) => {
      const value = Number(raw)
      if (!Number.isFinite(value) || value <= 0 || (name !== 'vcpu' && !Number.isSafeInteger(value))) {
        throw new InvalidArgumentError(name === 'vcpu' ? 'must be a positive number' : 'must be a positive integer')
      }
      return raw
    })
  }
  return program
}

const machineSSHAPI = (client: SDK, organizationID: string | undefined): MachineAPI => {
  const headers = organizationID === undefined ? {} : { 'X-Dedalus-Org-Id': organizationID }
  return {
    createSSHSession: (machineID, publicKey) => client.machines.ssh.create({ ...headers, machine_id: machineID, public_key: publicKey }),
    getMachineSSHSession: (machineID, sessionID) => client.machines.ssh.retrieve({ ...headers, machine_id: machineID, session_id: sessionID }),
  }
}

export const machineResultHandler = (
  connect: (api: MachineAPI, machineID: string) => Promise<void> = connectMachine,
): NonNullable<CreateProgramOptions['handleResult']> => async (result, client, command) => {
  if (command.parent?.name() !== 'machines' || command.name() !== 'create' || !command.opts<{ ssh?: boolean }>().ssh) return false
  if (!(client instanceof SDK)) throw new Error('Expected the generated Scalar SDK client')
  if (!result || typeof result !== 'object' || !('machine_id' in result) || typeof result.machine_id !== 'string' || !result.machine_id) {
    throw new Error('create machine: server returned no machine_id')
  }
  await connect(machineSSHAPI(client, command.opts<{ xDedalusOrgId?: string }>().xDedalusOrgId), result.machine_id)
  return true
}
