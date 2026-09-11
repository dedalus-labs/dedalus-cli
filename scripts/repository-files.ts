// @custom start
// Include untracked additions so new source cannot escape repository checks.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

/** Return tracked and unignored new files in the current repository. */
export function repositoryFiles(): string[] {
	return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
		encoding: "utf8",
	})
		.split("\0")
		.filter((path) => path !== "" && existsSync(path));
}
// @custom end
