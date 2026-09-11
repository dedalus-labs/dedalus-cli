// @custom start
/**
 * Dedalus-owned commands and authentication for the generated command-line interface.
 *
 * Scalar generates resource commands. This adapter adds `auth`, selects one
 * credential, and maps authentication failures without exposing secrets.
 */

import { Command } from "commander";

import {
	CredentialStorageError,
	keyringCredentialStore,
	hasCredentialCustomHeader,
	type CredentialStore,
} from "./credentials.js";
import { createDedalusAuthProvider } from "./oauth/index.js";
import { PUBLIC_AUTH } from "./oauth/metadata.generated.js";
import { RESOURCE_SCHEMA } from "./schema.js";
import {
	formatDedalusError,
	loginOutput,
	logoutOutput,
	recordCredentialSource,
	runAuthAction,
	type SelectedCredential,
	statusOutput,
} from "./output.js";
import type { AuthProvider } from "./types.js";
import {
	accessTokenForCommand,
	type AuthStatus,
	login,
	type LoginResult,
	logout,
	type LogoutResult,
	selectedCredential,
	status,
} from "./workflow.js";

import { recoverableBearer } from "./recovery.js";

const AUTH_COMMAND_NAME = "auth";
const LOCAL_COMMAND_NAMES = new Set(["completion", "doctor"]);

export { formatDedalusError };

type AuthOperations = {
	readonly login: () => Promise<LoginResult>;
	readonly status: (
		flags: { readonly apiKey?: string; readonly bearerAuth?: string; readonly xApiKey?: string },
		offline: boolean,
	) => Promise<AuthStatus>;
	readonly logout: () => Promise<LogoutResult>;
};

type AuthCommandDependencies = {
	readonly environment: Readonly<Record<string, string | undefined>>;
	readonly operations: () => AuthOperations;
	readonly writeError: (value: string) => void;
	readonly writeOutput: (value: string) => void;
};

/** Substitute command I/O and auth dependencies without changing generated resource commands. */
export type DedalusCommandOptions = {
	readonly auth?: () => AuthOperations;
	readonly authProvider?: () => AuthProvider;
	readonly credentialStore?: () => CredentialStore;
	readonly environment?: Readonly<Record<string, string | undefined>>;
	readonly writeOutput?: (value: string) => void;
	readonly writeError?: (value: string) => void;
};

/** Add auth commands and select one credential before each generated resource action. */
export const addDedalusCommands = (
	program: Command,
	options: DedalusCommandOptions = {},
): Command => {
	if (program.commands.some((command) => command.name() === AUTH_COMMAND_NAME)) {
		throw new Error(`Scalar generated the reserved '${AUTH_COMMAND_NAME}' command`);
	}

	const environment = options.environment ?? process.env;
	let stored: CredentialStore | undefined;
	const credentialStore =
		options.credentialStore ??
		(() => {
			stored ??= keyringCredentialStore();
			return stored;
		});
	let configuredProvider: AuthProvider | undefined;
	const authProvider =
		options.authProvider ??
		(() => {
			configuredProvider ??= createDedalusAuthProvider(PUBLIC_AUTH);
			return configuredProvider;
		});
	const operations =
		options.auth ?? (() => defaultAuthOperations(environment, credentialStore, authProvider));
	const writeOutput = options.writeOutput ?? ((value) => process.stdout.write(value));
	const writeError = options.writeError ?? ((value) => process.stderr.write(value));
	const authCommand = createAuthCommand({ environment, operations, writeError, writeOutput });
	installJSONConvenience(program, new Set([authCommand]));
	const localCommands = program.commands.filter((command) =>
		LOCAL_COMMAND_NAMES.has(command.name()),
	);
	program.addCommand(authCommand);
	installCredentialInjection({
		program,
		environment,
		credentialStore,
		authProvider,
		exemptCommands: new Set([authCommand, ...localCommands]),
	});
	return program;
};

