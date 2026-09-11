// @custom start
// Provide the feedback and doctor commands around the generated SDK transport.
// Custom CLI feedback workflow; API transport and retries use the embedded SDK.

import { randomBytes } from "node:crypto";
import { Command, Option } from "commander";

import SDK from "../sdk/index.js";
import { VERSION } from "../sdk/version.js";
import {
	errorExitCode,
	sdkClientOptions,
	writeError,
	writeOutput,
	type CliClientOptionDefinition,
	type GlobalOptions,
} from "../cli/runtime.js";
import { buildFeedbackBundle, doctorReport, type IncludeLogs } from "./bundle.js";
import { debugDirectory, diagnosticScope } from "./diagnostics.js";

export const feedbackIdempotencyKey = (): string => {
	// UUIDv7: bytes 0..5 hold Unix milliseconds; byte 6 holds version 7;
	// byte 8 holds the RFC variant. Remaining bits are random.
	const bytes = randomBytes(16);
	bytes.writeUIntBE(Date.now(), 0, 6);
	bytes[6] = (bytes[6]! & 0x0f) | 0x70;
	bytes[8] = (bytes[8]! & 0x3f) | 0x80;
	return bytes.toString("hex");
};

export const registerFeedbackCommands = (
	program: Command,
	clientOptions: readonly CliClientOptionDefinition[],
	directory = debugDirectory(),
): Command => {
	const feedback = program
		.command("feedback <message>")
		.description("Send feedback with optional scrubbed CLI diagnostics")
		.addOption(
			new Option("--include-logs <mode>", "Include recent first-party diagnostics")
				.choices(["auto", "true", "false"])
				.default("auto"),
		)
		.option("--base-url <url>", "Override the base URL for API requests")
		.option("--x-dedalus-org-id <id>", "Organization for this feedback report")
		.option("--timeout <ms>", "Request timeout in milliseconds")
		.option("--max-retries <count>", "Number of retries for retryable failures")
		.option("--format <format>", "Output format: auto, json, jsonl, pretty, raw, toon, yaml");
	for (const option of clientOptions)
		feedback.option("--" + option.name + " <value>", option.description ?? "");
	feedback.action(async (message: string, _: unknown, command: Command) => {
		if (message.trim().length === 0 || [...message].length > 10000) {
			command.error("message must contain 1 to 10000 characters", { exitCode: 2 });
		}
		const options = command.optsWithGlobals<GlobalOptions & { includeLogs: IncludeLogs }>();
		try {
			const clientOptionsForRequest = sdkClientOptions(options, command, clientOptions);
			const client = new SDK({ ...clientOptionsForRequest, logLevel: "off" });
			const bundle = buildFeedbackBundle(
				options.includeLogs,
				diagnosticScope(clientOptionsForRequest),
				client.baseURL,
				VERSION,
				directory,
			);
			const metadata = {
				message,
				source: "cli",
				...(bundle.selection.command ? { command: bundle.selection.command } : {}),
				...(bundle.selection.receipt ? { reported_request_id: bundle.selection.receipt } : {}),
				...(bundle.selection.failure
					? { diagnostics: { last_api_failure: bundle.selection.failure } }
					: {}),
				client: { name: "dedalus-cli", version: VERSION },
				debug: {
					included: bundle.attachments.length > 0,
					files: bundle.attachments.map((file) => file.manifest),
				},
			};
			let body: unknown = metadata;
			if (bundle.attachments.length > 0) {
				const form = new FormData();
				form.set("metadata", JSON.stringify(metadata));
				for (const file of bundle.attachments) {
					form.append(
						"debug_files",
						new Blob([new Uint8Array(file.bytes)], { type: file.manifest.format }),
						file.manifest.filename,
					);
				}
				body = form;
			}
			const result = await client.post("/v1/feedback", {
				body,
				headers: { "Idempotency-Key": feedbackIdempotencyKey() },
			});
			await writeOutput(result, { format: options.format ?? "auto", title: "Feedback accepted" });
		} catch (error) {
			await writeError(error, { format: options.formatError ?? "auto" }, clientOptions, SDK);
			process.exitCode = errorExitCode(error, SDK);
		}
	});
	if (!program.commands.some((command) => command.name() === "doctor")) {
		program
			.command("doctor")
			.description("Show local runtime and redacted connectivity information")
			.option("--json", "Print the doctor report as JSON")
			.option("--base-url <url>", "API base URL to describe")
			.action(async (_: unknown, command: Command) => {
				const options = command.optsWithGlobals<GlobalOptions & { json?: boolean }>();
				const report = doctorReport(
					options.baseUrl ?? process.env["DEDALUS_BASE_URL"] ?? "https://dcs.dedaluslabs.ai",
					VERSION,
				);
				await writeOutput(report, { format: options.json ? "json" : "pretty", title: "Doctor" });
			});
	}
	return program;
};
// @custom end
