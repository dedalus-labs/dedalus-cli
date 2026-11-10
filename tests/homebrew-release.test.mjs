import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import { renderFormula } from "../scripts/update-homebrew.mjs";

const targets = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64"];

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

function verifyPublication(workflow) {
  const root = mkdtempSync(join(tmpdir(), "homebrew-review-"));
  const bare = join(root, "remote.git");
  const seed = join(root, "seed");
  const release = join(root, "release");
  const binaries = join(root, "bin");
  const published = join(root, "published");
  const definition = parse(readFileSync(
    new URL(`../.github/workflows/${workflow}.yml`, import.meta.url), "utf8",
  ));
  const steps = definition.jobs[workflow === "release-please" ? "publish" : "release"].steps;
  const compile = steps.find(step => step.name === "Compile standalone binaries").run;
  const upload = steps.find(step => step.name === "Attach binaries to the release").run;
  const homebrew = steps.find(step => step.name === "Open Homebrew release PR").run;
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
    RELEASE_TEST_ASSETS: published,
    PKG_VERSION: "0.7.0",
    BUILD_EPOCH: "1700000000",
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
    mkdirSync(published);
    cpSync(new URL("../scripts", import.meta.url), join(release, "scripts"), {
      recursive: true,
    });
    const bun = join(binaries, "bun");
    writeFileSync(bun, `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const output = args[args.indexOf('--outfile') + 1];
fs.writeFileSync(output, args.find(arg => arg.startsWith('--target=')));
fs.utimesSync(output, Number(process.env.BUILD_EPOCH), Number(process.env.BUILD_EPOCH));
`);
    chmodSync(bun, 0o755);
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
if (process.argv[2] === 'release') {
  const path = require('node:path');
  const directory = process.env.RELEASE_TEST_ASSETS;
  const args = process.argv.slice(4);
  if (action === 'view') console.log(JSON.stringify({ assets: fs.readdirSync(directory).map(name => ({ name })) }));
  else if (action === 'upload') {
    for (const file of args.filter(arg => fs.existsSync(arg) && fs.statSync(arg).isFile())) {
      const destination = path.join(directory, path.basename(file));
      if (fs.existsSync(destination) && !args.includes('--clobber')) throw new Error('asset already exists');
      fs.copyFileSync(file, destination);
    }
  } else if (action === 'download') {
    const name = args[args.indexOf('--pattern') + 1];
    const output = args[args.indexOf('--dir') + 1];
    fs.copyFileSync(path.join(directory, name), path.join(output, name));
  } else process.exit(2);
} else if (action === 'list') console.log(JSON.stringify(state.url ? [{url: state.url}] : []));
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
    const shell = command => run("bash", ["-e", "-o", "pipefail", "-c", command], release);
    const archive = "dedalus-linux-x64.tar.gz";
    // A previous attempt published only one platform before failing.
    shell(compile);
    const original = readFileSync(join(release, "release-binaries", archive));
    if (workflow === "release-please")
      cpSync(join(release, "release-binaries", archive), join(published, archive));
    env.BUILD_EPOCH = "1700000060";
    shell(compile);
    shell(upload);
    shell(homebrew);
    const assets = new Map(
      [...targets.map(target => `dedalus-${target}.tar.gz`), "dedalus-windows-x64.zip"]
        .map(name => [name, readFileSync(join(published, name))]),
    );
    if (workflow === "release-please")
      assert.deepEqual(assets.get(archive), original, "partial release retains its original archive");
    const assertPublishedBytes = () => {
      for (const [name, bytes] of assets) {
        assert.deepEqual(readFileSync(join(published, name)), bytes, `${name}: published bytes`);
        assert.deepEqual(readFileSync(join(release, "release-binaries", name)), bytes, `${name}: formula input`);
      }
    };
    assertPublishedBytes();
    const branch = "refs/heads/release/dedalus-0.7.0";
    const first = git(["--git-dir", bare, "rev-parse", branch]);
    assert.equal(git(["--git-dir", bare, "rev-parse", "main"]), main);
    assert.equal(JSON.parse(readFileSync(state, "utf8")).creates, 1);

    // The same compiled payload gets a different archive timestamp on retry.
    const retry = epoch => {
      env.BUILD_EPOCH = String(epoch);
      shell(compile);
      assert.notDeepEqual(
        readFileSync(join(release, "release-binaries/dedalus-darwin-arm64.tar.gz")),
        assets.get("dedalus-darwin-arm64.tar.gz"),
      );
      shell(upload);
      assertPublishedBytes();
      return shell(homebrew);
    };
    retry(1700000120);
    assert.equal(git(["--git-dir", bare, "rev-parse", branch]), first);
    assert.equal(git(["--git-dir", bare, "rev-parse", "main"]), main);
    assert.equal(JSON.parse(readFileSync(state, "utf8")).creates, 1);

    // Simulate the reviewed merge, then verify another run creates no empty PR.
    git(["--git-dir", bare, "update-ref", "refs/heads/main", first]);
    writeFileSync(state, JSON.stringify({ creates: 1, url: null }));
    if (workflow === "sdk-release")
      git(["--git-dir", bare, "update-ref", "-d", branch]);
    assert.match(retry(1700000240), /already contains/);
    const formula = git(["--git-dir", bare, "show", "main:Formula/dedalus.rb"]);
    for (const target of targets) {
      const digest = createHash("sha256")
        .update(assets.get(`dedalus-${target}.tar.gz`)).digest("hex");
      assert.ok(formula.includes(digest), `${target}: merged formula checksum`);
    }
    assert.equal(git(["--git-dir", bare, "rev-parse", "main"]), first);
    assert.equal(JSON.parse(readFileSync(state, "utf8")).creates, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

for (const workflow of ["release-please", "sdk-release"]) {
  test(`invariant_publication_retries_preserve_published_assets_and_merged_formulas (${workflow})`, () => {
    verifyPublication(workflow);
  });
}
