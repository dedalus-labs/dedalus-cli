// @custom
/** Extend execution syntax while retaining the generated request path. */
import type { Command } from 'commander'

const argumentSeparator = (command: Command, args: string[]): number => {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--') return index
    const option = command.options.find((option) => option.long === arg || option.short === arg)
    if (option?.required) index += 1
  }
  return -1
}

export const addExecutionCommands = (program: Command): void => {
  const machines = program.commands.find((command) => command.name() === 'machines')
  const executions = machines?.commands.find((command) => command.name() === 'executions')
  const create = executions?.commands.find((command) => command.name() === 'create')
  if (!machines || !executions || !create) throw new Error('Missing machines executions create command')

  machines.enablePositionalOptions()
  executions.enablePositionalOptions().alias('exec')
  executions.action(() => executions.help())
  create.usage('[options] [-- <executable> [args...]]')
  executions.addHelpText('after', '\nOmit create to start an execution:\n' + create.helpInformation())

  // Route shorthand before Commander discards --, so a remote executable named list
  // cannot select the list subcommand. Explicit subcommands keep their own parser.
  const parseResource = executions.parseOptions.bind(executions)
  executions.parseOptions = (args) => {
    const first = args[0]
    const shorthand = first?.startsWith('-') && first !== '--help' && first !== '-h'
    return parseResource(shorthand ? ['create', ...args] : args)
  }

  const parseCreate = create.parseOptions.bind(create)
  create.parseOptions = (args) => {
    const separator = argumentSeparator(create, args)
    if (separator === -1) return parseCreate(args)
    const parsed = parseCreate(args.slice(0, separator))
    const argv = args.slice(separator + 1)
    if (!argv[0]) create.error('error: expected a nonempty executable after --', { exitCode: 2 })
    if (create.getOptionValue('command') !== undefined) {
      create.error('error: --command cannot be combined with arguments after --', { exitCode: 2 })
    }
    // JSON encoding preserves argv boundaries through the existing array-valued flag.
    create.setOptionValueWithSource('command', JSON.stringify(argv), 'cli')
    return parsed
  }
}
