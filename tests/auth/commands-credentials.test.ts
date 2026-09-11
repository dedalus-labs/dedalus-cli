// @custom start
/** Auth command contracts retain credential selection and safe output. */
import assert from "node:assert/strict";
import test from "node:test";
import { Command } from "commander";
import { addDedalusCommands } from "../../src/auth/commands.js";
import { commandSession as session, commandProvider as provider } from "./fixtures.js";
import {
	bearerToken,
	formatDedalusError,
	resourceProgram,
	commandStore as store,
	type CommandOptions,
} from "./command-fixtures.js";

test.afterEach(() => {
	process.exitCode = undefined;
});

test("invariant generated commands cannot shadow Dedalus commands", () => {
	const program = new Command().addCommand(new Command("auth"));
	assert.throws(() => addDedalusCommands(program), /Scalar generated the reserved 'auth' command/u);
});

test("invariant nested generated resource names cannot bypass credential injection", async () => {
	for (const nestedName of ["auth", "completion"]) {
		let options: CommandOptions = {};
		const program = new Command()
			.option("--base-url <value>")
			.option("--api-key <value>")
			.option("--x-api-key <value>")
			.option("--bearer-auth <value>")
			.addCommand(
				new Command("resources").addCommand(
					new Command(nestedName).addCommand(
						new Command("get").action((_options: CommandOptions, command: Command) => {
							options = command.optsWithGlobals<CommandOptions>();
						}),
					),
				),
			);
		addDedalusCommands(program, {
			environment: { DEDALUS_BASE_URL: "https://dcs.dedaluslabs.ai" },
			credentialStore: () => store(),
			authProvider: () => provider(),
		});

		await program.parseAsync(["node", "dedalus", "resources", nestedName, "get"]);
		assert.equal(bearerToken(options.bearerAuth), "oauth-access-token");
		assert.equal(options.baseUrl, undefined);
	}
});

test("invariant generated commands receive stored OAuth only as bearerAuth", async () => {
	let options: CommandOptions = {};
	const program = resourceProgram((command) => {
		options = command.optsWithGlobals();
	});
	addDedalusCommands(program, {
		environment: { DEDALUS_BASE_URL: "https://dcs.dedaluslabs.ai" },
		credentialStore: () => store(),
		authProvider: () => provider(),
	});

	await program.parseAsync(["node", "dedalus", "machines"]);
	assert.equal(options.apiKey, null);
	assert.equal(options.xApiKey, null);
	assert.equal(bearerToken(options.bearerAuth), "oauth-access-token");
	assert.equal(options.baseUrl, undefined);
});

test("invariant workload API keys use the generated API-key transport", async () => {
	let options: CommandOptions = {};
	const program = resourceProgram((command) => {
		options = command.optsWithGlobals();
	});
	addDedalusCommands(program, { environment: {} });

	await program.parseAsync(["node", "dedalus", "machines", "--api-key", "workload-key"]);

	assert.equal(options.apiKey, "workload-key");
	assert.equal(options.xApiKey, null);
	assert.equal(options.bearerAuth, null);
});

test("invariant JSON convenience remains in Dedalus-owned custom code", async () => {
	let options: CommandOptions = {};
	const program = resourceProgram((command) => {
		options = command.optsWithGlobals();
	});
	addDedalusCommands(program, {
		environment: { DEDALUS_API_KEY: "workload-key" },
	});

	await program.parseAsync(["node", "dedalus", "machines", "--json"]);

	assert.equal(options.json, true);
	assert.equal(options.format, "json");
	assert.equal(options.formatError, "json");
});

test("invariant an explicit workload key prevents OAuth reads and refresh", async () => {
	let reads = 0;
	let refreshes = 0;
	let options: CommandOptions = {};
	const program = resourceProgram((command) => {
		options = command.optsWithGlobals();
	});
	addDedalusCommands(program, {
		environment: { DEDALUS_API_KEY: "environment-key" },
		credentialStore: () => ({
			...store(),
			read: async () => {
				reads += 1;
				return session();
			},
		}),
		authProvider: () =>
			provider({
				refresh: async (value) => {
					refreshes += 1;
					return value;
				},
			}),
	});

	await program.parseAsync(["node", "dedalus", "--x-api-key", "flag-key", "machines"]);
	assert.equal(options.apiKey, null);
	assert.equal(options.xApiKey, "flag-key");
	assert.equal(options.bearerAuth, null);
	assert.equal(reads, 0);
	assert.equal(refreshes, 0);
});

