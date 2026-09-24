/** Updates only installations whose package manager ownership can be proved. */
import { execFileSync, spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { join, relative, isAbsolute } from 'node:path'
import { Command } from 'commander'

const latestURL = 'https://api.github.com/repos/dedalus-labs/dedalus-cli/releases/latest'

type Effects = {
  current: string
  entry: string
  executable: string
  platform: string
  latest: () => Promise<string>
  realpath: (path: string) => string
  output: (name: string, args: string[]) => string
  run: (name: string, args: string[]) => void
  print: (message: string) => void
}

// Only stable release numbers authorize an installation change. Development and
// prerelease builds need an explicit package-manager command from their owner.
export const newerStable = (candidate: string, current: string): boolean => {
  const parse = (value: string) => {
    if (!/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(value)) return undefined
    return value.replace(/^v/u, '').split('.').map(BigInt)
  }
  const next = parse(candidate)
  const previous = parse(current)
  if (!next || !previous) throw new Error('Cannot safely compare release versions; update with your original package manager.')
  for (let i = 0; i < 3; i++) {
    if (next[i]! !== previous[i]!) return next[i]! > previous[i]!
  }
  return false
}

const within = (path: string, directory: string): boolean => {
  const child = relative(directory, path)
  return child !== '' && child !== '..' && !child.startsWith('../') && !child.startsWith('..\\') && !isAbsolute(child)
}

export const updateCLI = async (check: boolean, effects: Effects): Promise<void> => {
  const latest = await effects.latest()
  effects.print(`Current version: ${effects.current}\nLatest version:  ${latest}`)
  const newer = newerStable(latest, effects.current)
  if (!newer) {
    effects.print('The installed version is current or newer than the latest stable release.')
    return
  }
  if (check) return
  const version = latest.replace(/^v/u, '')
  const query = (name: string, args: string[]): string | undefined => {
    try { return effects.output(name, args).trim() || undefined } catch { return undefined }
  }
  const resolve = (path: string): string | undefined => {
    try { return effects.realpath(path) } catch { return undefined }
  }
  const executable = resolve(effects.executable)
  const entry = resolve(effects.entry)

  // A Node launch updates the package, never process.execPath (the Node runtime).
  if (entry && effects.platform !== 'win32') {
    const root = query('npm', ['root', '--global'])
    const installedEntry = root && resolve(join(root, 'dedalus-cli', 'dist', 'esm', 'bin.js'))
    if (installedEntry === entry) {
      const published = query('npm', ['view', `dedalus-cli@${version}`, 'version'])
      if (published !== version) throw new Error(`Release ${version} is not available from npm yet; no changes made.`)
      effects.print(`Running: npm install --global dedalus-cli@${version}`)
      effects.run('npm', ['install', '--global', `dedalus-cli@${version}`])
      return
    }
  }
  if (executable && effects.platform !== 'win32') {
    const formula = query('brew', ['--prefix', 'dedalus'])
    const prefix = formula && resolve(formula)
    if (prefix && within(executable, prefix)) {
      effects.run('brew', ['update'])
      const info = query('brew', ['info', '--json=v2', '--formula', 'dedalus'])
      const available: unknown = info ? JSON.parse(info) : undefined
      const formulaVersion = (available as { formulae?: { versions?: { stable?: string } }[] } | undefined)?.formulae?.[0]?.versions?.stable
      if (formulaVersion !== version) throw new Error(`Homebrew has not published ${version}; no package upgrade performed.`)
      effects.print('Running: brew upgrade --formula dedalus')
      effects.run('brew', ['upgrade', '--formula', 'dedalus'])
      return
    }
  }
  effects.print('Automatic update is unavailable for this installation. Update with the package manager you originally used. For standalone binaries, download the matching release at https://github.com/dedalus-labs/dedalus-cli/releases/latest and replace the CLI after it exits.')
}

export const registerUpdateCommand = (program: Command): Command => {
  program.command('update').description('Update the CLI using its owning package manager')
    .option('--check', 'Check for a newer stable release without installing')
    .action(async (flags: { check?: boolean }, command: Command) => {
      try {
        await updateCLI(Boolean(flags.check), {
          current: program.version() ?? '', entry: process.argv[1] ?? '',
          executable: process.execPath, platform: process.platform,
          latest: async () => {
            const response = await fetch(latestURL, { signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/vnd.github+json' } })
            if (!response.ok) throw new Error(`Release check failed: HTTP ${response.status}`)
            const release: unknown = await response.json()
            if (typeof release !== 'object' || release === null || !('tag_name' in release) || typeof release.tag_name !== 'string') throw new Error('Release response is missing tag_name')
            return release.tag_name
          },
          realpath: realpathSync,
          output: (name, args) => execFileSync(name, args, { encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'ignore'] }),
          run: (name, args) => {
            const result = spawnSync(name, args, { stdio: 'inherit' })
            if (result.error) throw result.error
            if (result.status !== 0) throw new Error(`${name} failed${result.signal ? ` (${result.signal})` : ` (exit ${result.status})`}`)
          },
          print: (message) => console.log(message),
        })
      } catch (error) {
        command.error(error instanceof Error ? error.message : String(error), { exitCode: 1 })
      }
    })
  return program
}
