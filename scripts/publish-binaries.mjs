// Both release workflows call this after compilation. Published archives stay
// immutable; retries fill missing assets and download the bytes Homebrew hashes.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  // The standalone upgrade command requires checksums for the published bytes.
  const checksums = archives.map(archive =>
    `${createHash("sha256").update(readFileSync(join(directory, archive))).digest("hex")}  ${archive}\n`,
  ).join("");
  if (published.has("checksums.txt")) {
    run(["release", "download", tag, "--repo", repository,
      "--pattern", "checksums.txt", "--dir", directory]);
    if (readFileSync(join(directory, "checksums.txt"), "utf8") !== checksums)
      throw new Error("Published checksums.txt does not match the release archives");
  } else {
    writeFileSync(join(directory, "checksums.txt"), checksums);
    run(["release", "upload", tag, join(directory, "checksums.txt"), "--repo", repository]);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
