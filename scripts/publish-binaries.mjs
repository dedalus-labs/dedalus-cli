// Both release workflows call this after compilation. Published archives stay
// immutable; retries fill missing assets and download the bytes Homebrew hashes.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const repository = process.env.GITHUB_REPOSITORY;
if (!repository) throw new Error("GITHUB_REPOSITORY is required");
const tag = `v${version}`;
const archives = [
  "dedalus-linux-x64.tar.gz",
  "dedalus-linux-arm64.tar.gz",
  "dedalus-darwin-x64.tar.gz",
  "dedalus-darwin-arm64.tar.gz",
  "dedalus-windows-x64.zip",
];
const run = (args, capture = false) => {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`gh release failed with exit code ${result.status}`);
  return result.stdout;
};
const { assets } = JSON.parse(
  run(["release", "view", tag, "--repo", repository, "--json", "assets"], true),
);
const published = new Set(assets.map(({ name }) => name));
for (const archive of archives) {
  if (published.has(archive)) continue;
  // Never replace an asset: a merged Homebrew formula may already pin its bytes.
  run([
    "release", "upload", tag, join("release-binaries", archive),
    "--repo", repository,
  ]);
}

const directory = mkdtempSync(join(tmpdir(), "dedalus-release-"));
try {
  for (const archive of archives) {
    run([
      "release", "download", tag, "--repo", repository,
      "--pattern", archive, "--dir", directory,
    ]);
  }
  // Hash the published assets, including any reused from a previous attempt.
  for (const archive of archives) {
    copyFileSync(join(directory, archive), join("release-binaries", archive));
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
