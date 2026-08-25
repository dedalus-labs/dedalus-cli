/**
 * Dedalus-owned commands and authentication for the generated command-line interface.
 *
 * Scalar generates resource commands. This adapter adds `auth`, selects one
 * credential, and maps authentication failures without exposing secrets.
 */

import { Command } from 'commander'

import {
  CredentialStorageError,
  defaultCredentialStore,
  hasCredentialCustomHeader,
  type CredentialStore,
} from './auth/credentials.js'
import { createClerkAuthProvider } from './auth/oauth.js'
import {
  formatDedalusError,
  loginOutput,
  logoutOutput,
  recordCredentialSource,
  runAuthAction,
  type SelectedCredential,
  statusOutput,
} from './auth/output.js'
import { AuthProviderError, type AuthProvider } from './auth/types.js'
import { addMachineCommands, type MachineCommandOptions } from './machines.js'
import {
  accessTokenForCommand,
  type AuthStatus,
  login,
  type LoginResult,
  logout,
  type LogoutResult,
  selectedCredential,
  status,
} from './auth/workflow.js'

const authCommandName = 'auth'
const completionCommandName = 'completion'
const defaultClerkIssuer = 'https://neat-gator-21.clerk.accounts.dev'
const defaultClerkClientID = 'W27FJtdP5VDfKMTv'
const defaultSignInURL = 'https://dev.dedaluslabs.ai/cli/sign-in'
const developmentGatewayURL = 'https://dev.admin.api.dedaluslabs.ai/dcs'

export { formatDedalusError }

type AuthOperations = {
  readonly login: () => Promise<LoginResult>
  readonly status: (
    flags: { readonly apiKey?: string; readonly bearerAuth?: string; readonly xApiKey?: string },
    offline: boolean,
  ) => Promise<AuthStatus>
  readonly logout: () => Promise<LogoutResult>
}

type AuthCommandDependencies = {
  readonly environment: Readonly<Record<string, string | undefined>>
  readonly operations: () => AuthOperations
  readonly writeError: (value: string) => void
  readonly writeOutput: (value: string) => void
}

export type DedalusCommandOptions = {
  readonly auth?: () => AuthOperations
  readonly authProvider?: () => AuthProvider
  readonly credentialStore?: () => CredentialStore
  readonly environment?: Readonly<Record<string, string | undefined>>
  readonly writeOutput?: (value: string) => void
  readonly writeError?: (value: string) => void
  readonly machines?: MachineCommandOptions
}

// addDedalusCommands is the boundary between generated resource commands and
// Dedalus-owned authentication behavior. Scalar regeneration must preserve it.
export const addDedalusCommands = (
  program: Command,
  options: DedalusCommandOptions = {},
): Command => {
  if (program.commands.some((command) => command.name() === authCommandName)) {
    throw new Error(`Scalar generated the reserved '${authCommandName}' command`)
  }

  const environment = options.environment ?? process.env
  let stored: CredentialStore | undefined
  const credentialStore = options.credentialStore ?? (() => {
    stored ??= defaultCredentialStore({ environment })
    return stored
  })
  let configuredProvider: AuthProvider | undefined
  const authProvider = options.authProvider ?? (() => {
    configuredProvider ??= defaultAuthProvider(environment)
    return configuredProvider
  })
  const operations = options.auth ?? (() => defaultAuthOperations(
    environment,
    credentialStore,
    authProvider,
  ))
  const writeOutput = options.writeOutput ?? ((value) => process.stdout.write(value))
  const writeError = options.writeError ?? ((value) => process.stderr.write(value))
  const authCommand = createAuthCommand({ environment, operations, writeError, writeOutput })
  addMachineCommands(program, { ...options.machines, writeOutput })
  installJSONConvenience(program, new Set([authCommand]))
  const completionCommand = program.commands.find((command) => command.name() === completionCommandName)
  program.addCommand(authCommand)
  installCredentialInjection({
    program,
    environment,
    credentialStore,
    authProvider,
    exemptCommands: new Set([authCommand, ...(completionCommand ? [completionCommand] : [])]),
  })
  return program
}

