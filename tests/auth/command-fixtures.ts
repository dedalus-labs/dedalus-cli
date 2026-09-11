// @custom start
/** Commander fixtures exercise the generated command boundary and auth error output. */
import assert from "node:assert/strict";
import { Command } from "commander";
import { formatDedalusError as formatError } from "../../src/auth/output-errors.js";
import { oauthSessionMetadata, type OAuthSession } from "../../src/auth/types.js";
import type { CredentialStore } from "../../src/auth/credentials.js";
import { commandSession, memoryStore } from "./fixtures.js";

/** Values produced by the option definitions in resourceProgram. */
export type CommandOptions = {
	apiKey?: string | null;
	xApiKey?: string | null;
	bearerAuth?: string | null | (() => string);
	baseUrl?: string;
	json?: boolean;
	format?: string;
	formatError?: string;
};

/** Assert the selected credential is the deferred bearer function. */
export const bearerToken = (value: CommandOptions["bearerAuth"]): string => {
	assert.equal(typeof value, "function");
	assert(typeof value === "function");
	return value();
};

/** A missing structured response fails the test at the auth formatting boundary. */
export const formatDedalusError = (
	error: unknown,
	command: Command | undefined,
): NonNullable<ReturnType<typeof formatError>> => {
	assert.ok(command, "Expected the command action to run");
	const result = formatError(error, command);
	assert.ok(result, "Expected a structured auth error");
	return result;
};

export const SESSION_METADATA = oauthSessionMetadata(commandSession());

/** Fresh command stores start signed in unless the test explicitly chooses no session. */
export const commandStore = (value: OAuthSession | null = commandSession()): CredentialStore =>
	memoryStore(value);

/** Register the same credential and format flags used by generated resource commands. */
export const resourceProgram = (onAction: (command: Command) => void): Command =>
	new Command()
		.option("--base-url <value>")
		.option("--api-key <value>")
		.option("--x-api-key <value>")
		.option("--bearer-auth <value>")
		.option("--format <value>", "", "auto")
		.option("--format-error <value>", "", "auto")
		.addCommand(
			new Command("machines")
				.option("--api-key <value>")
				.option("--x-api-key <value>")
				.option("--bearer-auth <value>")
				.option("--format <value>")
				.option("--format-error <value>")
				.action((_options: CommandOptions, command: Command) => onAction(command)),
		);
// @custom end
