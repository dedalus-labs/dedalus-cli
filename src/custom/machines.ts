/** SSH selection that shares the CLI's authentication and error settings. */

import { Command, Option } from 'commander'
import SDK from '../sdk/index.js'
import type { CliAuthDefinition } from '../cli/login.js'
import {
  type CliClientOptionDefinition, type GlobalOptions,
  sdkClientOptions, writeError, errorExitCode, normalizeFormat, usageExitCode,
} from '../cli/runtime.js'
import { addExecutionArguments } from './executions.js'
import { pickSSHMachine } from './ssh-picker.js'
import { connectMachine, type SSHAPI } from './ssh.js'

export type MachineAPI = SSHAPI & {
  readonly listMachines: (cursor: string | undefined, signal: AbortSignal) => Promise<unknown>
}

type AliasOptions = {
  readonly auth?: CliAuthDefinition
  readonly api?: (client: SDK) => MachineAPI
  readonly connect?: (api: SSHAPI, machineID: string) => Promise<void>
  readonly pick?: (api: MachineAPI) => Promise<string | undefined>
  readonly interactive?: () => boolean
}

export const createMachineAPI = (client: SDK): MachineAPI => ({
  listMachines: (cursor, signal) => client.get('/v1/machines', {
    query: cursor === undefined ? {} : { cursor }, signal,
  }),
  createSSHSession: (machineID, publicKey) => client.machines.ssh.create({
    machine_id: machineID, public_key: publicKey,
  }),
  getMachineSSHSession: (machineID, sessionID) => client.machines.ssh.retrieve({
    machine_id: machineID, session_id: sessionID,
  }),
})

export const addMachineAliases = (
  program: Command,
  clientOptions: readonly CliClientOptionDefinition[],
  options: AliasOptions = {},
): Command => {
  addExecutionArguments(program)
  const makeAPI = options.api ?? createMachineAPI
  const connect = options.connect ?? connectMachine
  const pick = options.pick ?? pickSSHMachine
  const interactive = options.interactive ?? (() => Boolean(
    process.stdin.isTTY && process.stdout.isTTY && process.stderr.isTTY,
  ))
  const ssh = aliasCommand(program, 'ssh')
    .description('Choose a machine and connect over SSH, or supply its UUID')
    .argument('[machine-id]', 'Machine UUID; omitted to open the interactive picker')
    .action(async (target: string | undefined, _flags: unknown, command: Command) => {
      if (target !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(target)) {
        command.error('machine ID must be a bare UUID', { exitCode: 2 })
      }
      if (!target && !interactive()) {
        command.error('machine ID is required without an interactive terminal; usage: dedalus ssh <machine-id>', { exitCode: 2 })
      }
      await runAlias(command, clientOptions, async (client) => {
        const api = makeAPI(client)
        const machineID = target ?? await pick(api)
        if (machineID !== undefined) await connect(api, machineID)
      }, options.auth)
    })
  program.addCommand(ssh)
  return program
}

const aliasCommand = (program: Command, name: string): Command => {
  if (program.commands.some((command) => command.name() === name)) {
    throw new Error(`the reserved '${name}' command is already registered`)
  }
  const command = usageExitCode(new Command(name)).showHelpAfterError()
  // Mirror global flags so both `--api-key … ssh` and `ssh --api-key …` work.
  for (const option of program.options) {
    if (option.long !== '--version') command.addOption(new Option(option.flags, option.description))
  }
  const organization = program.commands.find((entry) => entry.name() === 'machines')
    ?.commands.find((entry) => entry.name() === 'retrieve')
    ?.options.find((option) => option.long === '--x-dedalus-org-id')
  if (organization && !command.options.some((option) => option.long === organization.long)) {
    command.addOption(new Option(organization.flags, organization.description))
  }
  return command
}

const runAlias = async (
  command: Command,
  clientOptions: readonly CliClientOptionDefinition[],
  action: (client: SDK) => Promise<void>,
  auth: CliAuthDefinition | undefined,
): Promise<void> => {
  const flags = command.optsWithGlobals<GlobalOptions & { xDedalusOrgId?: string }>()
  try {
    const client = new SDK(await sdkClientOptions(flags, command, clientOptions, auth))
    await action(client)
  } catch (error) {
    await writeError(error, {
      format: normalizeFormat(command.opts<GlobalOptions>().formatError ?? flags.formatError, 'auto'),
      ...(flags.transformError ? { transform: flags.transformError } : {}),
      ...(flags.rawOutput ? { rawOutput: true } : {}),
    }, clientOptions, SDK)
    process.exitCode = errorExitCode(error, SDK)
  }
}
