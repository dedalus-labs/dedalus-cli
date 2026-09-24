// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { accessSync, constants as fsConstants, createReadStream, readFileSync } from 'node:fs';
import { stdin as processStdin, stdout as processStdout } from 'node:process';

import as from 'ansis';
import { Command } from 'commander';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { encodeToon } from './toon.js';
import { takeWarnings } from './credentials';
import { type CliAuthDefinition, UsageError, runLogin, runLogout, storedCredentials } from './login';

import { createDiagnostics, diagnosticScope } from '../feedback/diagnostics.js';

// Custom commands can carry literal input past flag/file coercion.
export class LiteralCliValue {
  constructor(readonly value: unknown) {}
}

const LOGIN_COMMAND = 'dedalus login';

type OutputFormat = 'auto' | 'json' | 'jsonl' | 'pretty' | 'raw' | 'toon' | 'yaml';

export type CliValueKind =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'unknown'
  | 'file';

export type CliFlagDefinition = {
  readonly name: string;
  readonly optionKey: string;
  readonly paramKey: string;
  readonly location: 'path' | 'query' | 'header' | 'cookie' | 'body';
  readonly required: boolean;
  readonly description?: string;
  readonly valueKind: CliValueKind;
  // Array-valued flag accepted as a repeatable singular switch (`--status a --status b`).
  readonly repeatable?: boolean;
  // Value kind of one occurrence of a repeatable flag, so `--tag ''` stays an empty string rather
  // than parsing as YAML `null`, and a string id is not read as a number.
  readonly itemKind?: CliValueKind;
  // Wire-property path under the parent param for dotted leaf flags (e.g. `--address.city`).
  readonly objectPath?: readonly string[];
};

export type CliCommandDefinition = {
  readonly resourcePath: readonly string[];
  readonly commandPath: readonly string[];
  readonly methodName: string;
  readonly summary?: string;
  readonly description?: string;
  readonly transport: 'http' | 'websocket';
  readonly streaming?: 'sse' | 'jsonl';
  readonly iterable: boolean;
  readonly callShape: 'options' | 'params' | 'body';
  readonly authClientKeyRequirements: readonly (readonly string[])[];
  // Param key of a body blob that is forwarded bare or spread into params, depending on callShape.
  readonly bodyParamKey?: string;
  readonly positional: readonly CliFlagDefinition[];
  readonly flags: readonly CliFlagDefinition[];
};

export type CliCommandGroup = {
  readonly commandPath: readonly string[];
  readonly description?: string;
};

export type CliClientOptionDefinition = {
  readonly clientKey: string;
  readonly sdkKey: string;
  readonly name: string;
  readonly optionKey: string;
  readonly env?: string;
  readonly description?: string;
  readonly auth: boolean;
  // Documented in --help only. Deliberately NOT registered as a Commander default: a default
  // would make the flag always look explicitly set, and the forwarded value would shadow the
  // environment variable the SDK reads before falling back to this same default itself.
  readonly defaultValue?: string;
};

export type CreateProgramOptions = {
  readonly SDK: new (...args: any[]) => unknown;
  readonly binaryName: string;
  readonly version: string;
  readonly description: string;
  readonly defaultFormat: OutputFormat;
  readonly defaultErrorFormat: OutputFormat;
  readonly clientOptions: readonly CliClientOptionDefinition[];
  readonly commands: readonly CliCommandDefinition[];
  // Descriptions for the resource-shaped parents commands hang under. Only described groups are
  // listed; Commander already creates an undescribed parent implicitly.
  readonly groups?: readonly CliCommandGroup[];
  // Completion script per shell, generated alongside the command table. Absent when the SDK
  // config disables shell completions, in which case no `completion` command is registered.
  readonly completions?: Readonly<Record<string, string>>;
  readonly auth?: CliAuthDefinition;
};

type OutputOptions = {
  readonly format: OutputFormat;
  // Command path shown above each `pretty` card (e.g. `workers list`).
  readonly title?: string;
  readonly transform?: string;
  readonly rawOutput?: boolean;
  readonly maxItems?: number;
  readonly failOnWebSocketError?: boolean;
  readonly onLimit?: () => void;
};

export type GlobalOptions = {
  readonly baseUrl?: string;
  readonly timeout?: string;
  readonly maxRetries?: string;
  readonly format?: OutputFormat;
  readonly formatError?: OutputFormat;
  readonly transform?: string;
  readonly transformError?: string;
  readonly rawOutput?: boolean;
  readonly debug?: boolean;
  readonly maxItems?: string;
};

export const createProgram = ({
  SDK,
  binaryName,
  version,
  description,
  defaultFormat,
  defaultErrorFormat,
  clientOptions,
  commands,
  groups,
  completions,
  auth,
}: CreateProgramOptions): Command => {
  const program = usageExitCode(new Command());
  program
    .enablePositionalOptions()
    .name(binaryName)
    .description(description)
    .version(version, '-v, --version')
    .showHelpAfterError()
    .option('--base-url <url>', 'Override the base URL for API requests')
    .option('--timeout <ms>', 'Request timeout in milliseconds')
    .option('--max-retries <count>', 'Number of retries for retryable failures')
    .option(
      '--format <format>',
      'Output format: auto, json, jsonl, pretty, raw, toon, yaml',
      defaultFormat,
    )
    .option(
      '--format-error <format>',
      'Error output format: auto, json, jsonl, pretty, raw, toon, yaml',
      defaultErrorFormat,
    )
    .option('--transform <path>', 'Dot-path transform for data output')
    .option('--transform-error <path>', 'Dot-path transform for error output')
    .option('-r, --raw-output', 'Print transformed string values without JSON quotes')
    .option('--debug', 'Enable SDK debug logging');

  // Register configured client options (auth credentials, org headers, etc.) as global flags.
  // Mirrored on each subcommand below so users can supply them either before or after the verb.
  for (const option of clientOptions) {
    program.option('--' + option.name + ' <value>', clientOptionDescription(option));
  }

  for (const definition of commands)
    addGeneratedCommand(program, SDK, clientOptions, definition, groups, auth);

  if (completions) addCompletionCommand(program, binaryName, completions);
  if (auth) addAuthCommands(program, auth);

  return program;
};

// Routes Commander's own exits through the documented status.
//
// Commander defaults every parse failure — unknown flag, missing option-argument, unknown
// command — to exit 1, which is the status reserved here for an unclassified API failure, so a
// caller branching on the status could not tell a typo from a request that actually ran and
// failed. Only a zero exit (--help, --version) is passed through unchanged; everything else
// Commander exits on is a usage error by definition.
//
// This has to be applied to every command object: `addCommand` does not copy the callback the
// way `.command()` does, so setting it on the program alone would leave the subcommands — where
// flags are actually parsed — still exiting 1.
const usageExitCode = (command: Command): Command =>
  command.exitOverride((error) => process.exit(error.exitCode === 0 ? 0 : 2));

