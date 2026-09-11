// @custom start
// Build bounded feedback attachments from the permitted diagnostic fields.
// First-party feedback attachments, constructed from allowlisted diagnostic fields.

import { createHash } from "node:crypto";
import { arch, platform } from "node:os";
import { gzipSync } from "node:zlib";

import { debugDirectory, selectDiagnostics, type DiagnosticSelection } from "./diagnostics.js";

export type IncludeLogs = "auto" | "true" | "false";
export type DebugFile = {
	filename:
		| "dedalus-feedback.log"
		| "dedalus-doctor-report.json"
		| "dedalus-connectivity-diagnostics.txt"
		| "dedalus-operation.jsonl.gz";
	format: "text/plain" | "application/json" | "application/gzip";
	sha256: string;
	size_bytes: number;
};
export type Attachment = { manifest: DebugFile; bytes: Uint8Array };

export const doctorReport = (baseURL: string, version: string) => ({
	client: { name: "dedalus-cli", version },
	runtime: { os: platform(), arch: arch(), node: process.versions.node },
	api_origin: new URL(baseURL).origin,
	auth_mode: "api_key",
	install_method: "node-package",
	proxy_environment: [
		"HTTPS_PROXY",
		"HTTP_PROXY",
		"ALL_PROXY",
		"NO_PROXY",
		"https_proxy",
		"http_proxy",
		"all_proxy",
		"no_proxy",
	]
		.filter((key) => !!process.env[key])
		.map((key) => ({ name: key, configured: true })),
	collection: {
		request_bodies: false,
		response_bodies: false,
		terminal_output: false,
		workspace_files: false,
	},
});

const attachment = (
	filename: DebugFile["filename"],
	format: DebugFile["format"],
	bytes: Uint8Array,
): Attachment => ({
	manifest: {
		filename,
		format,
		sha256: createHash("sha256").update(bytes).digest("hex"),
		size_bytes: bytes.byteLength,
	},
	bytes,
});

export const buildFeedbackBundle = (
	mode: IncludeLogs,
	scope: string,
	baseURL: string,
	version: string,
	directory = debugDirectory(),
): { selection: DiagnosticSelection; attachments: Attachment[] } => {
	let selection: DiagnosticSelection;
	try {
		selection = selectDiagnostics(scope, directory);
	} catch {
		process.stderr.write(
			"Recent local diagnostics could not be read; no saved logs will be attached.\n",
		);
		selection = { events: [] };
	}
	if (mode === "false") return { selection: { ...selection, events: [] }, attachments: [] };
	if (mode === "auto" && selection.events.length === 0) return { selection, attachments: [] };
	const doctor = Buffer.from(JSON.stringify(doctorReport(baseURL, version), null, 2));
	const connectivity = Buffer.from(
		"Connectivity diagnostics\nProxy values are omitted; configured variable names are listed in the doctor report.\n",
	);
	const attachments = [
		attachment("dedalus-doctor-report.json", "application/json", doctor),
		attachment("dedalus-connectivity-diagnostics.txt", "text/plain", connectivity),
	];
	// Preserve the newest complete rows. Both the plain log and gzip count toward the upload cap.
	const rows: string[] = [];
	let used = doctor.byteLength + connectivity.byteLength;
	for (const event of [...selection.events].reverse()) {
		const row = JSON.stringify(event) + "\n";
		const size = Buffer.byteLength(row);
		if (used + size > 450 * 1024) break;
		rows.unshift(row);
		used += size;
	}
	if (rows.length > 0) {
		const log = Buffer.from(rows.join(""));
		attachments.push(attachment("dedalus-feedback.log", "text/plain", log));
		attachments.push(attachment("dedalus-operation.jsonl.gz", "application/gzip", gzipSync(log)));
	}
	if (attachments.reduce((sum, file) => sum + file.bytes.byteLength, 0) > 1024 * 1024) {
		throw new Error("scrubbed feedback attachments exceed the upload limit");
	}
	return { selection, attachments };
};
// @custom end
