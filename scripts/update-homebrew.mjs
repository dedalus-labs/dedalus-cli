import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const tap = "dedalus-labs/homebrew-tap";
const platforms = [
  ["macos", "arm", "darwin-arm64"],
  ["macos", "intel", "darwin-x64"],
  ["linux", "arm", "linux-arm64"],
  ["linux", "intel", "linux-x64"],
];

export function renderFormula(version, repository, directory) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error("Invalid package version");
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("Invalid release repository");
  }
  const lines = [
    "class Dedalus < Formula",
    '  desc "Official CLI for Dedalus"',
    '  homepage "https://docs.dedaluslabs.ai"',
    `  version "${version}"`,
    '  license "Apache-2.0"',
  ];
  for (const os of ["macos", "linux"]) {
    lines.push("", `  on_${os} do`);
    for (const [, architecture, target] of platforms.filter(
      ([name]) => name === os,
    )) {
      const archive = `dedalus-${target}.tar.gz`;
      const digest = createHash("sha256")
        .update(readFileSync(join(directory, archive)))
        .digest("hex");
      lines.push(
        `    on_${architecture} do`,
        `      url "https://github.com/${repository}/releases/download/v${version}/${archive}"`,
        `      sha256 "${digest}"`,
        "    end",
      );
    }
    lines.push("  end");
  }
  lines.push(
    "",
    "  def install",
    '    bin.install "dedalus"',
    "  end",
    "",
    "  test do",
    '    assert_match version.to_s, shell_output("#{bin}/dedalus --version")',
    "  end",
    "end",
    "",
  );
  return lines.join("\n");
}

export function updateHomebrew() {
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  const formula = renderFormula(
    version,
    process.env.GITHUB_REPOSITORY,
    "release-binaries",
  );
  if (process.argv.includes("--dry-run")) {
    process.stdout.write(formula);
    return;
  }
  const token = process.env.HOMEBREW_TAP_TOKEN;
  if (!token) throw new Error("HOMEBREW_TAP_TOKEN is required");
  const directory = mkdtempSync(join(tmpdir(), "dedalus-homebrew-"));
  const env = { ...process.env, GH_TOKEN: token };
  const run = (file, args, capture = false) => {
    const result = spawnSync(file, args, {
      cwd: directory,
      env,
      encoding: "utf8",
      stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    });
    if (result.error) throw new Error(`${file}: ${result.error.message}`);
    if (result.status !== 0)
      throw new Error(`${file} failed with exit code ${result.status}`);
    return result.stdout?.trim();
  };
  try {
    run("git", [
      "clone",
      `https://x-access-token:${encodeURIComponent(token)}@github.com/${tap}.git`,
      ".",
    ]);
    const branch = `release/dedalus-${version}`;
    const remote = run(
      "git",
      ["ls-remote", "--heads", "origin", `refs/heads/${branch}`],
      true,
    );
    if (remote) {
      run("git", ["fetch", "origin", branch]);
      run("git", ["checkout", "-b", branch, "FETCH_HEAD"]);
    } else {
      run("git", ["checkout", "-b", branch]);
    }
    run("git", ["config", "user.name", "github-actions[bot]"]);
    run("git", [
      "config",
      "user.email",
      "41898282+github-actions[bot]@users.noreply.github.com",
    ]);
    mkdirSync(join(directory, "Formula"), { recursive: true });
    writeFileSync(join(directory, "Formula/dedalus.rb"), formula);
    if (
      run("git", ["status", "--porcelain", "--", "Formula/dedalus.rb"], true)
    ) {
      run("git", ["add", "Formula/dedalus.rb"]);
      run("git", [
        "commit",
        "-m",
        `chore(formula): update dedalus to ${version}`,
      ]);
      run("git", ["push", "--set-upstream", "origin", branch]);
    }
    if (
      !run(
        "git",
        [
          "diff",
          "--name-only",
          "origin/main",
          "HEAD",
          "--",
          "Formula/dedalus.rb",
        ],
        true,
      )
    ) {
      process.stdout.write(`Homebrew already contains dedalus ${version}.\n`);
      return;
    }
    const prs = JSON.parse(
      run(
        "gh",
        [
          "pr",
          "list",
          "--repo",
          tap,
          "--head",
          branch,
          "--base",
          "main",
          "--state",
          "open",
          "--json",
          "url",
        ],
        true,
      ),
    );
    if (prs.length > 1)
      throw new Error(`Multiple open pull requests for ${branch}`);
    if (prs.length === 1) {
      process.stdout.write(`${prs[0].url}\n`);
      return;
    }
    const body = join(directory, "release-pr-body.txt");
    writeFileSync(
      body,
      `Update the standalone CLI formula to ${version}. All four platform archives are pinned to the SHA-256 digests of the binaries uploaded by this release.\n`,
    );
    run("gh", [
      "pr",
      "create",
      "--repo",
      tap,
      "--base",
      "main",
      "--head",
      branch,
      "--title",
      `chore(formula): update dedalus to ${version}`,
      "--body-file",
      body,
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  updateHomebrew();
}