// Prints the completion script for one shell. The scripts are generated from the same command
// table this program is built from, so they always describe the commands and flags below; nothing
// is derived from the live Commander tree, and no shell code is assembled at runtime.
const addCompletionCommand = (
  program: Command,
  binaryName: string,
  completions: Readonly<Record<string, string>>,
): void => {
  const shells = Object.keys(completions);
  program
    .command('completion')
    .description('Print a shell completion script (' + shells.join(', ') + ')')
    .argument('<shell>', 'Shell to print a completion script for: ' + shells.join(', '))
    .addHelpText('after', completionHelpExamples(binaryName, shells))
    .action((shell: string) => {
      // Own-property lookup only: a bare `completions[shell]` would resolve inherited keys like
      // "constructor" or "__proto__" to something that is not a completion script.
      const script = Object.prototype.hasOwnProperty.call(completions, shell)
        ? completions[shell]
        : undefined;
      if (script === undefined) {
        process.stderr.write(
          "Unsupported shell '" + shell + "'. Supported shells: " + shells.join(', ') + '\n',
        );
        process.exitCode = 2;
        return;
      }
      processStdout.write(script);
    });
};

// Shows how to load each script, since every shell wires completions up differently.
const completionHelpExamples = (binaryName: string, shells: readonly string[]): string => {
  const examples: Record<string, string> = {
    bash: '  eval "$(' + binaryName + ' completion bash)"  # or write it to /etc/bash_completion.d',
    zsh: '  eval "$(' + binaryName + ' completion zsh)"  # or write it to a directory on $fpath',
    fish: '  ' + binaryName + ' completion fish | source  # or write it to ~/.config/fish/completions',
  };
  const lines = shells.map((shell) => examples[shell]).filter((line): line is string => line !== undefined);
  return lines.length > 0 ? '\nAdd one of these to your shell startup file:\n' + lines.join('\n') : '';
};

// `login`/`logout` sit at the top level unless the API already claims one of those names, in
// which case they fall back under an `auth` parent. That parent is created here rather than
// from the command table, so it needs its own description or `--help` lists a bare `auth`,
// which is the very thing the group table exists to prevent. Both paths are described so
// whichever one creates the group first carries it.
const authGroups = (auth: CliAuthDefinition): readonly CliCommandGroup[] => [
  { commandPath: auth.loginPath.slice(0, -1), description: 'Sign in and out' },
  { commandPath: auth.logoutPath.slice(0, -1), description: 'Sign in and out' },
];

const addAuthCommands = (program: Command, auth: CliAuthDefinition): void => {
  const flows = auth.methods.map((method) => method.name).join(', ');
  const login = usageExitCode(new Command(auth.loginPath.at(-1) ?? 'login'))
    .description('Sign in and save credentials for later commands')
    .showHelpAfterError()
    .option('--base-url <url>', 'Sign in against this base URL instead of the default')
    .option('--flow <name>', 'Sign-in flow to use: ' + flows)
    .addHelpText('after', authFlowHelp(auth))
    .action(async (_options: unknown, command: Command) => {
      const options = command.optsWithGlobals<{ baseUrl?: string; flow?: string }>();
      await runAuthCommand(() => runLogin(auth, resolvedBaseUrl(auth, options.baseUrl), options.flow));
    });
  ensureCommandPath(program, auth.loginPath.slice(0, -1), authGroups(auth)).addCommand(login);

  const logout = usageExitCode(new Command(auth.logoutPath.at(-1) ?? 'logout'))
    .description('Forget saved credentials')
    .showHelpAfterError()
    .option('--base-url <url>', 'Forget the credentials saved for this base URL')
    .option('--all', 'Forget every saved credential, for every base URL')
    .action(async (_options: unknown, command: Command) => {
      const options = command.optsWithGlobals<{ baseUrl?: string; all?: boolean }>();
      await runAuthCommand(() =>
        runLogout(auth, resolvedBaseUrl(auth, options.baseUrl), options.all === true),
      );
    });
  ensureCommandPath(program, auth.logoutPath.slice(0, -1), authGroups(auth)).addCommand(logout);
};

const runAuthCommand = async (run: () => string | Promise<string>): Promise<void> => {
  try {
    processStdout.write((await run()) + '\n');
  } catch (error) {
    process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
    process.exitCode = error instanceof UsageError ? 2 : 10;
  } finally {
    for (const warning of takeWarnings()) process.stderr.write(warning + '\n');
  }
};

const resolvedBaseUrl = (auth: CliAuthDefinition, flag: string | undefined): string =>
  flag?.trim() || process.env[auth.baseUrlEnv]?.trim() || auth.defaultBaseUrl;

// Lists the flows by name so `--flow` can be used without first running the picker.
const authFlowHelp = (auth: CliAuthDefinition): string =>
  '\nSign-in flows:\n' + auth.methods.map((method) => '  ' + method.name + '  ' + method.label).join('\n');

const clientOptionDescription = (option: CliClientOptionDefinition): string => {
  const parts: string[] = [];
  if (option.description) parts.push(option.description);
  if (option.env) parts.push('(can also be set with ' + option.env + ' env var)');
  // Stated last, matching resolution order: the flag wins, then the env var, then this value.
  if (option.defaultValue !== undefined) parts.push('(defaults to ' + option.defaultValue + ')');
  return parts.join(' ');
};

// Constructs the embedded client, restating its credential guard in command-line terms.
//
// The SDK's own guard is worded for a library caller — "instantiate the X client with an apiKey
// option, like new X({ apiKey: ... })" — which names something a CLI user cannot do. That wording
// is fixed upstream to match the reference SDKs byte for byte, so it is restated here rather than
// changed there. The environment variable is the anchor for the match: it is the one token of the
// message this runtime also knows, so an unrelated constructor failure is rethrown untouched
// instead of being reported as a missing credential.
const buildClient = (
  SDK: CreateProgramOptions['SDK'],
  options: Record<string, unknown>,
  clientOptions: readonly CliClientOptionDefinition[],
): Record<string, unknown> => {
  try {
    return new SDK(options) as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const missing = clientOptions.find((option) => option.env !== undefined && message.includes(option.env));
    if (!missing) throw error;
    throw new Error(
      'Missing credential: run `' +
        LOGIN_COMMAND +
        '`, pass --' +
        missing.name +
        ' <value>' +
        (missing.env ? ' or set the ' + missing.env + ' environment variable' : '') +
        '.',
    );
  }
};

