import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { renderFormula } from "../scripts/update-homebrew.mjs";

const targets = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64"];
const script = fileURLToPath(
  new URL("../scripts/update-homebrew.mjs", import.meta.url),
);

test("invariant_formulas_pin_every_platform_archive_before_updating_the_tap", () => {
  const directory = mkdtempSync(join(tmpdir(), "homebrew-archives-"));
  try {
    for (const target of targets)
      writeFileSync(join(directory, `dedalus-${target}.tar.gz`), target);
    const formula = renderFormula(
      "0.7.0",
      "dedalus-labs/dedalus-cli",
      directory,
    );
    for (const target of targets) {
      assert.ok(formula.includes(`/v0.7.0/dedalus-${target}.tar.gz`));
      assert.ok(
        formula.includes(createHash("sha256").update(target).digest("hex")),
      );
    }
    rmSync(join(directory, "dedalus-linux-arm64.tar.gz"));
    assert.throws(
      () => renderFormula("0.7.0", "dedalus-labs/dedalus-cli", directory),
      /ENOENT/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("invariant_homebrew_updates_preserve_main_and_reuse_the_pending_review_branch", () => {
  const root = mkdtempSync(join(tmpdir(), "homebrew-review-"));
  const bare = join(root, "remote.git");
  const seed = join(root, "seed");
  const release = join(root, "release");
  const binaries = join(root, "bin");
  const state = join(root, "prs.json");
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: `url.file://${bare}.insteadOf`,
    GIT_CONFIG_VALUE_0:
      "https://x-access-token:fixture@github.com/dedalus-labs/homebrew-tap.git",
    GIT_TERMINAL_PROMPT: "0",
    HOMEBREW_TAP_TOKEN: "fixture",
    GITHUB_REPOSITORY: "dedalus-labs/dedalus-cli",
    HOMEBREW_TEST_PR_STATE: state,
    PATH: `${binaries}:${process.env.PATH}`,
  };
  const run = (file, args, cwd = root) => {
    const result = spawnSync(file, args, { cwd, env, encoding: "utf8" });
    assert.equal(
      result.status,
      0,
      `${file}: ${result.stderr}\n${result.stdout}`,
    );
    return result.stdout.trim();
  };
  const git = (args, cwd = root) => run("git", args, cwd);
  try {
    mkdirSync(seed);
    mkdirSync(release);
    mkdirSync(binaries);
    git(["init", "--bare", "--initial-branch=main", bare]);
    git(["init", "--initial-branch=main"], seed);
    git(["config", "user.name", "Fixture"], seed);
    git(["config", "user.email", "fixture@example.com"], seed);
    writeFileSync(join(seed, "README.md"), "fixture\n");
    git(["add", "README.md"], seed);
    git(["commit", "-m", "fixture"], seed);
    git(["remote", "add", "origin", bare], seed);
    git(["push", "origin", "main"], seed);
    const main = git(["--git-dir", bare, "rev-parse", "main"]);
    const hook = join(bare, "hooks/pre-receive");
    writeFileSync(
      hook,
      '#!/bin/sh\nwhile read old new ref; do\n  if [ "$ref" = refs/heads/main ]; then exit 1; fi\ndone\n',
    );
    chmodSync(hook, 0o755);
    writeFileSync(state, JSON.stringify({ creates: 0, url: null }));
    const gh = join(binaries, "gh");
    writeFileSync(
      gh,
      `#!${process.execPath}
const fs = require('node:fs');
const file = process.env.HOMEBREW_TEST_PR_STATE;
const state = JSON.parse(fs.readFileSync(file, 'utf8'));
const action = process.argv[3];
if (action === 'list') console.log(JSON.stringify(state.url ? [{url: state.url}] : []));
else if (action === 'create') {
  if (state.url) throw new Error('duplicate pull request');
  state.creates++;
  state.url = 'https://github.com/example/tap/pull/1';
  fs.writeFileSync(file, JSON.stringify(state));
  console.log(state.url);
} else process.exit(2);
`,
    );
    chmodSync(gh, 0o755);
    writeFileSync(join(release, "package.json"), '{"version":"0.7.0"}\n');
    mkdirSync(join(release, "release-binaries"));
    for (const target of targets) {
      writeFileSync(
        join(release, "release-binaries", `dedalus-${target}.tar.gz`),
        target,
      );
    }
    run(process.execPath, [script], release);
    const branch = "refs/heads/release/dedalus-0.7.0";
    const first = git(["--git-dir", bare, "rev-parse", branch]);
    assert.equal(git(["--git-dir", bare, "rev-parse", "main"]), main);
    assert.equal(JSON.parse(readFileSync(state, "utf8")).creates, 1);

    run(process.execPath, [script], release);
    assert.equal(git(["--git-dir", bare, "rev-parse", branch]), first);
    assert.equal(JSON.parse(readFileSync(state, "utf8")).creates, 1);

    writeFileSync(
      join(release, "release-binaries/dedalus-linux-x64.tar.gz"),
      "updated archive",
    );
    run(process.execPath, [script], release);
    const updated = git(["--git-dir", bare, "rev-parse", branch]);
    assert.notEqual(updated, first);
    git(["--git-dir", bare, "merge-base", "--is-ancestor", first, updated]);
    assert.equal(git(["--git-dir", bare, "rev-parse", "main"]), main);
    assert.equal(JSON.parse(readFileSync(state, "utf8")).creates, 1);

    // Simulate the reviewed merge, then verify another run creates no empty PR.
    git(["--git-dir", bare, "update-ref", "refs/heads/main", updated]);
    writeFileSync(state, JSON.stringify({ creates: 1, url: null }));
    assert.match(run(process.execPath, [script], release), /already contains/);
    assert.equal(JSON.parse(readFileSync(state, "utf8")).creates, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
