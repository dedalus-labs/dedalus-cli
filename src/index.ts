// File generated from our OpenAPI spec by Scalar. See README.md for details.

// @custom start
// Assemble authentication around Scalar's generated command tree.
import { getProgram } from './cli/program.js';
// @custom end

export { getProgram };

export const run = async (argv: readonly string[] = process.argv): Promise<void> => {
  await getProgram().parseAsync(argv);
};
