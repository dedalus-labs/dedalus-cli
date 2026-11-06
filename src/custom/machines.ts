/** SSH selection that shares the CLI's authentication and error settings. */

import { Command, Option } from 'commander'
import { closeSync, openSync } from 'node:fs'
import SDK from '../sdk/index.js'
import type { CliAuthDefinition } from '../cli/login.js'
import {
  type CliClientOptionDefinition, type CreateProgramOptions, type GlobalOptions,
  sdkClientOptions, writeError, errorExitCode, normalizeFormat, usageExitCode,
} from '../cli/runtime.js'
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

const terminalInputs = new WeakMap<Command, number>()

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
  const create = program.commands.find((command) => command.name() === 'machines')
    ?.commands.find((command) => command.name() === 'create')
  create?.option('--ssh', 'Open an interactive SSH shell after creating the machine')
    .hook('preAction', (command) => {
      if (!command.opts<{ ssh?: boolean }>().ssh || process.stdin.isTTY) return
      try {
        terminalInputs.set(command, openSync(process.platform === 'win32' ? 'CONIN$' : '/dev/tty', 'r'))
      } catch {
        command.error('--ssh requires a controlling terminal; run create without --ssh for noninteractive use', { exitCode: 2 })
      }
    })
    .hook('postAction', (command) => {
      const input = terminalInputs.get(command)
      if (input !== undefined) closeSync(input)
      terminalInputs.delete(command)
    })
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

export const handleMachineResult: NonNullable<CreateProgramOptions['handleResult']> = async (
  result, client, command,
) => {
  if (command.parent?.name() !== 'machines' || command.name() !== 'create' ||
      !command.opts<{ ssh?: boolean }>().ssh) {
    return false
  }
  if (!(client instanceof SDK)) throw new Error('machine SSH requires the generated SDK client')
  if (!result || typeof result !== 'object' || !('machine_id' in result) ||
      typeof result.machine_id !== 'string' || !result.machine_id) {
    throw new Error('create machine: server returned no machine_id')
  }
  process.stderr.write(reconnectHint(client, command, result.machine_id))
  await connectMachine(createMachineAPI(client), result.machine_id, terminalInputs.get(command))
  return true
}

const reconnectHint = (client: SDK, command: Command, machineID: string): string => {
  const settings = ['dedalus', 'ssh', shellQuote(machineID), '--base-url']
  const instructions: string[] = []
  const endpoint = new URL(client.baseURL)
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    settings.push(environmentReference('DEDALUS_BASE_URL'))
    instructions.push('Set DEDALUS_BASE_URL to the same endpoint used for creation.')
  } else {
    settings.push(shellQuote(client.baseURL))
  }
  if (client.dedalusOrgID) settings.push('--dedalus-org-id', shellQuote(client.dedalusOrgID))
  const flags = command.optsWithGlobals<Record<string, unknown>>()
  for (const [key, flag, variable] of [
    ['apiKey', '--api-key', 'DEDALUS_API_KEY'],
    ['xApiKey', '--x-api-key', 'DEDALUS_X_API_KEY'],
    ['browserToken', '--browser-token', 'DEDALUS_BROWSER_TOKEN'],
  ] as const) {
    const value = flags[key]
    if (typeof value !== 'string') continue
    if (value.startsWith('@')) {
      settings.push(flag, shellQuote(value))
    } else {
      settings.push(flag, environmentReference(variable))
      instructions.push(`Set ${variable} to the same credential supplied with ${flag}.`)
    }
  }
  instructions.push('Reuse the environment credentials or saved login from the same shell.')
  return `Created machine ${machineID}. Reconnect with: ${settings.join(' ')}\n${instructions.join('\n')}\n`
}

const shellQuote = (value: string): string => {
  if (/^[\w./:@=-]+$/u.test(value)) return value
  const escaped = process.platform === 'win32' ? value.replaceAll("'", "''") : value.replaceAll("'", "'\"'\"'")
  return `'${escaped}'`
}

const environmentReference = (name: string): string =>
  process.platform === 'win32' ? `"$env:${name}"` : `"$${name}"`

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
