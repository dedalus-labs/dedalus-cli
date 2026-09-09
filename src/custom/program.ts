/** Adds Dedalus authentication to Scalar's generated command tree. */
import type { Command } from 'commander'
import { getProgram as getGeneratedProgram } from '../commands/index.js'
import { AuthenticatedCommandClient } from './client.js'
import { addDedalusCommands, formatDedalusError } from './commands.js'
import { addMachineCommands, withMachineDefaults, machineResultHandler } from './machines.js'
import { version } from './version.generated.js'

export const getProgram = (): Command => addMachineCommands(addDedalusCommands(getGeneratedProgram({
  SDK: AuthenticatedCommandClient,
  version,
  configureDefinition: withMachineDefaults,
  handleResult: machineResultHandler(),
  formatError: formatDedalusError,
})))