const addGeneratedCommand = (
  program: Command,
  SDK: CreateProgramOptions['SDK'],
  clientOptions: readonly CliClientOptionDefinition[],
  definition: CliCommandDefinition,
  groups: readonly CliCommandGroup[] | undefined,
  auth: CliAuthDefinition | undefined,
): void => {
  const parent = ensureCommandPath(program, definition.commandPath.slice(0, -1), groups);
  const commandName = definition.commandPath.at(-1) ?? definition.methodName;
  const command = usageExitCode(new Command(commandName))
    .description(definition.summary ?? definition.description ?? '')
    .showHelpAfterError()
    .option('--base-url <url>', 'Override the base URL for API requests')
    .option('--timeout <ms>', 'Request timeout in milliseconds')
    .option('--max-retries <count>', 'Number of retries for retryable failures')
    .option('--format <format>', 'Output format: auto, json, jsonl, pretty, raw, toon, yaml')
    .option(
      '--format-error <format>',
      'Error output format: auto, json, jsonl, pretty, raw, toon, yaml',
    )
    .option('--transform <path>', 'Dot-path transform for data output')
    .option('--transform-error <path>', 'Dot-path transform for error output')
    .option('-r, --raw-output', 'Print transformed string values without JSON quotes')
    .option('--debug', 'Enable SDK debug logging');

  // Mirror configured client-option flags on the subcommand so they can appear before or after the verb.
  for (const option of clientOptions) {
    command.option('--' + option.name + ' <value>', clientOptionDescription(option));
  }

  if (definition.iterable)
    command.option(
      '--max-items <count>',
      'Maximum number of streamed items to print; use -1 for unlimited',
    );

  // Positionals are registered as optional Commander arguments because each one is also
  // accepted as an equivalent flag (e.g. `workers retrieve wkr_1` or `workers retrieve --id
  // wkr_1`); requiredness is enforced at call time once both spellings have been merged.
  for (const positional of definition.positional) {
    command.argument('[' + positional.name + ']', positional.description ?? '');
  }

  for (const flag of definition.flags) {
    // A file flag takes a filesystem path, so it says so: the placeholder is the only hint in
    // `--help` that the value is opened rather than sent verbatim.
    const isPath = flag.valueKind === 'file' || flag.itemKind === 'file';
    const value = flag.valueKind === 'boolean' ? '' : isPath ? ' <path>' : ' <value>';
    if (flag.name === 'send') {
      command.option(
        '--' + flag.name + value,
        flag.description ?? '',
        (value: string, previous: string[] | undefined) => [...(previous ?? []), value],
      );
      continue;
    }
    // Array params are repeatable single-value switches (`--status a --status b`); the custom
    // option-argument accumulates each occurrence so Commander does not overwrite the prior value.
    if (flag.repeatable) {
      command.option(
        '--' + flag.name + value,
        flag.description ?? '',
        (value: string, previous: string[] | undefined) => [...(previous ?? []), value],
      );
      continue;
    }
    command.option('--' + flag.name + value, flag.description ?? '');
  }

  // Flag spelling for path params (`--id wkr_1`); skipped when the name is already taken by a
  // client option or generated flag so Commander does not throw on a duplicate registration.
  //
  // `help` is skipped on top of that scan rather than through it: Commander keeps its built-in
  // help option in `_helpOption`, not in `command.options`, so the scan cannot see it and
  // `--help <value>` would register over it — leaving `<command> --help` to fail with "argument
  // missing" instead of printing help. The param is still accepted positionally.
  for (const positional of definition.positional) {
    if (positional.name === 'help') continue;
    if (command.options.some((option) => option.long === '--' + positional.name)) continue;
    command.option('--' + positional.name + ' <value>', positional.description ?? '');
  }

  command.action(async (...args: unknown[]) => {
    const command = args.at(-1);
    if (!(command instanceof Command)) throw new Error('Expected Commander command context');
    const positionalValues = args.slice(0, -1);
    await runGeneratedCommand(SDK, clientOptions, definition, command, positionalValues, auth);
  });

  parent.addCommand(command);
};

const ensureCommandPath = (
  program: Command,
  path: readonly string[],
  groups: readonly CliCommandGroup[] | undefined,
): Command => {
  let parent = program;
  const walked: string[] = [];
  for (const part of path) {
    walked.push(part);
    const existing = parent.commands.find((command) => command.name() === part);
    if (existing) {
      parent = existing;
      continue;
    }
    const next = usageExitCode(new Command(part)).showHelpAfterError();
    // A group is created as the parent of its first command, so this is the only moment it can be
    // described: Commander never revisits it, and an undescribed group is a bare name in --help.
    const description = groupDescription(groups, walked);
    if (description) next.description(description);
    parent.addCommand(next);
    parent = next;
  }
  return parent;
};

// Matched on the full walked path rather than the last segment, so a nested group is described by
// the resource it was actually built from and two resources sharing a leaf name cannot collide.
const groupDescription = (
  groups: readonly CliCommandGroup[] | undefined,
  path: readonly string[],
): string | undefined =>
  groups?.find(
    (group) =>
      group.commandPath.length === path.length &&
      group.commandPath.every((part, index) => part === path[index]),
  )?.description;

const runGeneratedCommand = async (
  SDK: CreateProgramOptions['SDK'],
  clientOptions: readonly CliClientOptionDefinition[],
  definition: CliCommandDefinition,
  command: Command,
  positionalValues: readonly unknown[],
  auth: CliAuthDefinition | undefined,
): Promise<void> => {
  const rootOptions = command.optsWithGlobals<GlobalOptions>();
  const commandOptions = command.opts<GlobalOptions>();
  const maxItems = definition.iterable ? normalizeMaxItems(commandOptions.maxItems) : undefined;
  const outputOptions: OutputOptions = {
    format: normalizeFormat(commandOptions.format ?? rootOptions.format, 'auto'),
    title: definition.commandPath.join(' '),
    ...((commandOptions.transform ?? rootOptions.transform)
      ? { transform: commandOptions.transform ?? rootOptions.transform }
      : {}),
    ...(commandOptions.rawOutput || rootOptions.rawOutput ? { rawOutput: true } : {}),
    ...(maxItems !== undefined ? { maxItems } : {}),
  };
  const errorOptions: OutputOptions = {
    format: normalizeFormat(commandOptions.formatError ?? rootOptions.formatError, 'auto'),
    ...((commandOptions.transformError ?? rootOptions.transformError)
      ? { transform: commandOptions.transformError ?? rootOptions.transformError }
      : {}),
    ...(commandOptions.rawOutput || rootOptions.rawOutput ? { rawOutput: true } : {}),
  };

  let diagnostics: ReturnType<typeof createDiagnostics> | undefined;
  try {
    const clientConfig = await sdkClientOptions(
      rootOptions, command, clientOptions, auth, definition.authClientKeyRequirements,
    );
    const call = await callArguments(
      definition,
      command.opts<Record<string, unknown>>(),
      positionalValues,
    );
    const organization = call.params['X-Dedalus-Org-Id'];
    const scopeOptions =
      organization === undefined ? clientConfig : { ...clientConfig, dedalusOrgID: organization };
    diagnostics = createDiagnostics(
      'dedalus ' + definition.commandPath.join(' '),
      diagnosticScope(scopeOptions),
    );
    const client = buildClient(SDK, { ...clientConfig, fetch: diagnostics.fetch }, clientOptions);
    const method = sdkMethod(client, definition);

    // Required positionals are validated here (not by Commander) because each one may also be
    // supplied through its flag spelling or stdin; `call.params` has all sources merged.
    for (const param of definition.positional) {
      if (param.required && call.params[param.paramKey] === undefined) {
        command.error("error: missing required argument '" + param.name + "'", { exitCode: 2 });
      }
    }

    const result = method(...call.args);

    if (definition.transport === 'websocket') {
      await handleWebSocket(result, call.params, outputOptions);
      return;
    }

    if (definition.iterable && !definition.streaming) {
      await writePaginated(result, outputOptions);
      return;
    }

    const resolved = await result;
    if (definition.streaming) {
      await writeIterable(resolved, outputOptions);
      return;
    }

    await writeOutput(resolved, outputOptions);
  } catch (error) {
    diagnostics?.record({ kind: 'command_failure' });
    await writeError(error, errorOptions, clientOptions, SDK);
    process.exitCode = errorExitCode(error, SDK);
  } finally {
    diagnostics?.record({ kind: 'command_complete' });
  }
};

