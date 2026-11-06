import {
  command,
  unsafeShell,
  type GitHubWorkflowStep,
} from "@dedalus-labs/hollywood";

// npm trusted publishing requires a GitHub-hosted runner.
export const publishSteps = [
  {
    uses: "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
  },
  {
    uses: "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
    with: {
      "node-version": "24",
      "registry-url": "https://registry.npmjs.org",
    },
  },
  {
    run: unsafeShell(`npm install`),
    shell: "bash",
  },
  {
    run: unsafeShell(`npm run build`),
    shell: "bash",
  },
  {
    name: "Read package version",
    run: unsafeShell(
      `echo "PKG_VERSION=$(node -p 'require("./package.json").version')" >> "$GITHUB_ENV"`,
    ),
    shell: "bash",
  },
  {
    run: unsafeShell(`npm install -g npm@11`),
    shell: "bash",
  },
  {
    name: "Publish to npm",
    run: unsafeShell(`node scripts/publish-npm.mjs`),
    shell: "bash",
  },
  {
    name: "Set up Bun",
    uses: "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6",
    with: {
      "bun-version": "1.4.0",
    },
  },
  {
    name: "Compile standalone binaries",
    run: unsafeShell(`ROOT="$PWD"
mkdir -p release-binaries
for target in linux-x64 linux-arm64 darwin-x64 darwin-arm64 windows-x64; do
  rm -rf compile-out && mkdir -p compile-out
  case "$target" in
    windows-*)
      bun build src/bin.ts --compile --minify --target="bun-\${target}" --outfile "compile-out/dedalus.exe"
      (cd compile-out && zip -q "$ROOT/release-binaries/dedalus-\${target}.zip" "dedalus.exe")
      ;;
    *)
      bun build src/bin.ts --compile --minify --target="bun-\${target}" --outfile "compile-out/dedalus"
      tar -czf "release-binaries/dedalus-\${target}.tar.gz" -C compile-out "dedalus"
      ;;
  esac
done
rm -rf compile-out
`),
    shell: "bash",
  },
  {
    name: "Attach binaries to the release",
    run: unsafeShell(
      `gh release upload "v\${PKG_VERSION}" release-binaries/* --clobber`,
    ),
    env: {
      GH_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
    },
    shell: "bash",
  },
  {
    name: "Open Homebrew release PR",
    env: {
      HOMEBREW_TAP_TOKEN: "${{ secrets.HOMEBREW_TAP_TOKEN }}",
    },
    run: command({ file: "node", args: ["scripts/update-homebrew.mjs"] }),
  },
] as const satisfies readonly GitHubWorkflowStep[];
