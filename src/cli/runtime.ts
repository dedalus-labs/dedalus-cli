// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { stdin as processStdin, stdout as processStdout } from 'node:process';

import as from 'ansis';
import { Command } from 'commander';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { encodeToon } from './toon.js';

type OutputFormat = 'auto' | 'json' | 'jsonl' | 'pretty' | 'raw' | 'toon' | 'yaml';

export type CliValueKind = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'unknown';

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
  // Param key of a body blob that is forwarded bare or spread into params, depending on callShape.
  readonly bodyParamKey?: string;
  readonly positional: readonly CliFlagDefinition[];
  readonly flags: readonly CliFlagDefinition[];
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
  // Completion script per shell, generated alongside the command table. Absent when the SDK
  // config disables shell completions, in which case no `completion` command is registered.
  readonly completions?: Readonly<Record<string, string>>;
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

type GlobalOptions = {
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
  completions,
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
    .option('--format <format>', 'Output format: auto, json, jsonl, pretty, raw, toon, yaml', defaultFormat)
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

  for (const definition of commands) addGeneratedCommand(program, SDK, clientOptions, definition);

  if (completions) addCompletionCommand(program, binaryName, completions);

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

const clientOptionDescription = (option: CliClientOptionDefinition): string => {
  const parts: string[] = [];
  if (option.description) parts.push(option.description);
  if (option.env) parts.push('(can also be set with ' + option.env + ' env var)');
  // Stated last, matching resolution order: the flag wins, then the env var, then this value.
  if (option.defaultValue !== undefined) parts.push('(defaults to ' + option.defaultValue + ')');
  return parts.join(' ');
};

const addGeneratedCommand = (
  program: Command,
  SDK: CreateProgramOptions['SDK'],
  clientOptions: readonly CliClientOptionDefinition[],
  definition: CliCommandDefinition,
): void => {
  const parent = ensureCommandPath(program, definition.commandPath.slice(0, -1));
  const commandName = definition.commandPath.at(-1) ?? definition.methodName;
  const command = usageExitCode(new Command(commandName))
    .description(definition.summary ?? definition.description ?? '')
    .showHelpAfterError()
    .option('--base-url <url>', 'Override the base URL for API requests')
    .option('--timeout <ms>', 'Request timeout in milliseconds')
    .option('--max-retries <count>', 'Number of retries for retryable failures')
    .option('--format <format>', 'Output format: auto, json, jsonl, pretty, raw, toon, yaml')
    .option('--format-error <format>', 'Error output format: auto, json, jsonl, pretty, raw, toon, yaml')
    .option('--transform <path>', 'Dot-path transform for data output')
    .option('--transform-error <path>', 'Dot-path transform for error output')
    .option('-r, --raw-output', 'Print transformed string values without JSON quotes')
    .option('--debug', 'Enable SDK debug logging');

  // Mirror configured client-option flags on the subcommand so they can appear before or after the verb.
  for (const option of clientOptions) {
    command.option('--' + option.name + ' <value>', clientOptionDescription(option));
  }

  if (definition.iterable)
    command.option('--max-items <count>', 'Maximum number of streamed items to print; use -1 for unlimited');

  // Positionals are registered as optional Commander arguments because each one is also
  // accepted as an equivalent flag (e.g. `workers retrieve wkr_1` or `workers retrieve --id
  // wkr_1`); requiredness is enforced at call time once both spellings have been merged.
  for (const positional of definition.positional) {
    command.argument('[' + positional.name + ']', positional.description ?? '');
  }

  for (const flag of definition.flags) {
    const value = flag.valueKind === 'boolean' ? '' : ' <value>';
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
  for (const positional of definition.positional) {
    if (command.options.some((option) => option.long === '--' + positional.name)) continue;
    command.option('--' + positional.name + ' <value>', positional.description ?? '');
  }

  command.action(async (...args: unknown[]) => {
    const command = args.at(-1);
    if (!(command instanceof Command)) throw new Error('Expected Commander command context');
    const positionalValues = args.slice(0, -1);
    await runGeneratedCommand(SDK, clientOptions, definition, command, positionalValues);
  });

  parent.addCommand(command);
};

const ensureCommandPath = (program: Command, path: readonly string[]): Command => {
  let parent = program;
  for (const part of path) {
    const existing = parent.commands.find((command) => command.name() === part);
    if (existing) {
      parent = existing;
      continue;
    }
    const next = usageExitCode(new Command(part)).showHelpAfterError();
    parent.addCommand(next);
    parent = next;
  }
  return parent;
};

const runGeneratedCommand = async (
  SDK: CreateProgramOptions['SDK'],
  clientOptions: readonly CliClientOptionDefinition[],
  definition: CliCommandDefinition,
  command: Command,
  positionalValues: readonly unknown[],
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

  try {
    const client = new SDK(sdkClientOptions(rootOptions, command, clientOptions)) as Record<string, unknown>;
    const method = sdkMethod(client, definition);
    const call = await callArguments(definition, command.opts<Record<string, unknown>>(), positionalValues);

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
    await writeError(error, errorOptions, clientOptions, SDK);
    process.exitCode = errorExitCode(error, SDK);
  }
};

const sdkClientOptions = (
  options: GlobalOptions,
  command: Command,
  clientOptions: readonly CliClientOptionDefinition[],
): Record<string, unknown> => {
  // Forward configured client-option flags (auth keys, org headers, etc.) to the embedded SDK
  // using the SDK-facing camelCased key. Only forward values that were explicitly set so the
  // SDK's own env-var fallback keeps working when no CLI flag was passed.
  const raw = options as unknown as Record<string, unknown>;
  const forwarded: Record<string, unknown> = {};
  for (const option of clientOptions) {
    const value = raw[option.optionKey];
    if (value !== undefined) forwarded[option.sdkKey] = value;
  }
  return {
    ...(options.baseUrl ? { baseURL: options.baseUrl } : {}),
    ...(options.timeout ? { timeout: Number(options.timeout) } : {}),
    ...(options.maxRetries ? { maxRetries: Number(options.maxRetries) } : {}),
    ...(options.debug ? { logLevel: 'debug' } : {}),
    ...forwarded,
    defaultHeaders: {
      'X-Scalar-Lang': 'cli',
      'X-Scalar-Runtime': 'cli',
      'X-Scalar-CLI-Command': command.name(),
    },
  };
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
    if (value !== undefined) positionalParams[param.paramKey] = coerceValue(value, param.valueKind);
  });

  const flagParams: Record<string, unknown> = {};
  for (const flag of definition.flags) {
    if (flag.objectPath) continue;
    const value = options[flag.optionKey];
    if (value !== undefined) flagParams[flag.paramKey] = coerceValue(value, flag.valueKind);
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
      coerceValue(value, flag.valueKind),
    );
  }

  const stdin = await readStdinValue();
  const params = mergeObjects(stdin, { ...flagParams, ...positionalParams });
  const positionalArgs = definition.positional.map((param) => params[param.paramKey]);
  const sdkParams = definition.transport === 'websocket' ? omitParams(params, ['send']) : params;

  if (definition.callShape === 'options') return { args: [...positionalArgs, undefined], params };
  if (definition.callShape === 'body')
    return { args: [...positionalArgs, bodyValue(sdkParams, definition), undefined], params };
  return { args: [...positionalArgs, paramsValue(sdkParams, definition), undefined], params };
};