// Generated commands pass operation-specific requirements. Custom commands use the API-wide requirements.
export const sdkClientOptions = async (
  options: GlobalOptions,
  command: Command,
  clientOptions: readonly CliClientOptionDefinition[],
  auth: CliAuthDefinition | undefined,
  requirements: readonly (readonly string[])[] = auth?.requirements ?? [],
): Promise<Record<string, unknown>> => {
  // Forward configured client-option flags (auth keys, org headers, etc.) to the embedded SDK
  // using the SDK-facing camelCased key. Only forward values that were explicitly set so the
  // SDK's own env-var fallback keeps working when no CLI flag was passed.
  const rootOptions = options as unknown as Record<string, unknown>;
  const commandOptions = command.opts<Record<string, unknown>>();
  const forwarded: Record<string, unknown> = {};
  for (const option of clientOptions) {
    const commandValue = commandOptions[option.optionKey];
    const value = commandValue === undefined ? rootOptions[option.optionKey] : commandValue;
    if (value === undefined) continue;
    // A credential is exactly the kind of value that belongs in a file rather than in shell
    // history, so a client option reads `@path` like any other flag. It never reaches the
    // structured decoding below it: an SDK client option is always a scalar.
    forwarded[option.sdkKey] = typeof value === 'string' ? clientOptionValue(value, option) : value;
  }
  await applyStoredCredentials(forwarded, clientOptions, requirements, auth, options.baseUrl);
  const organization = commandOptions['xDedalusOrgId'] ?? rootOptions['xDedalusOrgId'] ??
    forwarded['dedalusOrgID'] ?? process.env['DEDALUS_ORG_ID'];
  if (organization !== undefined) forwarded['dedalusOrgID'] = organization;
  return {
    ...(options.baseUrl?.trim() ? { baseURL: options.baseUrl.trim() } : {}),
    ...(options.timeout ? { timeout: Number(options.timeout) } : {}),
    ...(options.maxRetries ? { maxRetries: Number(options.maxRetries) } : {}),
    ...(options.debug ? { logLevel: 'debug' } : {}),
    ...forwarded,
    defaultHeaders: {
      'X-Request-ID': null,
      ...(organization ? { 'X-Dedalus-Org-Id': organization } : {}),
      'X-Scalar-Lang': 'cli',
      'X-Scalar-Runtime': 'cli',
      'X-Scalar-CLI-Command': command.name(),
      'X-Dedalus-CLI-Command': commandPath(command),
      'User-Agent': 'Dedalus/CLI ' + rootCommand(command).version(),
    },
  };
};

const applyStoredCredentials = async (
  forwarded: Record<string, unknown>,
  clientOptions: readonly CliClientOptionDefinition[],
  authClientKeyRequirements: readonly (readonly string[])[],
  auth: CliAuthDefinition | undefined,
  baseUrl: string | undefined,
): Promise<void> => {
  if (!auth) return;
  if (authClientKeyRequirements.length === 0) return;
  const hasExplicitValue = (option: CliClientOptionDefinition): boolean =>
    forwarded[option.sdkKey] !== undefined || Boolean(option.env && (process.env[option.env] ?? '').trim());
  const explicit = authClientKeyRequirements.find((keys) =>
    keys.every((key) => {
      const option = clientOptions.find((candidate) => candidate.clientKey === key);
      return option !== undefined && hasExplicitValue(option);
    }),
  );
  if (explicit) return;
  const stored = await storedCredentials(auth, resolvedBaseUrl(auth, baseUrl));
  const isSatisfiable = (keys: readonly string[]): boolean =>
    keys.every((key) => {
      const option = clientOptions.find((candidate) => candidate.clientKey === key);
      if (!option) return false;
      return hasExplicitValue(option) || (typeof stored[key] === 'string' && stored[key] !== '');
    });
  const selected =
    authClientKeyRequirements.find((keys) => isSatisfiable(keys)) ?? authClientKeyRequirements[0] ?? [];
  const pending = clientOptions.filter(
    (option) => option.auth && selected.includes(option.clientKey) && !hasExplicitValue(option),
  );
  for (const option of pending) {
    // Own-property lookup only: the store is a JSON file, so a key like "constructor"
    // would otherwise resolve to something off Object.prototype rather than a credential.
    if (!Object.prototype.hasOwnProperty.call(stored, option.clientKey)) continue;
    const value = stored[option.clientKey];
    if (typeof value === 'string' && value) forwarded[option.sdkKey] = value;
  }
};

const commandPath = (command: Command): string => {
  const parts: string[] = [];
  for (let current: Command | null = command; current; current = current.parent)
    parts.unshift(current.name());
  return parts.join(' ');
};

const rootCommand = (command: Command): Command => {
  let root = command;
  while (root.parent) root = root.parent;
  return root;
};

const sdkMethod = (
  client: Record<string, unknown>,
  definition: CliCommandDefinition,
): ((...args: unknown[]) => unknown) => {
  let target: unknown = client;
  for (const resource of definition.resourcePath) {
    target = (target as Record<string, unknown>)[resource];
  }
  const method = (target as Record<string, unknown>)[definition.methodName];
  if (typeof method !== 'function') {
    throw new Error(
      'Generated CLI could not find SDK method ' +
        [...definition.resourcePath, definition.methodName].join('.'),
    );
  }
  return method.bind(target) as (...args: unknown[]) => unknown;
};

const callArguments = async (
  definition: CliCommandDefinition,
  options: Record<string, unknown>,
  positionalValues: readonly unknown[],
): Promise<{ readonly args: readonly unknown[]; readonly params: Record<string, unknown> }> => {
  const positionalParams: Record<string, unknown> = {};
  definition.positional.forEach((param, index) => {
    const value = positionalValues[index] ?? options[param.optionKey];
    if (value !== undefined)
      positionalParams[param.paramKey] = coerceValue(value, param.valueKind, undefined, param.name);
  });

  const flagParams: Record<string, unknown> = {};
  for (const flag of definition.flags) {
    if (flag.objectPath) continue;
    const value = options[flag.optionKey];
    if (value !== undefined)
      flagParams[flag.paramKey] = coerceValue(value, flag.valueKind, flag.itemKind, '--' + flag.name);
  }

  // Dotted leaf flags (e.g. `--address.city`) are applied after the JSON-blob flag for the same
  // param so an explicit leaf value always overrides the corresponding blob field.
  for (const flag of definition.flags) {
    if (!flag.objectPath || flag.objectPath.length === 0) continue;
    const value = options[flag.optionKey];
    if (value === undefined) continue;
    flagParams[flag.paramKey] = setNestedValue(
      flagParams[flag.paramKey],
      flag.objectPath,
      coerceValue(value, flag.valueKind, flag.itemKind, '--' + flag.name),
    );
  }

  const stdin = await readStdinValue();
  const params = mergeObjects(stdin, { ...flagParams, ...positionalParams });
  const positionalArgs = definition.positional.map((param) => params[param.paramKey]);
  // A positional path param is handed to the SDK method as a leading argument, and the method
  // never destructures it back out of `params` — only the path params it did *not* take
  // positionally are pulled out there. Leaving it in `params` makes it fall through the
  // method's `...query` / `...body` rest and reach the wire a second time, as
  // `/version/1.0.0?semver=1.0.0` or as a `namespace` field in a body that has no such field.
  //
  // Dropping it cannot remove a field the call needs: a positional whose name collides with a
  // params field is already disambiguated when the command table is built (a body `slug` beside
  // a path one leaves the positional as `slug2`), so the two never share a key.
  const omitted = definition.positional.map((param) => param.paramKey);
  if (definition.transport === 'websocket') omitted.push('send');
  const sdkParams = omitParams(params, omitted);

  if (definition.callShape === 'options') return { args: [...positionalArgs, undefined], params };
  if (definition.callShape === 'body')
    return { args: [...positionalArgs, bodyValue(sdkParams, definition), undefined], params };
  return { args: [...positionalArgs, paramsValue(sdkParams, definition), undefined], params };
};

