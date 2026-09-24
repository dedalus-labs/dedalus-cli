/** Preserve remote argv without interpreting its flags or local file references. */
import { Command } from 'commander'
import { LiteralCliValue, usageExitCode } from '../cli/runtime.js'

export const addExecutionArguments = (program: Command): void => {
  const generated = program.commands.find((command) => command.name() === 'machines:executions')
  const machines = program.commands.find((command) => command.name() === 'machines')
  if (!generated || !machines) return
  const create = generated.commands.find((command) => command.name() === 'create')
  if (!create) throw new Error('execution create command is missing')

  create.argument('[argv...]', 'Literal remote command and arguments after --')
  const parseOptions = create.parseOptions.bind(create)
  let literal: string[] = []
  create.parseOptions = (args) => {
    const separator = args.indexOf('--')
    literal = separator < 0 ? [] : args.slice(separator + 1)
    return parseOptions(args)
  }
  create.hook('preAction', () => {
    const argv = create.processedArgs[0] as string[]
    if (argv.length === 0) return
    if (argv.length !== literal.length) create.error('use -- before a remote command', { exitCode: 2 })
    if (create.getOptionValue('command') !== undefined) {
      create.error('use either --command or arguments after --, not both', { exitCode: 2 })
    }
    if (argv[0] === '') create.error('the executable after -- must not be empty', { exitCode: 2 })
    create.setOptionValue('command', new LiteralCliValue(argv))
  })

  // Both resource spellings share the generated API handlers and options.
  machines.enablePositionalOptions()
  generated.enablePositionalOptions().alias('machines:exec')
  const nested = usageExitCode(new Command('executions'))
    .enablePositionalOptions()
    .alias('exec')
    .description('Run commands on a machine or manage executions')
    .showHelpAfterError()
  for (const command of generated.commands) {
    nested.addCommand(command)
  }
  for (const group of [generated, nested]) {
    const parse = group.parseOptions.bind(group)
    group.parseOptions = (args) => {
      const first = args[0]
      const implicit = first?.startsWith('-') && first !== '--help' && first !== '-h'
      return parse(implicit ? ['create', ...args] : args)
    }
  }
  machines.addCommand(nested)
}