const createAuthCommand = ({
	environment,
	operations,
	writeError,
	writeOutput,
}: AuthCommandDependencies): Command => {
	const auth = new Command(AUTH_COMMAND_NAME).description("Manage the stored Dedalus CLI login");

	auth
		.command("login")
		.description("Sign in to Dedalus and store the OAuth session")
		.option("--json", "Print structured JSON output")
		.action(async (_commandOptions: unknown, command: Command) =>
			runAuthAction({
				action: async () => loginOutput(await operations().login()),
				source: "oauth_session",
				json: jsonRequested(command),
				writeOutput,
				writeError,
			}),
		);

	auth
		.command("status")
		.description("Show the active credential source without revealing secrets")
		.option("--api-key <value>", "Inspect an explicit Bearer API-key override")
		.option("--x-api-key <value>", "Inspect an explicit X-API-Key override")
		.option("--offline", "Read stored session metadata without contacting Dedalus")
		.option("--json", "Print structured JSON output")
		.action(
			async (
				commandOptions: { readonly json?: boolean; readonly offline?: boolean },
				command: Command,
			) => {
				const flags = command.optsWithGlobals<{
					readonly apiKey?: string;
					readonly bearerAuth?: string;
					readonly xApiKey?: string;
				}>();
				return runAuthAction({
					action: async () =>
						statusOutput(await operations().status(flags, Boolean(commandOptions.offline))),
					source: intendedCredential(flags, environment).source,
					json: jsonRequested(command),
					writeOutput,
					writeError,
				});
			},
		);

	auth
		.command("logout")
		.description("Revoke the OAuth session and verify local credential removal")
		.option("--json", "Print structured JSON output")
		.action(async (_commandOptions: unknown, command: Command) =>
			runAuthAction({
				action: async () => logoutOutput(await operations().logout()),
				source: "oauth_session",
				json: jsonRequested(command),
				writeOutput,
				writeError,
			}),
		);

	auth.action(() => auth.help());
	return auth;
};

const installJSONConvenience = (program: Command, exemptCommands: ReadonlySet<Command>): void => {
	if (!program.options.some((option) => option.long === "--json")) {
		program.option("--json", "Print structured JSON output");
	}
	const visit = (command: Command): void => {
		if (
			command.options.some((option) => option.long === "--format") &&
			!command.options.some((option) => option.long === "--json")
		) {
			command.option("--json", "Print structured JSON output");
		}
		for (const child of command.commands) visit(child);
	};
	for (const command of program.commands) visit(command);

	program.hook("preAction", async (_root, action) => {
		if ([...exemptCommands].some((command) => belongsTo(action, command)) || !jsonRequested(action))
			return;
		setCommandOption(action, "format", "json");
		setCommandOption(action, "formatError", "json");
	});
};

const jsonRequested = (command: Command): boolean =>
	Boolean(command.optsWithGlobals<{ readonly json?: boolean }>().json);

const defaultAuthOperations = (
	environment: Readonly<Record<string, string | undefined>>,
	store: () => CredentialStore,
	provider: () => AuthProvider,
): AuthOperations => ({
	login: () => login({ provider: provider(), store: store() }),
	status: (flags, offline) => status({ flags, environment }, store, provider, offline),
	logout: () => logout(store(), provider),
});

type CredentialInjectionDependencies = {
	readonly program: Command;
	readonly environment: Readonly<Record<string, string | undefined>>;
	readonly credentialStore: () => CredentialStore;
	readonly authProvider: () => AuthProvider;
	readonly exemptCommands: ReadonlySet<Command>;
};