const paramsValue = (params: Record<string, unknown>, definition: CliCommandDefinition): unknown => {
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
  const bodyFlags = definition.flags.filter((flag) => flag.location === 'body' && flag.paramKey !== 'send');
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

const parseStructuredValue = (source: string): unknown => {
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

const omitParams = (params: Record<string, unknown>, names: readonly string[]): Record<string, unknown> => {
  const out = { ...params };
  for (const name of names) delete out[name];
  return out;
};

const coerceValue = (value: unknown, kind: CliValueKind): unknown => {
  if (Array.isArray(value))
    return value.map((item) => coerceValue(item, kind === 'array' ? 'unknown' : kind));
  if (typeof value !== 'string') return value;
  if (kind === 'boolean') return value === 'true' || value === '1';
  if (kind === 'number' || kind === 'integer') return Number(value);
  if (kind === 'object' || kind === 'array' || kind === 'unknown') return parseStructuredValue(value);
  return value;
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

const writeOutput = async (value: unknown, options: OutputOptions): Promise<void> => {
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

const collectIterable = async (value: AsyncIterable<unknown>, maxItems?: number): Promise<unknown[]> => {
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

const writeError = async (
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
      body: record.body,
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

const isConnectionError = (record: Record<string, unknown>, SDK: CreateProgramOptions['SDK']): boolean => {
  const connectionError = (SDK as { APIConnectionError?: unknown }).APIConnectionError;
  if (typeof connectionError === 'function' && record instanceof (connectionError as new () => unknown))
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

const errorExitCode = (error: unknown, SDK: CreateProgramOptions['SDK']): number => {
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
  return env
    ? 'Authentication failed. Set ' + env + ' and try again.'
    : 'Authentication failed. Set the required authentication environment variable and try again.';
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