test("invariant workload flags do not construct a lower-priority credential store", async () => {
	let options: CommandOptions = {};
	const program = resourceProgram((command) => {
		options = command.optsWithGlobals();
	});
	addDedalusCommands(program, {
		credentialStore: () => {
			throw new Error("must not construct credential store");
		},
	});

	await program.parseAsync(["node", "dedalus", "--api-key", "flag-key", "machines"]);

	assert.equal(options.apiKey, "flag-key");
	assert.equal(options.xApiKey, null);
	assert.equal(options.bearerAuth, null);
});

test("invariant workload environment keys do not construct a lower-priority credential store", async () => {
	let options: CommandOptions = {};
	const program = resourceProgram((command) => {
		options = command.optsWithGlobals();
	});
	addDedalusCommands(program, {
		credentialStore: () => {
			throw new Error("must not construct credential store");
		},
		environment: { DEDALUS_API_KEY: "environment-key" },
	});

	await program.parseAsync(["node", "dedalus", "machines"]);

	assert.equal(options.apiKey, "environment-key");
	assert.equal(options.xApiKey, null);
	assert.equal(options.bearerAuth, null);
});

test("invariant a workload flag ignores a lower-priority Bearer environment override", async () => {
	let options: CommandOptions = {};
	let reads = 0;
	const program = resourceProgram((command) => {
		options = command.optsWithGlobals();
	});
	addDedalusCommands(program, {
		environment: { DEDALUS_BEARER_AUTH: "unsupported-lower-priority-token" },
		credentialStore: () => ({
			...store(),
			read: async () => {
				reads += 1;
				return session();
			},
		}),
	});

	await program.parseAsync(["node", "dedalus", "--api-key", "flag-key", "machines"]);

	assert.equal(options.apiKey, "flag-key");
	assert.equal(options.bearerAuth, null);
	assert.equal(reads, 0);
});

test("invariant generated commands receive exactly one workload credential", async () => {
	let options: CommandOptions = {};
	let actionCommand: Command | undefined;
	const program = resourceProgram((command) => {
		actionCommand = command;
		options = command.optsWithGlobals();
	});
	addDedalusCommands(program, { environment: {} });

	await program.parseAsync([
		"node",
		"dedalus",
		"--api-key",
		"first-key",
		"--x-api-key",
		"second-key",
		"machines",
	]);

	let error;
	assert.throws(
		() => {
			try {
				bearerToken(options.bearerAuth);
			} catch (caught: unknown) {
				error = caught;
				throw caught;
			}
		},
		(caught) =>
			caught instanceof Error && "code" in caught && caught.code === "ambiguous_credential",
	);
	assert.equal(formatDedalusError(error, actionCommand).error.credential_source, "flag");
	assert.equal(options.apiKey, null);
	assert.equal(options.xApiKey, null);
});

test("invariant direct Bearer overrides cannot bypass OAuth selection", async () => {
	let options: CommandOptions = {};
	const program = resourceProgram((command) => {
		options = command.optsWithGlobals();
	});
	addDedalusCommands(program, { environment: {} });

	await program.parseAsync(["node", "dedalus", "--bearer-auth", "bypass-token", "machines"]);

	assert.throws(
		() => bearerToken(options.bearerAuth),
		(error) => error instanceof Error && "code" in error && error.code === "unsupported_credential",
	);
	assert.equal(options.apiKey, null);
	assert.equal(options.xApiKey, null);
});

test("invariant a missing credential is reported as source none without a fake HTTP response", async () => {
	let actionCommand: Command | undefined;
	let networkCalls = 0;
	const program = resourceProgram((command) => {
		actionCommand = command;
		bearerToken(command.optsWithGlobals<CommandOptions>().bearerAuth);
		networkCalls += 1;
	});
	addDedalusCommands(program, {
		environment: {},
		credentialStore: () => store(null),
		authProvider: () => provider(),
	});

	let failure;
	await assert.rejects(program.parseAsync(["node", "dedalus", "machines"]), (error) => {
		failure = error;
		return error instanceof Error && "code" in error && error.code === "not_logged_in";
	});
	const body = formatDedalusError(failure, actionCommand);

	assert.deepEqual(body.error, {
		code: "cli_no_credential",
		message: "Not logged in. Run 'dedalus auth login'.",
		retryable: false,
		credential_source: "none",
	});
	assert.equal(networkCalls, 0);
});
// @custom end