const paramsValue = (
  params: Record<string, unknown>,
  definition: CliCommandDefinition,
): unknown => {
  if (definition.bodyParamKey === undefined) return params;
  const body = params[definition.bodyParamKey];
  if (body === undefined) return params;
  // Scoped union bodies with headers are typed as the params root. A `--body` JSON blob therefore
  // needs to sit beside header/query flags, or be passed as the root when it cannot be merged.
  if (!isPlainObject(body)) return body;
  return mergeObjects(body, omitParams(params, [definition.bodyParamKey]));
};

const bodyValue = (params: Record<string, unknown>, definition: CliCommandDefinition): unknown => {
  // A non-flattenable body is forwarded as a single value: the SDK method takes that param
  // directly, so return it bare. Its dotted leaf flags (`--payload.city`) share this key and have
  // already been merged into the param value, so counting body flags would wrongly treat one
  // logical body as many and re-wrap it under the param key. `params.body` covers a bare value
  // piped via stdin.
  if (definition.bodyParamKey !== undefined) {
    if (params[definition.bodyParamKey] !== undefined) return params[definition.bodyParamKey];
    if (params.body !== undefined) return params.body;
  }
  // A flattenable body is reassembled from its per-property flags into a single object. Leaf flags
  // share their parent property key, so keying by paramKey collapses them back onto that property.
  const bodyFlags = definition.flags.filter(
    (flag) => flag.location === 'body' && flag.paramKey !== 'send',
  );
  const body: Record<string, unknown> = {};
  for (const flag of bodyFlags) {
    if (params[flag.paramKey] !== undefined) body[flag.paramKey] = params[flag.paramKey];
  }
  return Object.keys(body).length > 0 ? body : params;
};

const readStdinValue = async (): Promise<Record<string, unknown>> => {
  if (processStdin.isTTY) return {};
  const source = await readStdinSource();
  if (!source) return {};
  const parsed = parseStructuredValue(source);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
    return parsed as Record<string, unknown>;
  return { body: parsed };
};

const readStdinSource = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  const done = new Promise<string>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      processStdin.off('data', onData);
      processStdin.off('end', onEnd);
      processStdin.off('error', onError);
      processStdin.pause();
    };
    const onData = (chunk: Buffer | string) => {
      clearTimeout(timer);
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    };
    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks).toString('utf8').trim());
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve('');
    }, 25);
    processStdin.on('data', onData);
    processStdin.on('end', onEnd);
    processStdin.on('error', onError);
  });
  processStdin.resume();
  return done;
};

// An empty argument is an empty STRING, not YAML's empty document. `--tag ''` asks for one
// empty tag; parsing it as YAML answers `null`, which the request builder then refuses
// ("Received null for "tags[]""). Only the empty case is special-cased: `--tag null` still
// means null, and every other value keeps the JSON-then-YAML reading.
const parseStructuredValue = (source: string): unknown => {
  if (source === '') return source;
  try {
    return JSON.parse(source);
  } catch {
    return parseYaml(source);
  }
};

