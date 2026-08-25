import { getProgram } from './program.js'

export { getProgram }

export const run = async (argv: readonly string[] = process.argv): Promise<void> => {
  await getProgram().parseAsync(argv)
}
