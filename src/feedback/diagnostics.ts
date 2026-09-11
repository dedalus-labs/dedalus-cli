// @custom start
// Record and select privacy-filtered local diagnostics for feedback submissions.

import { createHash, randomUUID } from "node:crypto";
import {
	appendFileSync,
	constants,
	existsSync,
	lstatSync,
	mkdirSync,
	openSync,
	closeSync,
	readFileSync,
	readdirSync,
	statSync,
	unlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const debugDirectory = (): string => join(homedir(), ".dedalus", "debug");
const retentionMS = 10 * 24 * 60 * 60 * 1000;
const directoryLimit = 50 * 1024 * 1024;
const partitionLimit = 10 * 1024 * 1024;
const recentMS = 15 * 60 * 1000;
const logName = /^[0-9a-f]{64}\.[0-9]+\.[0-9a-f-]{36}\.jsonl$/;
const receiptPattern = /^[0-9a-f]{12}7[0-9a-f]{3}[89ab][0-9a-f]{15}$/;
const kinds = [
	"command_start",
	"request_start",
	"response",
	"transport_failure",
	"command_failure",
	"command_complete",
] as const;
const commandWords = new Set([
	"dedalus",
	"machines",
	"networks",
	"usage",
	"list",
	"create",
	"retrieve",
	"update",
	"delete",
	"watch",
	"sleep",
	"wake",
	"network",
	"artifacts",
	"ports",
	"ssh",
	"executions",
	"events",
	"output",
	"logs",
	"token",
	"reauthorize",
	"terminals",
	"connect",
	"machine-compute",
	"machine-storage",
	"feedback",
]);

export type DiagnosticEvent = {
	ts: string;
	kind: (typeof kinds)[number];
	command: string;
	route?: string;
	request_id?: string;
	status_code?: number;
	duration_ms?: number;
};

export type DiagnosticSelection = {
	events: DiagnosticEvent[];
	command?: string;
	receipt?: string;
	failure?: { status_code: number; duration_ms: number; route: string };
};

// The credential digest stays in local filenames and is never included in uploads.
// A receipt from another API host, organization override, or API key cannot become a candidate.
export const diagnosticScope = (options: Record<string, unknown>): string =>
	createHash("sha256")
		.update(
			JSON.stringify([
				options.baseURL ?? process.env["DEDALUS_BASE_URL"] ?? "https://dcs.dedaluslabs.ai",
				options.bearerAuth ?? process.env["DEDALUS_BEARER_AUTH"] ?? "",
				options.apiKey ?? process.env["DEDALUS_API_KEY"] ?? "",
				options.xAPIKey ?? process.env["DEDALUS_X_API_KEY"] ?? "",
				options.dedalusOrgID ?? process.env["DEDALUS_ORG_ID"] ?? "",
				process.env["DEDALUS_CUSTOM_HEADERS"] ?? "",
			]),
		)
		.digest("hex");

const files = (directory: string): { path: string; name: string; size: number; time: number }[] => {
	if (!existsSync(directory)) return [];
	if (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) {
		throw new Error("diagnostic directory must be a real directory");
	}
	return readdirSync(directory)
		.filter((name) => logName.test(name))
		.flatMap((name) => {
			const path = join(directory, name);
			const info = lstatSync(path);
			return info.isFile() && !info.isSymbolicLink()
				? [{ path, name, size: info.size, time: info.mtimeMs }]
				: [];
		});
};

export const pruneDiagnostics = (directory = debugDirectory(), now = Date.now()): void => {
	const entries = files(directory).sort((a, b) => a.time - b.time);
	let total = entries.reduce((sum, entry) => sum + entry.size, 0);
	for (const entry of entries) {
		if (entry.time >= now - retentionMS && total <= directoryLimit) continue;
		unlinkSync(entry.path);
		total -= entry.size;
	}
};

// Reconstruct only the allowlisted event fields, including when reading local files.
// No request bodies, command arguments, headers, error messages, or environment values enter logs.
const parseEvent = (value: unknown): DiagnosticEvent | undefined => {
	if (!value || typeof value !== "object") return undefined;
	const row = value as Record<string, unknown>;
	if (typeof row["kind"] !== "string" || !kinds.some((kind) => kind === row["kind"]))
		return undefined;
	if (typeof row["command"] !== "string" || !/^dedalus(?: [a-z-]+){1,5}$/.test(row["command"]))
		return undefined;
	if (row["command"].split(" ").some((word) => !commandWords.has(word))) return undefined;
	if (typeof row["ts"] !== "string" || !Number.isFinite(Date.parse(row["ts"]))) return undefined;
	const result: DiagnosticEvent = {
		ts: new Date(row["ts"]).toISOString(),
		kind: row["kind"] as DiagnosticEvent["kind"],
		command: row["command"],
	};
	if (
		typeof row["route"] === "string" &&
		/^\/v1(?:\/(?:[a-z-]+|\{[a-z_]+\})){1,9}$/.test(row["route"])
	)
		result.route = row["route"];
	if (typeof row["request_id"] === "string" && receiptPattern.test(row["request_id"]))
		result.request_id = row["request_id"];
	if (
		typeof row["status_code"] === "number" &&
		Number.isInteger(row["status_code"]) &&
		row["status_code"] >= 100 &&
		row["status_code"] <= 599
	)
		result.status_code = row["status_code"];
	if (
		typeof row["duration_ms"] === "number" &&
		Number.isSafeInteger(row["duration_ms"]) &&
		row["duration_ms"] >= 0
	)
		result.duration_ms = row["duration_ms"];
	return result;
};

const routeTemplate = (input: RequestInfo | URL): string => {
	const url = new URL(input instanceof Request ? input.url : String(input));
	const parts = url.pathname.split("/");
	if (parts[1] !== "v1" || parts[2] !== "machines") return "/v1/{resource}";
	if (parts.length > 3) parts[3] = "{machine_id}";
	const resources = new Set([
		"executions",
		"ssh",
		"ports",
		"artifacts",
		"terminals",
		"sleep",
		"wake",
		"network",
		"status",
	]);
	if (parts[4] && !resources.has(parts[4])) return "/v1/machines/{machine_id}/{resource}";
	if (parts[5] && parts[4] !== "status") parts[5] = "{resource_id}";
	if (
		parts
			.slice(6)
			.some(
				(part) => !["events", "logs", "output", "token", "reauthorize", "stream"].includes(part),
			)
	)
		return "/v1/machines/{machine_id}/{resource}";
	return parts.join("/");
};

export const createDiagnostics = (command: string, scope: string, directory = debugDirectory()) => {
	let count = 0;
	let disabled = false;
	const path = join(directory, `${scope}.${Date.now()}.${randomUUID()}.jsonl`);
	const record = (event: Omit<DiagnosticEvent, "ts" | "command">): void => {
		if (disabled || count >= 1000) return;
		try {
			const safe = parseEvent({ ...event, command, ts: new Date().toISOString() });
			if (!safe) throw new Error("invalid diagnostic event");
			mkdirSync(directory, { recursive: true, mode: 0o700 });
			if (lstatSync(directory).isSymbolicLink())
				throw new Error("diagnostic directory is a symlink");
			const line = JSON.stringify(safe) + "\n";
			if (existsSync(path) && statSync(path).size + Buffer.byteLength(line) > partitionLimit)
				return;
			const fd = openSync(
				path,
				constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND | constants.O_NOFOLLOW,
				0o600,
			);
			try {
				appendFileSync(fd, line);
			} finally {
				closeSync(fd);
			}
			count++;
			pruneDiagnostics(directory);
		} catch {
			disabled = true;
			process.stderr.write("Local diagnostic recording is unavailable.\n");
		}
	};
	record({ kind: "command_start" });
	const fetchWithDiagnostics: typeof fetch = async (input, init) => {
		const route = routeTemplate(input);
		const start = performance.now();
		record({ kind: "request_start", route });
		try {
			const response = await fetch(input, init);
			const receipt = response.headers.get("x-request-id");
			record({
				kind: "response",
				route,
				status_code: response.status,
				duration_ms: Math.max(0, Math.round(performance.now() - start)),
				...(receipt ? { request_id: receipt } : {}),
			});
			return response;
		} catch (error) {
			record({
				kind: "transport_failure",
				route,
				duration_ms: Math.max(0, Math.round(performance.now() - start)),
			});
			throw error;
		}
	};
	return { fetch: fetchWithDiagnostics, record };
};

export const selectDiagnostics = (
	scope: string,
	directory = debugDirectory(),
	now = Date.now(),
): DiagnosticSelection => {
	const candidates = files(directory)
		.filter(
			(file) =>
				file.name.startsWith(scope + ".") &&
				file.time >= now - recentMS &&
				file.size <= partitionLimit,
		)
		.sort((a, b) => b.time - a.time);
	for (const file of candidates) {
		const fd = openSync(file.path, constants.O_RDONLY | constants.O_NOFOLLOW);
		let text: string;
		try {
			text = readFileSync(fd, "utf8");
		} finally {
			closeSync(fd);
		}
		const events = text
			.split("\n")
			.filter(Boolean)
			.slice(-1000)
			.flatMap((line) => {
				try {
					const event = parseEvent(JSON.parse(line));
					return event &&
						event.command !== "dedalus feedback" &&
						Date.parse(event.ts) >= now - recentMS
						? [event]
						: [];
				} catch {
					return [];
				}
			});
		const outcome = events.findLast((row) => row.kind === "command_failure");
		if (!outcome) continue;
		const response = events.findLast((row) => row.kind === "response");
		const receipt = response?.request_id;
		return {
			events,
			command: outcome.command,
			...(receipt ? { receipt } : {}),
			...(response?.status_code !== undefined &&
			response.status_code >= 400 &&
			response.duration_ms !== undefined &&
			response.route
				? {
						failure: {
							status_code: response.status_code,
							duration_ms: response.duration_ms,
							route: response.route,
						},
					}
				: {}),
		};
	}
	return { events: [] };
};
// @custom end