const setNestedValue = (
  target: unknown,
  path: readonly string[],
  value: unknown,
): Record<string, unknown> => {
  const root = isPlainObject(target) ? { ...target } : {};
  let cursor = root;
  for (const segment of path.slice(0, -1)) {
    const existing = cursor[segment];
    const next = isPlainObject(existing) ? { ...existing } : {};
    cursor[segment] = next;
    cursor = next;
  }
  const leaf = path.at(-1);
  if (leaf !== undefined) cursor[leaf] = value;
  return root;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const mergeObjects = (
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> => ({
  ...base,
  ...Object.fromEntries(Object.entries(overlay).filter(([, value]) => value !== undefined)),
});

const omitParams = (
  params: Record<string, unknown>,
  names: readonly string[],
): Record<string, unknown> => {
  const out = { ...params };
  for (const name of names) delete out[name];
  return out;
};

// A file argument is spelled `@path`, the spelling curl and the reference CLIs already use, so a
// command written against one of those keeps working here. A command line carries a path but never
// the bytes behind it, and without this the path itself went on the wire as the value.
const FILE_ARG_PREFIX = '@';

// `@file://x` sends the bytes as text and `@data://x` sends them base64-encoded; a bare `@x` lets the
// file decide, which is what a caller who has not thought about encoding means.
const FILE_ARG_TEXT_SCHEME = 'file://';
const FILE_ARG_DATA_SCHEME = 'data://';

// `\@value` is how a value that genuinely begins with `@` (an npm scope, a handle) is spelled.
const ESCAPED_FILE_ARG_PREFIX = '\\@';

// Where a scalar value came from, which is what decides how far it is decoded:
//   - "literal": typed on the command line. A structured kind parses it, and a `@` inside the result
//     names a file the same way the flag itself would.
//   - "file": read out of a file the value named. A structured kind still parses it (that is the
//     point of `--metadata @meta.json`), but a `@` inside the file is data rather than a second file
//     argument: whoever wrote the file is not necessarily whoever typed the command.
//   - "escaped": a literal whose leading `@` was escaped as `\@`. Escaping declares the value to
//     be text, so it is never parsed: `@remote` is a YAML reserved character and throws.
//   - "encoded": base64 of bytes that are not text. It is the value; nothing parses or expands it.
type FlagValueOrigin = 'literal' | 'file' | 'encoded' | 'escaped';

type FlagValue = { readonly text: string; readonly origin: FlagValueOrigin };

// The part after `@`, or `undefined` when the value is not a file argument at all.
const fileArgRest = (value: string): string | undefined =>
  value.startsWith(FILE_ARG_PREFIX) ? value.slice(FILE_ARG_PREFIX.length) : undefined;

// Drops the escape from `\@literal`, which is the only thing a leading backslash means here.
const unescapeFileArg = (value: string): string =>
  value.startsWith(ESCAPED_FILE_ARG_PREFIX) ? value.slice(1) : value;

// Resolves one scalar value: a file argument becomes the file's contents, `\@` becomes a literal `@`,
// and anything else is passed through untouched.
const flagValue = (value: string, label: string): FlagValue => {
  const rest = fileArgRest(value);
  if (rest === undefined) {
    const unescaped = unescapeFileArg(value);
    return { text: unescaped, origin: unescaped === value ? 'literal' : 'escaped' };
  }
  if (rest.startsWith(FILE_ARG_TEXT_SCHEME)) {
    return {
      text: readFileArg(rest.slice(FILE_ARG_TEXT_SCHEME.length), label, true).toString('utf8'),
      origin: 'file',
    };
  }
  if (rest.startsWith(FILE_ARG_DATA_SCHEME)) {
    return {
      text: readFileArg(rest.slice(FILE_ARG_DATA_SCHEME.length), label, true).toString('base64'),
      origin: 'encoded',
    };
  }
  const bytes = readFileArg(rest, label, false);
  // Bytes that are not text cannot travel as a JSON string, so they are base64-encoded. A caller who
  // wants one encoding regardless of what the file holds spells it with `@file://` or `@data://`.
  return looksBinary(bytes)
    ? { text: bytes.toString('base64'), origin: 'encoded' }
    : { text: bytes.toString('utf8'), origin: 'file' };
};

// A `file://` or `data://` value is a URL and is percent-decoded as one; a bare `@path` is not a URL
// and is opened exactly as typed, or a file genuinely named `100%20pct.txt` would be looked up as
// `100 pct.txt`.
const readFileArg = (source: string, label: string, url: boolean): Buffer => {
  const path = url ? fileUrlToPath(source) : source;
  try {
    return readFileSync(path);
  } catch (error) {
    throw new Error(fileArgFailure(label, path, error));
  }
};

// A missing file names the flag, the path, and the escape, because the likeliest reason `@abe` names
// nothing on disk is that it was meant as a literal value.
const fileArgFailure = (label: string, path: string, error: unknown): string =>
  label +
  ': could not read ' +
  path +
  ' (' +
  (error instanceof Error ? error.message : String(error)) +
  '). Write \\@ to send a literal value beginning with @.';

// Bytes are text when they round-trip through UTF-8. A NUL byte is checked separately because it is
// legal UTF-8, so it round-trips, yet no text field is meant to carry one.
const looksBinary = (bytes: Buffer): boolean =>
  bytes.includes(0) || !Buffer.from(bytes.toString('utf8'), 'utf8').equals(bytes);

// `file://./x` and `file:///abs/x` are both spelled by hand often enough to accept: the first is not
// a legal file URL, so `new URL()` is not used and the remainder is treated as a path. The slash
// before a drive letter (`file:///C:/x`) is the Windows spelling of an absolute path and is dropped,
// since `/C:/x` names nothing.
const fileUrlToPath = (rest: string): string => {
  const decoded = decodeFileUrl(rest);
  return /^\/[A-Za-z]:/u.test(decoded) ? decoded.slice(1) : decoded;
};

// Percent-decoding applies only when the value decodes cleanly. A literal `%` in a file name is
// likelier than a hand-encoded one, and letting `decodeURIComponent` throw would surface a bare
// "URI error" naming neither the flag nor the path.
const decodeFileUrl = (rest: string): string => {
  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
};

// The path a file-kinded flag names, with or without the `@`. An upload value is a path by
// definition, so the prefix is optional there and both spellings open the same file.
const uploadPath = (value: string): string => {
  const rest = fileArgRest(value);
  if (rest === undefined) return unescapeFileArg(value);
  if (rest.startsWith(FILE_ARG_TEXT_SCHEME)) return fileUrlToPath(rest.slice(FILE_ARG_TEXT_SCHEME.length));
  if (rest.startsWith(FILE_ARG_DATA_SCHEME)) return fileUrlToPath(rest.slice(FILE_ARG_DATA_SCHEME.length));
  return rest;
};

// `createReadStream` defers a missing file to an asynchronous `error` event, which surfaces as an
// unhandled rejection rather than a usage error, so the path is checked before the stream is opened.
const uploadStream = (value: string, label: string): unknown => {
  const path = uploadPath(value);
  try {
    accessSync(path, fsConstants.R_OK);
  } catch (error) {
    throw new Error(fileArgFailure(label, path, error));
  }
  return createReadStream(path);
};

// `@` works inside a JSON or YAML blob too (`--metadata '{"notes": "@notes.txt"}'`), so a nested
// field names a file the same way a flag does. Only a blob typed on the command line is walked; see
// `FlagValueOrigin` for why a blob read out of a file is not.
const expandFileArgs = (value: unknown, label: string): unknown => {
  if (typeof value === 'string') return flagValue(value, label).text;
  if (Array.isArray(value)) return value.map((item) => expandFileArgs(item, label));
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expandFileArgs(item, label)]));
  }
  return value;
};

// `itemKind` types one occurrence of a repeatable array flag; a definition without one (an injected
// field with no item schema) falls back to parsing each occurrence as structured text. `label` names
// the flag a file-argument failure came from, since a path names no flag on its own.
// A failing client option cannot name the path it tried to open when the option carries a
// credential: the likeliest reason `@sk-live-...` names no file is that it *is* the key, and the
// message reaches stderr and every CI log capturing it.
const clientOptionValue = (value: string, option: CliClientOptionDefinition): unknown => {
  try {
    return flagValue(value, '--' + option.name).text;
  } catch (error) {
    if (!option.auth) throw error;
    throw new Error(
      '--' +
        option.name +
        ': could not read the file it names. Write \\@ to send a literal value beginning with @.',
    );
  }
};

const coerceValue = (
  value: unknown,
  kind: CliValueKind,
  itemKind?: CliValueKind,
  label = 'value',
): unknown => {
  if (value instanceof LiteralCliValue) return value.value;
  if (Array.isArray(value)) {
    const elementKind = kind === 'array' ? (itemKind ?? 'unknown') : kind;
    return value.map((item) => coerceValue(item, elementKind, undefined, label));
  }
  if (typeof value !== 'string') return value;
  // A file field takes bytes, and a path is the only thing a command line can carry. The stream is
  // what the SDK's multipart encoder detects (it is async iterable) and it names the part from the
  // stream's `path`, so the upload keeps its file name.
  if (kind === 'file') return uploadStream(value, label);
  const source = flagValue(value, label);
  if (kind === 'boolean') return source.text === 'true' || source.text === '1';
  if (kind === 'number' || kind === 'integer') return Number(source.text);
  if (kind === 'object' || kind === 'array' || kind === 'unknown') {
    // Base64 is the value itself, and an escaped literal was declared to be text: parsing
    // either would read it as YAML, and `@remote` is not even legal YAML.
    if (source.origin === 'encoded' || source.origin === 'escaped') return source.text;
    const parsed = parseStructuredValue(source.text);
    return source.origin === 'literal' ? expandFileArgs(parsed, label) : parsed;
  }
  return source.text;
};

// Iterator commands print one item at a time so pipes can consume long-running streams immediately.
// One streamed item, framed so consecutive items stay separable.
//
// Every other format self-frames per item: `jsonl` is one record per line, `json` wraps each in
// braces. A TOON object is several bare `key: value` lines, so two events written back to back
// would run together with nothing marking the boundary — recoverable only by guessing that a
// repeated key starts a new record, which fails the moment a field is optional. Encoding the item
// as a one-element list gives each record its own `[1]` header at column 0, keeps the count
// marker honest about what follows, and leaves every other format untouched.
const streamItemText = (value: unknown, options: OutputOptions): string => {
  if (options.format !== 'toon') return serializeOutput(value, options);
  if (options.rawOutput && typeof value === 'string') return value;
  return serializeOutput([value], options);
};

