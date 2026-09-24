// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { getProgram } from './commands/index';

export { getProgram };

export const run = async (argv: readonly string[] = process.argv): Promise<void> => {
  await getProgram().parseAsync(argv);
};
