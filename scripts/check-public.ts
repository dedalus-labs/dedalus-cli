// @custom start
// Keep internal deployment literals out of source, builds, and extracted artifacts.
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { repositoryFiles } from "./repository-files.js";

const PUBLIC_HOSTS = new Set(["dcs.dedaluslabs.ai", "www.dedaluslabs.ai"]);
const DEPLOYMENT_HOST =
	/\b(?:[a-z0-9-]+\.)*(?:dedaluslabs\.ai|clerk\.accounts\.dev|clerk\.com)\b/giu;
const PRIVATE_CONFIG = /\bDEDALUS_(?:AUTH_CONFIG|CLERK_[A-Z_]+|SIGN_IN_URL)\b/gu;

function decoded(text: string): string {
	return text
		.replace(
			/\\(?:u([\da-f]{4})|x([\da-f]{2}))/giu,
			(_match: string, unicode: string | undefined, hex: string | undefined) =>
				String.fromCharCode(Number.parseInt(unicode ?? hex ?? "0", 16)),
		)
		.replace(/%([\da-f]{2})/giu, (_match: string, hex: string) =>
			String.fromCharCode(Number.parseInt(hex, 16)),
		)
		.replace(/\\\//gu, "/");
}

/** Count prohibited literals while keeping their values out of diagnostics. */
export function publicViolations(content: string): number {
	const variants = new Set([content]);
	let value = content;
	for (let round = 0; round < 4; round++) {
		value = decoded(value);
		variants.add(value);
	}
	for (const encoded of content.matchAll(/[A-Za-z0-9+/_-]{24,}={0,2}/gu)) {
		variants.add(Buffer.from(encoded[0], "base64").toString("utf8"));
	}
	const violations = new Set<string>();
	for (const variant of variants) {
		for (const match of variant.matchAll(DEPLOYMENT_HOST)) {
			if (!PUBLIC_HOSTS.has(match[0].toLowerCase())) violations.add(match[0].toLowerCase());
		}
		for (const match of variant.matchAll(PRIVATE_CONFIG)) violations.add(match[0]);
	}
	return violations.size;
}

/** Scan files and return only filenames with violation counts. */
export function scanPublicFiles(files: readonly string[]): string[] {
	return files.flatMap((path) => {
		const count = publicViolations(readFileSync(path, "utf8"));
		return count === 0 ? [] : [`${path}: ${count} prohibited public literals`];
	});
}

/** Enumerate an artifact directory without following external symbolic links. */
export function artifactFiles(path: string): string[] {
	const stat = lstatSync(path);
	if (stat.isSymbolicLink())
		throw new Error("artifact symbolic links must be resolved before scanning");
	if (!stat.isDirectory()) {
		if (/\.(?:tgz|gz|zip|xz|br|bz2|7z)$/iu.test(path)) {
			throw new Error("extract compressed artifacts before public scanning");
		}
		return [path];
	}
	return readdirSync(path).flatMap((name) => artifactFiles(join(path, name)));
}

const invoked = process.argv[1];
if (invoked && resolve(invoked) === fileURLToPath(import.meta.url)) {
	const requested = process.argv.slice(2);
	const paths =
		requested.length > 0
			? requested.flatMap(artifactFiles)
			: [
					...repositoryFiles().filter(existsSync),
					...["dist", "release-binaries", "compile-out"].filter(existsSync).flatMap(artifactFiles),
				];
	const errors = scanPublicFiles([...new Set(paths)]);
	if (errors.length > 0) {
		process.stderr.write(errors.join("\n") + "\n");
		process.exitCode = 1;
	}
}
// @custom end