const createAuthCommand = ({
  environment,
  operations,
  writeError,
  writeOutput,
}: AuthCommandDependencies): Command => {
  const auth = new Command(authCommandName).description('Manage the stored Dedalus CLI login')

  auth.command('login')
    .description('Sign in through Clerk and store the OAuth session')
    .option('--json', 'Print structured JSON output')
    .action(async (_commandOptions: unknown, command: Command) => runAuthAction({
      action: async () => loginOutput(await operations().login()),
      source: 'oauth_session',
      json: jsonRequested(command),
      writeOutput,
      writeError,
    }))

  auth.command('status')
    .description('Show the active credential source without revealing secrets')
    .option('--api-key <value>', 'Inspect an explicit Bearer API-key override')
    .option('--x-api-key <value>', 'Inspect an explicit X-API-Key override')
    .option('--offline', 'Read stored session metadata without contacting Clerk')
    .option('--json', 'Print structured JSON output')
    .action(async (
      commandOptions: { readonly json?: boolean; readonly offline?: boolean },
      command: Command,
    ) => {
      const flags = command.optsWithGlobals<{
        readonly apiKey?: string
        readonly bearerAuth?: string
        readonly xApiKey?: string
      }>()
      return runAuthAction({
        action: async () => statusOutput(await operations().status(flags, Boolean(commandOptions.offline))),
        source: intendedCredential(flags, environment).source,
        json: jsonRequested(command),
        writeOutput,
        writeError,
      })
    })

  auth.command('logout')
    .description('Revoke the provider token when possible and remove local tokens')
    .option('--json', 'Print structured JSON output')
    .action(async (_commandOptions: unknown, command: Command) => runAuthAction({
      action: async () => logoutOutput(await operations().logout()),
      source: 'oauth_session',
      json: jsonRequested(command),
      writeOutput,
      writeError,
    }))

  auth.action(() => auth.help())
  return auth
}

const installJSONConvenience = (
  program: Command,
  exemptCommands: ReadonlySet<Command>,
): void => {
  if (!program.options.some((option) => option.long === '--json')) {
    program.option('--json', 'Print structured JSON output')
  }
  const visit = (command: Command): void => {
    if (
      command.options.some((option) => option.long === '--format') &&
      !command.options.some((option) => option.long === '--json')
    ) {
      command.option('--json', 'Print structured JSON output')
    }
    for (const child of command.commands) visit(child)
  }
  for (const command of program.commands) visit(command)

  program.hook('preAction', async (_root, action) => {
    if ([...exemptCommands].some((command) => belongsTo(action, command)) || !jsonRequested(action)) return
    setCommandOption(action, 'format', 'json')
    setCommandOption(action, 'formatError', 'json')
  })
}

const jsonRequested = (command: Command): boolean =>
  Boolean(command.optsWithGlobals<{ readonly json?: boolean }>().json)

const defaultAuthProvider = (
  environment: Readonly<Record<string, string | undefined>>,
): AuthProvider => createClerkAuthProvider(cliAuthConfiguration(environment))

const defaultAuthOperations = (
  environment: Readonly<Record<string, string | undefined>>,
  store: () => CredentialStore,
  provider: () => AuthProvider,
): AuthOperations => ({
  login: () => login({ provider: provider(), store: store() }),
  status: (flags, offline) => status({ flags, environment }, store, provider, offline),
  logout: () => logout(store(), provider),
})

export const cliAuthConfiguration = (
  environment: Readonly<Record<string, string | undefined>>,
): {
  readonly issuer: string
  readonly clientId: string
  readonly signInURL: string
} => {
  const issuerOverride = environment.DEDALUS_CLERK_ISSUER
  const clientIDOverride = environment.DEDALUS_CLERK_CLIENT_ID
  if (
    (issuerOverride !== undefined && issuerOverride !== defaultClerkIssuer) ||
    (clientIDOverride !== undefined && clientIDOverride !== defaultClerkClientID)
  ) {
    throw new AuthProviderError('invalid_configuration')
  }
  const signInURL = cliSignInURL(environment.DEDALUS_SIGN_IN_URL ?? defaultSignInURL)
  return {
    issuer: defaultClerkIssuer,
    clientId: defaultClerkClientID,
    signInURL,
  }
}

const cliSignInURL = (raw: string): string => {
  if (raw === defaultSignInURL) return raw
  try {
    const value = new URL(raw)
    if (
      value.protocol !== 'http:' ||
      (value.hostname !== '127.0.0.1' && value.hostname !== 'localhost') ||
      value.username ||
      value.password ||
      value.search ||
      value.hash ||
      value.pathname !== '/cli/sign-in'
    ) {
      throw new AuthProviderError('invalid_configuration')
    }
    return value.toString()
  } catch (error) {
    if (error instanceof AuthProviderError) throw error
    throw new AuthProviderError('invalid_configuration', { cause: error })
  }
}

type CredentialInjectionDependencies = {
  readonly program: Command
  readonly environment: Readonly<Record<string, string | undefined>>
  readonly credentialStore: () => CredentialStore
  readonly authProvider: () => AuthProvider
  readonly exemptCommands: ReadonlySet<Command>
}