const writeIterable = async (value: unknown, options: OutputOptions): Promise<void> => {
  if (!isAsyncIterable(value)) {
    await writeOutput(value, options);
    return;
  }
  if (options.maxItems === 0) {
    options.onLimit?.();
    return;
  }
  let written = 0;
  for await (const item of value) {
    if (options.failOnWebSocketError) throwWebSocketEventError(item);
    processStdout.write(streamItemText(transformValue(item, options.transform), options) + '\n');
    if (!countsTowardLimit(item, options)) continue;
    written += 1;
    if (options.maxItems !== undefined && options.maxItems > -1 && written >= options.maxItems) {
      options.onLimit?.();
      break;
    }
  }
};

// Paginated list commands auto-page across cursors: the SDK PagePromise iterates items across
// pages. `raw` is the explicit escape hatch for the unmodified single-response envelope, so it
// stays a single request with no auto-paging. For every other format we hand the page iterator
// to writeOutput, which already makes the right split: `jsonl` streams each item as it arrives,
// while `json`/`auto`/`pretty`/`yaml` collect the fully auto-paged items into one value (honoring
// --max-items either way). Routing through writeIterable here instead would stream items for
// every format, emitting newline-delimited objects under `--format json` (invalid as a single
// JSON document) and nothing at all for an empty result.
const writePaginated = async (result: unknown, options: OutputOptions): Promise<void> => {
  if (options.format === 'raw') {
    const page = await result;
    const envelope =
      page && typeof page === 'object' && 'body' in page ? (page as { body?: unknown }).body : undefined;
    await writeOutput(envelope ?? page, options);
    return;
  }
  if (isAsyncIterable(result)) {
    await writeOutput(result, options);
    return;
  }
  await writeOutput(await result, options);
};

const countsTowardLimit = (item: unknown, options: OutputOptions): boolean => {
  if (!options.failOnWebSocketError) return true;
  if (!item || typeof item !== 'object') return false;
  const type = (item as { type?: unknown }).type;
  return type === 'message' || type === 'raw';
};

// WebSocket SDKs expose lifecycle events as iterator values; error events should fail CLI commands.
const handleWebSocket = async (
  socket: unknown,
  params: Record<string, unknown>,
  options: OutputOptions,
): Promise<void> => {
  const closer = () => {
    closeSocket(socket, 'interrupted');
  };
  process.once('SIGINT', closer);
  try {
    const output = writeIterable(socket, {
      ...options,
      failOnWebSocketError: true,
      onLimit: () => closeSocket(socket, 'max-items reached'),
    });
    await Promise.resolve();
    const sendValue = params.send;
    if (sendValue !== undefined) sendSocketValue(socket, sendValue);
    if (!processStdin.isTTY) {
      const stdin = await readStdinValue();
      if (Object.keys(stdin).length > 0) sendSocketValue(socket, stdin.body ?? stdin);
    }
    await output;
  } finally {
    process.off('SIGINT', closer);
  }
};

const closeSocket = (socket: unknown, reason: string): void => {
  const close = (socket as { close?: (options?: unknown) => void }).close;
  if (typeof close === 'function') close.call(socket, { code: 1000, reason });
};

const sendSocketValue = (socket: unknown, value: unknown): void => {
  const send = (socket as { send?: (message: unknown) => void }).send;
  if (typeof send !== 'function') throw new Error('Generated CLI could not send on SDK WebSocket client');
  if (Array.isArray(value)) {
    for (const item of value) send.call(socket, item);
    return;
  }
  send.call(socket, value);
};

export const writeOutput = async (value: unknown, options: OutputOptions): Promise<void> => {
  if (isAsyncIterable(value)) {
    if (options.format === 'jsonl') {
      await writeIterable(value, options);
      return;
    }
    await writeOutput(await collectIterable(value, options.maxItems), options);
    return;
  }
  processStdout.write(serializeOutput(transformValue(value, options.transform), options) + '\n');
};

const collectIterable = async (
  value: AsyncIterable<unknown>,
  maxItems?: number,
): Promise<unknown[]> => {
  const items: unknown[] = [];
  for await (const item of value) {
    if (maxItems === 0) break;
    items.push(item);
    if (maxItems !== undefined && maxItems > -1 && items.length >= maxItems) break;
  }
  return items;
};

// `auto` renders like `json` (2-space pretty-printed): `pretty` is reserved for the distinct
// human-readable card view, matching warp-style CLI defaults.
const serializeOutput = (value: unknown, options: OutputOptions): string => {
  const normalized = options.format === 'auto' ? 'json' : options.format;
  if (options.rawOutput && typeof value === 'string') return value;
  const safeValue = value === undefined ? null : value;
  if (normalized === 'raw') return typeof safeValue === 'string' ? safeValue : JSON.stringify(safeValue);
  if (normalized === 'yaml') return stringifyYaml(JSON.parse(JSON.stringify(safeValue))).trimEnd();
  if (normalized === 'jsonl') return JSON.stringify(safeValue);
  if (normalized === 'pretty') return prettyCard(safeValue, options);
  // TOON keeps the JSON data model but drops repeated syntax, so a list response costs an agent
  // markedly fewer context tokens than the same data as JSON.
  if (normalized === 'toon') return encodeToon(JSON.parse(JSON.stringify(safeValue)));
  return JSON.stringify(safeValue, null, 2);
};

// Human-readable `pretty` view: a bordered key/value card titled with the command path,
// rendering booleans as yes/no and array entries as numbered items.
const prettyCard = (value: unknown, options: OutputOptions): string => {
  const lines = prettyLines(value, '');
  const width = Math.max(0, ...lines.map((line) => line.length));
  const body = lines.length > 0 ? lines : [''];
  return [
    ...(options.title ? ['  ' + options.title] : []),
    '\u256d' + '\u2500'.repeat(width + 2) + '\u256e',
    ...body.map((line) => '\u2502 ' + line.padEnd(width, ' ') + ' \u2502'),
    '\u2570' + '\u2500'.repeat(width + 2) + '\u256f',
  ].join('\n');
};

const prettyLines = (value: unknown, indent: string): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      const label = indent + (index + 1) + '.';
      if (item && typeof item === 'object') return [label, ...prettyLines(item, indent + '  ')];
      return [label + ' ' + prettyScalar(item)];
    });
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
      if (entry && typeof entry === 'object')
        return [indent + key + ':', ...prettyLines(entry, indent + '  ')];
      return [indent + key + ': ' + prettyScalar(entry)];
    });
  }
  return [indent + prettyScalar(value)];
};

const prettyScalar = (value: unknown): string => {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  if (value === null || value === undefined) return '';
  return String(value);
};

export const writeError = async (
  error: unknown,
  options: OutputOptions,
  clientOptions: readonly CliClientOptionDefinition[],
  SDK: CreateProgramOptions['SDK'],
): Promise<void> => {
  const body = transformValue(errorBody(error, clientOptions, SDK), options.transform);
  if (options.rawOutput && typeof body === 'string') {
    process.stderr.write(body + '\n');
    return;
  }
  if (options.format === 'raw') {
    // The hint is appended rather than dropped: before failures were classified, the auth hint
    // *was* the message, so printing the message alone would lose advice `raw` used to show.
    const hint = errorHintText(body);
    process.stderr.write(String(errorMessage(body)) + (hint ? ' ' + hint : '') + '\n');
    return;
  }
  const output = options.format === 'auto' ? 'pretty' : options.format;
  const safeBody = body === undefined ? null : body;
  const serialized = serializeErrorBody(safeBody, output);
  process.stderr.write((output === 'pretty' ? as.red(serialized) : serialized) + '\n');
};

