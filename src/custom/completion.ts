/** Complete the live command tree so custom nesting and aliases stay discoverable. */
import type { Command } from 'commander'

export const completionCandidates = (program: Command, words: readonly string[]): string[] => {
  let command = program
  const prefix = words.at(-1) ?? ''
  const previous = words.slice(0, -1)
  const options = (node: Command) => [...node.options, ...program.options]
  for (let index = 0; index < previous.length; index++) {
    const word = previous[index]!
    if (word === '--') return []
    if (word.startsWith('-')) {
      const option = options(command).find((entry) => entry.long === word.split('=')[0] || entry.short === word.split('=')[0])
      if (!option) return []
      if (!word.includes('=') && (option.required || option.optional)) {
        if (index === previous.length - 1) return option.argChoices?.filter((choice) => choice.startsWith(prefix)) ?? []
        if (option.required || !previous[index + 1]!.startsWith('-')) index++
      }
      continue
    }
    const child = command.commands.find((entry) => entry.name() === word || entry.aliases().includes(word))
    if (!child) return []
    command = child
  }
  const children = command.createHelp().visibleCommands(command)
  const candidates = [
    ...(command.name() === 'completion' ? Object.keys(scripts) : []),
    ...children.flatMap((child) => [child.name(), ...child.aliases()]),
    ...options(command).flatMap((option) => [option.short, option.long].filter((flag): flag is string => !!flag)),
    '--help',
  ]
  return [...new Set(candidates)].filter((candidate) => candidate.startsWith(prefix))
}

const scripts: Readonly<Record<string, string>> = {
  bash: `__dedalus_completion() {
  local candidate
  COMPREPLY=()
  while IFS= read -r candidate; do
    COMPREPLY+=("$candidate")
  done < <(dedalus __complete -- "\${COMP_WORDS[@]:1:COMP_CWORD}")
}
complete -F __dedalus_completion dedalus
`,
  zsh: `#compdef dedalus
_dedalus() {
  local -a candidates
  candidates=("\${(@f)$(dedalus __complete -- "\${words[@]:1}")}")
  (( \${#candidates} )) && compadd -- "\${candidates[@]}"
}
compdef _dedalus dedalus
`,
  fish: `function __dedalus_candidates
  set -l words (commandline -opc)
  set -l current (commandline -ct | string collect --allow-empty)
  dedalus __complete -- $words[2..-1] "$current"
end
complete -c dedalus -f -a '(__dedalus_candidates)'
`,
}

export const registerTreeCompletion = (program: Command): void => {
  const completion = program.commands.find((command) => command.name() === 'completion')
  if (!completion) return
  program.command('__complete', { hidden: true })
    .argument('[words...]')
    .action((words: string[]) => {
      const candidates = completionCandidates(program, words)
      if (candidates.length) process.stdout.write(candidates.join('\n') + '\n')
    })
  completion.action((shell: string) => {
    if (!Object.hasOwn(scripts, shell)) {
      process.stderr.write(`Unsupported shell '${shell}'. Supported shells: bash, zsh, fish\n`)
      process.exitCode = 2
      return
    }
    process.stdout.write(scripts[shell]!)
  })
}
