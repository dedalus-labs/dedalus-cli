// File generated from our OpenAPI spec by Scalar. See README.md for details.

import { stderr as processStderr, stdin as processStdin } from 'node:process';
import { createInterface } from 'node:readline';

// Set by `--no-input`, which the program records before any command runs.
let noInput = false;

/**
 * Records whether `--no-input` was passed, on every parse rather than only when it was: the package
 * exports `run`, so one process can parse twice, and a flag from the first run must not carry over.
 */
export const setNoInput = (value: boolean): void => {
  noInput = value;
};

/** Whether `--no-input` was passed, for a prompt with its own terminal checks (sign-in). */
export const inputDisabled = (): boolean => noInput;

/**
 * Whether this invocation can put a question to a person.
 *
 * Not with `--no-input`, which says so outright. Otherwise both ends have to be a terminal: the
 * question is written to stderr so stdout stays machine-readable, and an answer has to come from
 * stdin. Under CI both can still be terminals (a runner that allocates a pseudo-terminal), and
 * nobody is there to answer, so a set `CI` counts as no terminal at all.
 */
export const canPrompt = (): boolean =>
  !noInput && Boolean(processStdin.isTTY) && Boolean(processStderr.isTTY) && !runningInCi();

/**
 * Whether `CI` says this is a CI run. `CI=false` and `CI=0` are exported by hand to say the opposite,
 * so they count as unset, as does an empty value.
 */
const runningInCi = (): boolean => {
  const value = process.env.CI?.trim().toLowerCase();
  return value !== undefined && value !== '' && value !== 'false' && value !== '0';
};

/**
 * Reads one visible line from the terminal, writing the question to stderr.
 *
 * Resolves the trimmed answer, an empty string when the input ends before a line arrives, or
 * `undefined` when the user presses Ctrl-C. readline owns the terminal while it reads, so Ctrl-C
 * reaches it as a keystroke rather than as a signal, and without a listener of its own it would be
 * indistinguishable from end of input.
 */
export const promptLine = (label: string): Promise<string | undefined> =>
  new Promise<string | undefined>((resolve) => {
    const rl = createInterface({ input: processStdin, output: processStderr });
    let settled = false;
    const settle = (answer: string | undefined): void => {
      if (settled) return;
      settled = true;
      resolve(answer);
      rl.close();
    };
    rl.on('close', () => {
      if (!settled) processStderr.write('\n');
      settle('');
    });
    rl.on('SIGINT', () => {
      processStderr.write('\n');
      settle(undefined);
    });
    rl.question(label, (answer) => settle(answer.trim()));
  });
