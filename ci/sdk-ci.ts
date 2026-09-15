// @custom start
import { command, workflow } from '@dedalus-labs/hollywood';

export const sdkCI = workflow({
  name: 'CLI SDK CI',
  on: { push: {}, pull_request: {} },
  permissions: { contents: 'read' },
  jobs: {
    verify: {
      'runs-on': 'blacksmith-4vcpu-ubuntu-2404',
      'timeout-minutes': 15,
      steps: [
        { uses: 'actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5' },
        {
          uses: 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020',
          with: { 'node-version': '24' },
        },
        {
          uses: 'pnpm/action-setup@a15d269cd4658e1107c09f1fabf4cbd7bd1f308a',
          with: { version: '10.34.5' },
        },
        {
          name: 'Install dependencies',
          run: command({
            file: 'pnpm',
            args: ['install', '--frozen-lockfile', '--ignore-scripts'],
          }),
        },
        {
          name: 'Generate workflows',
          run: command({ file: 'pnpm', args: ['run', 'ci:generate'] }),
        },
        {
          name: 'Check generated workflows',
          run: command({
            file: 'git',
            args: ['diff', '--exit-code', '--', '.github/workflows/sdk-ci.yml'],
          }),
        },
        { name: 'Build CLI', run: command({ file: 'pnpm', args: ['run', 'build'] }) },
        { name: 'Check public source and build', run: command({ file: 'pnpm', args: ['run', 'public:check'] }) },
        { name: 'Test public scanner', run: command({ file: 'pnpm', args: ['run', 'test:public'] }) },
        {
          name: 'Install and test preview package',
          run: command({ file: 'pnpm', args: ['run', 'test:package'] }),
        },
        {
          name: 'Upload tested preview package',
          uses: 'actions/upload-artifact@v7',
          with: {
            name: 'dedalus-cli-preview',
            path: 'artifacts/*',
            'if-no-files-found': 'error',
            'retention-days': 7,
          },
        },
      ],
    },
  },
});
// @custom end