const installCredentialInjection = ({
  program,
  environment,
  credentialStore,
  authProvider,
  exemptCommands,
}: CredentialInjectionDependencies): void => {
  program.hook('preAction', async (_root, action) => {
    if ([...exemptCommands].some((command) => belongsTo(action, command))) return
    const flags = action.optsWithGlobals<{
      readonly apiKey?: string
      readonly baseUrl?: string
      readonly bearerAuth?: string
      readonly xApiKey?: string
    }>()
    const intended = intendedCredential(flags, environment)
    recordCredentialSource(action, intended)
    setCredentialOptions(action, { apiKey: null, xApiKey: null, bearerAuth: null })

    try {
      const selected = await selectedCredential({ flags, environment }, credentialStore)
      if (!selected) {
        recordCredentialSource(action, { source: 'none' })
        setCredentialOptions(action, {
          apiKey: null,
          xApiKey: null,
          bearerAuth: rejectedCredential(new CredentialStorageError('not_logged_in')),
        })
        return
      }
      recordCredentialSource(action, {
        source: selected.source,
        ...(selected.source === 'environment'
          ? { label: selected.transport === 'bearer' ? 'DEDALUS_API_KEY' : 'DEDALUS_X_API_KEY' }
          : {}),
      })
      if (selected.source === 'oauth_session') {
        const gatewayURL = cliOAuthGatewayURL(environment, flags.baseUrl)
        const accessToken = await accessTokenForCommand(credentialStore(), authProvider())
        setCommandOption(action, 'baseUrl', gatewayURL)
        setCredentialOptions(action, { apiKey: null, xApiKey: null, bearerAuth: accessToken })
      } else if (selected.transport === 'bearer') {
        setCredentialOptions(action, { apiKey: selected.value, xApiKey: null, bearerAuth: null })
      } else {
        setCredentialOptions(action, { apiKey: null, xApiKey: selected.value, bearerAuth: null })
      }
    } catch (error) {
      setCredentialOptions(action, {
        apiKey: null,
        xApiKey: null,
        bearerAuth: rejectedCredential(error),
      })
    }
  })
}

export const cliOAuthGatewayURL = (
  environment: Readonly<Record<string, string | undefined>>,
  flagValue?: string,
): string => {
  const issuer = new URL(createClerkAuthProvider(cliAuthConfiguration(environment)).issuer)
  const developmentIssuer = issuer.hostname.endsWith('.clerk.accounts.dev')
  if (!developmentIssuer) throw new CredentialStorageError('environment_mismatch')
  const raw = flagValue ?? environment.DEDALUS_BASE_URL ?? developmentGatewayURL
  const gatewayURL = validHTTPSBaseURL(raw)
  if (new URL(gatewayURL).pathname !== '/dcs') {
    throw new CredentialStorageError('environment_mismatch')
  }
  if (gatewayURL !== developmentGatewayURL) {
    throw new CredentialStorageError('environment_mismatch')
  }
  return gatewayURL
}

const validHTTPSBaseURL = (raw: string): string => {
  try {
    if (raw !== raw.trim()) throw new CredentialStorageError('environment_mismatch')
    const value = new URL(raw)
    if (
      value.protocol !== 'https:' ||
      value.username ||
      value.password ||
      value.search ||
      value.hash ||
      !/^\/(?:[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*)?\/?$/u.test(value.pathname)
    ) {
      throw new CredentialStorageError('environment_mismatch')
    }
    const path = value.pathname === '/' ? '' : value.pathname.replace(/\/$/u, '')
    return value.origin + path
  } catch (error) {
    if (error instanceof CredentialStorageError) throw error
    throw new CredentialStorageError('environment_mismatch', { cause: error })
  }
}

const intendedCredential = (
  flags: { readonly apiKey?: string; readonly bearerAuth?: string; readonly xApiKey?: string },
  environment: Readonly<Record<string, string | undefined>>,
): SelectedCredential => {
  if (flags.apiKey !== undefined || flags.xApiKey !== undefined || flags.bearerAuth !== undefined) {
    return { source: 'flag' }
  }
  if (
    hasCredentialCustomHeader(environment.DEDALUS_CUSTOM_HEADERS) ||
    environment.DEDALUS_API_KEY !== undefined ||
    environment.DEDALUS_X_API_KEY !== undefined ||
    environment.DEDALUS_BEARER_AUTH !== undefined
  ) {
    return { source: 'environment' }
  }
  return { source: 'oauth_session' }
}

type CredentialOptionValues = {
  readonly apiKey: unknown
  readonly xApiKey: unknown
  readonly bearerAuth: unknown
}

const setCredentialOptions = (action: Command, values: CredentialOptionValues): void => {
  let current: Command | null = action
  while (current) {
    current.setOptionValueWithSource('apiKey', values.apiKey, 'cli')
    current.setOptionValueWithSource('xApiKey', values.xApiKey, 'cli')
    current.setOptionValueWithSource('bearerAuth', values.bearerAuth, 'cli')
    current = current.parent
  }
}

const setCommandOption = (action: Command, name: string, value: unknown): void => {
  let current: Command | null = action
  while (current) {
    current.setOptionValueWithSource(name, value, 'cli')
    current = current.parent
  }
}

const rejectedCredential = (error: unknown): (() => never) => () => { throw error }

const belongsTo = (command: Command, ancestor: Command): boolean => {
  let current: Command | null = command
  while (current) {
    if (current === ancestor) return true
    current = current.parent
  }
  return false
}