const serializeErrorBody = (body: unknown, format: OutputFormat): string => {
  if (format === 'yaml') return stringifyYaml(body).trimEnd();
  if (format === 'toon') return encodeToon(JSON.parse(JSON.stringify(body)));
  return JSON.stringify(body, null, format === 'jsonl' ? 0 : 2);
};

const errorMessage = (value: unknown): unknown =>
  value && typeof value === 'object' && 'message' in value ? (value as { message?: unknown }).message : value;

/** The `hint` on an error body, when the body is one and carries a non-empty hint. */
const errorHintText = (value: unknown): string => {
  if (!value || typeof value !== 'object') return '';
  const hint = (value as { hint?: unknown }).hint;
  return typeof hint === 'string' ? hint : '';
};

const errorBody = (
  error: unknown,
  clientOptions: readonly CliClientOptionDefinition[],
  SDK: CreateProgramOptions['SDK'],
): Record<string, unknown> => {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const hint = errorHint(record, clientOptions);
    return {
      name: record.name,
      // Stable class identifier so a caller can branch on the kind of failure without parsing prose.
      code: errorCode(record, SDK),
      // The upstream message is passed through untouched; advice goes in `hint` beside it, so a
      // caller logging the message never loses what the API actually said.
      message: record.message ?? String(error),
      status: record.status,
      requestId: record.requestID ?? record.requestId,
      ...(hint !== undefined ? { hint } : {}),
      body: record.body ?? record.error,
    };
  }
  return { code: 'error', message: String(error) };
};

// Stable error class for the failure, derived from the HTTP status, or from the SDK error class
// for transport failures that never reached a response. Drives both the `code` field and the
// process exit status.
const errorCode = (record: Record<string, unknown>, SDK: CreateProgramOptions['SDK']): string => {
  const status = typeof record.status === 'number' ? record.status : undefined;
  if (status === 401 || status === 403) return 'auth-failed';
  if (status === 404) return 'not-found';
  if (status === 429) return 'rate-limited';
  if (status !== undefined && status >= 400 && status < 500) return 'client-error';
  if (status !== undefined && status >= 500) return 'server-error';
  if (isConnectionError(record, SDK)) return 'connection-error';
  return 'error';
};

// Identifies a transport failure — one that never reached a response, so there is no status to
// classify it by.
//
// Matched by identity against the error class the SDK exposes as a static, never by class name:
// release binaries are built with `bun build --compile --minify`, which renames classes, so
// `constructor.name` there is a mangled single letter and `.name` is the inherited "Error". The
// name check stays only as a fallback for a host object that is not an SDK error at all (an
// undici `ConnectTimeoutError` surfacing through a custom fetch, say).
// Transport failure codes Node and undici set on the error, none of which are CamelCase.
const CONNECTION_ERROR_CODE =
  /^(ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH|ENETUNREACH|EPIPE|UND_ERR)/u;

const isConnectionError = (
  record: Record<string, unknown>,
  SDK: CreateProgramOptions['SDK'],
): boolean => {
  const connectionError = (SDK as { APIConnectionError?: unknown }).APIConnectionError;
  if (
    typeof connectionError === 'function' &&
    record instanceof (connectionError as new () => unknown)
  )
    return true;
  const name = typeof record.name === 'string' ? record.name : '';
  const code = typeof record.code === 'string' ? record.code : '';
  // Class names are CamelCase (`ConnectTimeoutError`) but Node/undici transport codes are
  // SCREAMING_SNAKE_CASE (`ECONNREFUSED`, `UND_ERR_CONNECT_TIMEOUT`), so the two need different
  // tests: a substring match on the code would never fire, leaving a host that cannot be reached
  // through a custom fetch falling through to the unclassified status.
  if (name.includes('Connection') || name.includes('Timeout')) return true;
  return CONNECTION_ERROR_CODE.test(code);
};

// One exit status per error class so a caller can decide what to do next — fix credentials, back
// off, retry, give up — from the status alone.
const ERROR_EXIT_CODES: Record<string, number> = {
  error: 1,
  'auth-failed': 10,
  'not-found': 11,
  'rate-limited': 12,
  'client-error': 13,
  'server-error': 14,
  'connection-error': 15,
};

export const errorExitCode = (error: unknown, SDK: CreateProgramOptions['SDK']): number => {
  if (!error || typeof error !== 'object') return 1;
  return ERROR_EXIT_CODES[errorCode(error as Record<string, unknown>, SDK)] ?? 1;
};

// Actionable next step for the classes where one exists, surfaced beside the upstream message.
const errorHint = (
  error: Record<string, unknown>,
  clientOptions: readonly CliClientOptionDefinition[],
): string | undefined => {
  const status = error.status;
  if (status === 401) return authHint(clientOptions);
  // 403 is a permission failure, not a credential one: the request authenticated fine, so
  // telling the caller to set the auth env var would send it round the same loop again.
  if (status === 403) return 'Access denied. The credential is valid but lacks permission for this resource.';
  if (status === 404) return 'Resource not found. Check the identifier and path arguments.';
  if (status === 429) return 'Rate limited. Wait and retry, or reduce request frequency.';
  return undefined;
};

// Undefined when the SDK declares no authentication: there would be no variable to name, and a
// generic "set the required environment variable" would point at something that does not exist.
const authHint = (clientOptions: readonly CliClientOptionDefinition[]): string | undefined => {
  const authOptions = clientOptions.filter((option) => option.auth);
  if (authOptions.length === 0) return undefined;
  const env = authOptions
    .map((option) => option.env)
    .filter((value): value is string => !!value)
    .join(', ');
  return (
    'Authentication failed. Run `' + LOGIN_COMMAND + '`' + (env ? ', or set ' + env : '') + ', and try again.'
  );
};

// Keep transforms small and dependency-free; the CLI supports the common dot-path extraction case.
const transformValue = (value: unknown, transform: string | undefined): unknown => {
  if (!transform) return value;
  return transform
    .split('.')
    .filter(Boolean)
    .reduce<unknown>((current, segment) => {
      if (current === undefined || current === null) return undefined;
      if (Array.isArray(current) && /^\\d+$/u.test(segment)) return current[Number(segment)];
      if (typeof current === 'object') return (current as Record<string, unknown>)[segment];
      return undefined;
    }, value);
};

const throwWebSocketEventError = (value: unknown): void => {
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (record.type !== 'error') return;
  const error = record.error;
  if (error instanceof Error) throw error;
  throw new Error(typeof error === 'string' ? error : JSON.stringify(error ?? record));
};

const normalizeFormat = (value: string | undefined, fallback: OutputFormat): OutputFormat => {
  if (
    value === 'auto' ||
    value === 'json' ||
    value === 'jsonl' ||
    value === 'pretty' ||
    value === 'raw' ||
    value === 'toon' ||
    value === 'yaml'
  ) {
    return value;
  }
  return fallback;
};

const normalizeMaxItems = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.trunc(parsed);
};

const isAsyncIterable = (value: unknown): value is AsyncIterable<unknown> =>
  !!value && typeof (value as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function';

// Custom commands share generated credential, output, and error conventions.
export { normalizeFormat, usageExitCode };
