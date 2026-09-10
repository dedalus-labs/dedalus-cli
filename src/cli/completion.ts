// @custom start
/** Complete the assembled command tree, including nested resources and auth. */
import { Command, type Option } from 'commander'

const commandOptions = (command: Command): Option[] => {
  const options = [...command.options]
  let parent = command.parent
  while (parent) {
    options.push(...parent.options)
    parent = parent.parent
  }
  return options
}

export const completionCandidates = (program: Command, words: readonly string[]): string[] => {
  const prefix = words.at(-1) ?? ''
  const preceding = words.slice(0, -1)
  let command = program
  for (let index = 0; index < preceding.length; index += 1) {
    const word = preceding[index]
    if (word === undefined) break
    if (word.startsWith('-')) {
      const option = commandOptions(command).find(
        (value) => value.long === word.split('=')[0] || value.short === word,
      )
      if (!option) return []
      if (!word.includes('=') && (option.required || option.optional)) {
        if (index + 1 === preceding.length) return []
        index += 1
      }
      continue
    }
    const child = command.commands.find(
      (value) => value.name() === word || value.aliases().includes(word),
    )
    if (!child) return []
    command = child
  }
  const names = command.commands.map((child) => child.name())
  const flags = commandOptions(command).flatMap((option) =>
    [option.long, option.short].filter((flag): flag is string => flag !== undefined),
  )
  return [...new Set([...names, ...flags, '--help'])].filter((candidate) =>
    candidate.startsWith(prefix),
  )
}

const shellScript = (shell: string): string => {
  switch (shell) {
    case 'bash':
      return `__dedalus_complete() {
  local candidate
  COMPREPLY=()
  while IFS= read -r candidate; do COMPREPLY+=("$candidate"); done < <(dedalus completion query -- "\${COMP_WORDS[@]:1:COMP_CWORD}")
}
complete -F __dedalus_complete dedalus
`
    case 'zsh':
      return `#compdef dedalus
__dedalus_complete() {
  local -a candidates
  candidates=("\${(@f)$(dedalus completion query -- "\${words[@]:1:$((CURRENT - 1))}")}")
  compadd -- "\${candidates[@]}"
}
compdef __dedalus_complete dedalus
`
    case 'fish':
      return `complete -c dedalus -f -a '(dedalus completion query -- (commandline -opc)[2..-1] (commandline -ct))'
`
    default:
      throw new Error('Supported shells: bash, zsh, fish')
  }
}

export const installCompletion = (program: Command): void => {
  const completion = program.commands.find((command) => command.name() === 'completion')
  if (!completion) throw new Error('Scalar is missing the completion command')
  completion.argument('[words...]').action((shell: string, words: string[]) => {
    if (shell === 'query') {
      const candidates = completionCandidates(program, words)
      if (candidates.length > 0) process.stdout.write(candidates.join('\n') + '\n')
      return
    }
    process.stdout.write(shellScript(shell))
  })
}
// @custom end
