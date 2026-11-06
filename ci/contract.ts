import { command, workflow } from '@dedalus-labs/hollywood';

// Generate with Hollywood 0.0.5; this workflow never publishes packages.
export const contractCI = workflow({
  name: 'Generated API contract',
  on: { push: {}, pull_request: {} },
  permissions: { contents: 'read' },
  jobs: {
    contract: {
      'runs-on': 'ubuntu-24.04',
      steps: [
        { uses: 'actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5' },
        {
          name: 'Test contract guard',
          run: command({ file: 'python3', args: ['scripts/test-contract.py'] }),
        },
        {
          name: 'Verify pinned public operations',
          run: command({ file: 'python3', args: ['scripts/check-contract.py'] }),
        },
      ],
    },
  },
});
