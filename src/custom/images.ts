/** Image import coordinates the embedded SDK's upload and readiness workflow. */
import { Command, Option } from 'commander';
import SDK from '../sdk/index.js';
import { importImage, type Image } from '../sdk/helpers/images.js';
import type { CliAuthDefinition } from '../cli/login.js';
import {
  sdkClientOptions,
  writeError,
  writeOutput,
  errorExitCode,
  normalizeFormat,
  type CliClientOptionDefinition,
  type GlobalOptions,
} from '../cli/runtime.js';

export function addImageImport(
  program: Command,
  clientOptions: readonly CliClientOptionDefinition[],
  auth?: CliAuthDefinition,
): Command {
  const images =
    program.commands.find((command) => command.name() === 'images') ??
    program.command('images').description('Manage custom images');
  const command = images
    .command('import <archive>')
    .description('Upload a docker-save archive and wait until ready');
  for (const option of program.options) {
    if (option.long !== '--version') command.addOption(new Option(option.flags, option.description));
  }
  command
    .option('--name <name>', 'Image label')
    .addOption(
      new Option('--platform <platform>', 'Image architecture')
        .choices(['linux/amd64'])
        .default('linux/amd64'),
    )
    .option('--idempotency-key <key>', 'Reuse this key when retrying the same import')
    .option('--wait', 'Wait until ready (default)', true)
    .option('--no-wait', 'Return the image ID after registration; preparation continues')
    .option('--wait-timeout <seconds>', 'Total upload and readiness timeout in seconds', '3600')
    .action(async (path: string, _: unknown, cmd: Command) => {
      const flags = cmd.optsWithGlobals<
        GlobalOptions & {
          name?: string;
          idempotencyKey?: string;
          platform: 'linux/amd64';
          wait: boolean;
          waitTimeout: string;
        }
      >();
      const seconds = Number(flags.waitTimeout);
      if (!Number.isSafeInteger(seconds) || seconds <= 0 || seconds > 86400) {
        cmd.error('--wait-timeout must be an integer between 1 and 86400 seconds', { exitCode: 2 });
      }
      const controller = new AbortController();
      const interrupt = () =>
        controller.abort(new Error('Import interrupted. Accepted preparation continues on the server.'));
      process.once('SIGINT', interrupt);
      try {
        const client = new SDK(await sdkClientOptions(flags, cmd, clientOptions, auth));
        const result = await importImage(client, path, {
          wait: flags.wait,
          platform: flags.platform,
          timeoutMs: seconds * 1000,
          signal: controller.signal,
          ...(flags.name === undefined ? {} : { name: flags.name }),
          ...(flags.idempotencyKey === undefined ? {} : { idempotencyKey: flags.idempotencyKey }),
          onProgress: reportProgress,
        });
        await writeOutput(result, {
          format: normalizeFormat(flags.format, 'json'),
          ...(flags.transform === undefined ? {} : { transform: flags.transform }),
          ...(flags.rawOutput === undefined ? {} : { rawOutput: flags.rawOutput }),
        });
      } catch (error) {
        await writeError(error, { format: normalizeFormat(flags.formatError, 'json') }, clientOptions, SDK);
        process.exitCode = controller.signal.aborted ? 130 : errorExitCode(error, SDK);
      } finally {
        process.removeListener('SIGINT', interrupt);
      }
    });
  return program;
}

function reportProgress(image: Image): void {
  const context = image.context;
  const stage =
    context && typeof context === 'object' && 'stage' in context && typeof context.stage === 'string'
      ? `: ${context.stage}`
      : '';
  process.stderr.write(`Image ${image.image_id}: ${image.state}${stage}\n`);
}