const installCredentialInjection = ({
	program,
	environment,
	credentialStore,
	authProvider,
	exemptCommands,
}: CredentialInjectionDependencies): void => {
	program.hook("preAction", async (_root, action) => {
		if ([...exemptCommands].some((command) => belongsTo(action, command))) return;
		const flags = action.optsWithGlobals<{
			readonly apiKey?: string;
			readonly baseUrl?: string;
			readonly bearerAuth?: string;
			readonly xApiKey?: string;
		}>();
		const intended = intendedCredential(flags, environment);
		recordCredentialSource(action, intended);
		setCredentialOptions(action, { apiKey: null, xApiKey: null, bearerAuth: null });

		try {
			const selected = await selectedCredential({ flags, environment }, credentialStore);
			if (!selected) {
				recordCredentialSource(action, { source: "none" });
				setCredentialOptions(action, {
					apiKey: null,
					xApiKey: null,
					bearerAuth: rejectedCredential(new CredentialStorageError("not_logged_in")),
				});
				return;
			}
			recordCredentialSource(action, {
				source: selected.source,
				...(selected.source === "environment"
					? { label: selected.transport === "bearer" ? "DEDALUS_API_KEY" : "DEDALUS_X_API_KEY" }
					: {}),
			});
			if (selected.source === "oauth_session") {
				const provider = authProvider();
				requirePublicAPIOrigin(environment, provider.resource, flags.baseUrl);
				const accessToken = await accessTokenForCommand(credentialStore(), provider);
				setCredentialOptions(action, {
					apiKey: null,
					xApiKey: null,
					bearerAuth: await recoverableBearer(accessToken, credentialStore(), authProvider()),
				});
			} else if (selected.transport === "bearer") {
				setCredentialOptions(action, { apiKey: selected.value, xApiKey: null, bearerAuth: null });
			} else {
				setCredentialOptions(action, { apiKey: null, xApiKey: selected.value, bearerAuth: null });
			}
		} catch (error: unknown) {
			setCredentialOptions(action, {
				apiKey: null,
				xApiKey: null,
				bearerAuth: rejectedCredential(error),
			});
		}
	});
};

const requirePublicAPIOrigin = (
	environment: Readonly<Record<string, string | undefined>>,
	expectedOrigin: string,
	flagValue?: string,
): void => {
	const parsed = RESOURCE_SCHEMA.safeParse(
		flagValue ?? environment["DEDALUS_BASE_URL"] ?? expectedOrigin,
	);
	if (!parsed.success || parsed.data !== expectedOrigin) {
		throw new CredentialStorageError("environment_mismatch");
	}
};

const intendedCredential = (
	flags: { readonly apiKey?: string; readonly bearerAuth?: string; readonly xApiKey?: string },
	environment: Readonly<Record<string, string | undefined>>,
): SelectedCredential => {
	if (flags.apiKey !== undefined || flags.xApiKey !== undefined || flags.bearerAuth !== undefined) {
		return { source: "flag" };
	}
	if (
		hasCredentialCustomHeader(environment["DEDALUS_CUSTOM_HEADERS"]) ||
		environment["DEDALUS_API_KEY"] !== undefined ||
		environment["DEDALUS_X_API_KEY"] !== undefined ||
		environment["DEDALUS_BEARER_AUTH"] !== undefined
	) {
		return { source: "environment" };
	}
	return { source: "oauth_session" };
};

type CredentialOptionValues = {
	readonly apiKey: string | null;
	readonly xApiKey: string | null;
	readonly bearerAuth: (() => string) | null;
};

const setCredentialOptions = (action: Command, values: CredentialOptionValues): void => {
	let current: Command | null = action;
	while (current) {
		current.setOptionValueWithSource("apiKey", values.apiKey, "cli");
		current.setOptionValueWithSource("xApiKey", values.xApiKey, "cli");
		current.setOptionValueWithSource("bearerAuth", values.bearerAuth, "cli");
		current = current.parent;
	}
};

const setCommandOption = (action: Command, name: string, value: unknown): void => {
	let current: Command | null = action;
	while (current) {
		current.setOptionValueWithSource(name, value, "cli");
		current = current.parent;
	}
};

const rejectedCredential =
	(error: unknown): (() => never) =>
	() => {
		throw error;
	};

const belongsTo = (command: Command, ancestor: Command): boolean => {
	let current: Command | null = command;
	while (current) {
		if (current === ancestor) return true;
		current = current.parent;
	}
	return false;
};
// @custom end
