import { command, unsafeShell, type GitHubWorkflowStep } from '@dedalus-labs/hollywood';

// pnpm publish uses npm's trusted-publishing client on a GitHub-hosted runner.
export const publishSteps = [
  { uses: 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1' },
  {
    uses: 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020',
    with: { 'node-version': '24', 'registry-url': 'https://registry.npmjs.org' },
  },
  {
    uses: 'pnpm/action-setup@a15d269cd4658e1107c09f1fabf4cbd7bd1f308a',
    with: { version: '10.20.0' },
  },
  {
    name: 'Install dependencies',
    run: command({ file: 'pnpm', args: ['install', '--frozen-lockfile', '--ignore-scripts'] }),
  },
  { name: 'Build CLI', run: command({ file: 'pnpm', args: ['run', 'build'] }) },
  {
    name: 'Pack Node CLI',
    run: command({ file: 'pnpm', args: ['pack', '--pack-destination', 'release-packages'] }),
  },
  { run: unsafeShell('npm install -g npm@11'), shell: 'bash' },
  {
    name: 'Publish to npm',
    run: command({ file: 'node', args: ['scripts/publish-npm.mjs'] }),
  },
  {
    name: 'Attach Node package to the release',
    run: command({ file: 'node', args: ['scripts/publish-package.mjs'] }),
    env: { GH_TOKEN: '${{ secrets.GITHUB_TOKEN }}' },
  },
  {
    name: 'Open Homebrew release PR',
    run: command({ file: 'node', args: ['scripts/update-homebrew.mjs'] }),
    env: { HOMEBREW_TAP_TOKEN: '${{ secrets.HOMEBREW_TAP_TOKEN }}' },
  },
] as const satisfies readonly GitHubWorkflowStep[];
