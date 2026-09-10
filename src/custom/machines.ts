/** Machine name shortcuts that share the CLI's authentication and output settings. */

import { Command, Option } from 'commander'
import SDK from '../sdk/index.js'
import {
  type CliClientOptionDefinition, type GlobalOptions,
  sdkClientOptions, writeOutput, writeError, errorExitCode, normalizeFormat, usageExitCode,
} from '../cli/runtime.js'

export type MachineAPI = {
  readonly renameMachine: (current: string, name: string) => Promise<unknown>
}

type AliasOptions = {
  readonly api?: (client: SDK) => MachineAPI
}

export const createMachineAPI = (client: SDK): MachineAPI => ({
  renameMachine: (current, name) => client.patch(`/v1/machines/${encodeURIComponent(current)}`, {
    body: { name },
  }),

})

export const addMachineAliases = (
  program: Command,
  clientOptions: readonly CliClientOptionDefinition[],
  options: AliasOptions = {},
): Command => {
  const makeAPI = options.api ?? createMachineAPI
  const rename = aliasCommand(program, 'rename')
    .description('Rename a machine by its current name or ID')
    .argument('<current>', 'Current machine name or ID')
    .argument('<new-name>', 'New machine name')
    .action(async (current: string, name: string, _flags: unknown, command: Command) => {
      await runAlias(command, clientOptions, async (client) => {
        const result = await makeAPI(client).renameMachine(current, name)
        if (!isRenameConfirmation(result, current, name)) {
          throw new Error('server did not confirm the requested machine name')
        }
        const flags = command.optsWithGlobals<GlobalOptions>()
        await writeOutput(result, {
          format: normalizeFormat(flags.format, 'auto'), title: 'rename',
          ...(flags.transform ? { transform: flags.transform } : {}),
          ...(flags.rawOutput ? { rawOutput: true } : {}),
        })
      })
    })
  program.addCommand(rename)
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
): Promise<void> => {
  const flags = command.optsWithGlobals<GlobalOptions & { xDedalusOrgId?: string }>()
  try {
    const client = new SDK({
      ...sdkClientOptions(flags, command, clientOptions),
      ...(flags.xDedalusOrgId ? { defaultHeaders: {
        'X-Scalar-Lang': 'cli', 'X-Scalar-Runtime': 'cli',
        'X-Scalar-CLI-Command': command.name(), 'X-Dedalus-Org-Id': flags.xDedalusOrgId,
      } } : {}),
    })
    await action(client)
  } catch (error) {
    await writeError(error, {
      format: normalizeFormat(flags.formatError, 'auto'),
      ...(flags.transformError ? { transform: flags.transformError } : {}),
      ...(flags.rawOutput ? { rawOutput: true } : {}),
    }, clientOptions, SDK)
    process.exitCode = errorExitCode(error, SDK)
  }
}

const canonicalUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u

const isRenameConfirmation = (value: unknown, current: string, name: string): boolean => {
  if (!value || typeof value !== 'object') return false
  const response = value as Record<string, unknown>
  if (typeof response.machine_id !== 'string' || !response.machine_id.startsWith('dm-') ||
      !canonicalUUID.test(response.machine_id.slice(3)) || response.name !== name) return false
  const requestedID = current.trim().replace(/^dm-/u, '').toLowerCase()
  return !canonicalUUID.test(requestedID) || response.machine_id === `dm-${requestedID}`
}
