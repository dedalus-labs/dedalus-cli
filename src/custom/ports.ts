import type { CliCommandDefinition } from '../cli/runtime.js';

/** Preserve the port password flag when regenerating the public command table. */
export const withPortPasswords = (
  commands: readonly CliCommandDefinition[],
): readonly CliCommandDefinition[] =>
  commands.map((definition) => {
    if (definition.commandPath.join(' ') !== 'machines ports update') return definition;
    return {
      ...definition,
      flags: [
        ...definition.flags.filter((flag) => flag.name !== 'password'),
        {
          name: 'password',
          optionKey: 'password',
          paramKey: 'password',
          location: 'body',
          required: false,
          description:
            'Set or replace the sharing password on an existing key_required port. Exactly 8 ASCII letters or digits. Omit to preserve it.',
          valueKind: 'string',
        },
      ],
      validateParams: (params, command) => {
        definition.validateParams?.(params, command);
        const password = params['password'];
        if (password === undefined) return;
        if (typeof password !== 'string' || password.length !== 8 || !/^[A-Za-z0-9]+$/u.test(password)) {
          command.error('--password must contain exactly 8 ASCII letters or digits', { exitCode: 2 });
        }
        if (params['visibility'] !== 'key_required') {
          command.error('--password requires --visibility key_required on an existing key_required port', {
            exitCode: 2,
          });
        }
      },
    };
  });
