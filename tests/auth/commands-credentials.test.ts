// @custom start
/** Auth registration preserves one credential source for generated commands. */
import assert from "node:assert/strict";
import test from "node:test";
import { Command } from "commander";
import { addDedalusCommands } from "../../src/auth/commands.js";
import { commandProvider as provider } from "./fixtures.js";
import {
	bearerToken,
	resourceProgram,
	commandStore as store,
	type CommandOptions,
} from "./command-fixtures.js";

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

// @custom end
