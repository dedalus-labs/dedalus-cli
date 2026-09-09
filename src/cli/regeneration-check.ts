import type { Command } from 'commander';

// @custom: Temporary command for hosted customization verification.
export const registerRegenerationCheck = (program: Command): void => {
  program
    .command('scalar-regeneration-check')
    .description('Verify a temporary Scalar customization')
    .action(() => {
      process.stdout.write('Scalar customization check passed\n');
    });
};
