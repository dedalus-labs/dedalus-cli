// @custom start
/** Assemble authentication around Scalar's generated command tree. */
import type { Command } from 'commander'
import { getProgram as getGeneratedProgram } from '../commands/index.js'
import { AuthenticatedCommandClient } from '../auth/client.js'
import { addDedalusCommands, formatDedalusError } from '../auth/commands.js'
import { installCompletion } from './completion.js'
import { version } from './version.generated.js'

export const getProgram = (): Command => {
  const program = getGeneratedProgram({
    SDK: AuthenticatedCommandClient,
    version,
    formatError: formatDedalusError,
  })
  addDedalusCommands(program)
  installCompletion(program)
  return program
}
// @custom end
