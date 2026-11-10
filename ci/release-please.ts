import { workflow, unsafeShell } from "@dedalus-labs/hollywood";
import { publishSteps } from "./publish-steps";

export const releaseWorkflow = workflow(
  {
    name: "Release Please",
    on: {
      push: {
        branches: ["main"],
        "paths-ignore": [".github/workflows/**"],
      },
      workflow_dispatch: null,
    },
    permissions: {
      contents: "write",
      "pull-requests": "write",
    },
    jobs: {
      "release-please": {
        "runs-on": "ubuntu-24.04",
        outputs: {
          release_created: "${{ steps.release.outputs.release_created }}",
          tag_name: "${{ steps.release.outputs.tag_name }}",
        },
        steps: [
          {
            uses: "googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7",
            id: "release",
            with: {
              "target-branch": "main",
              "config-file": "release-please-config.json",
              "manifest-file": ".release-please-manifest.json",
              "skip-github-pull-request": true,
            },
          },
          {
            uses: "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
            if: "${{ steps.release.outputs.release_created == 'true' }}",
            with: {
              "fetch-depth": 0,
            },
          },
          {
            name: "Sync release back to scalar-next",
            if: "${{ steps.release.outputs.release_created == 'true' }}",
            run: unsafeShell(`git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git fetch origin scalar-next
git checkout -B scalar-next origin/scalar-next
git merge --no-edit -m "Sync release \${{ steps.release.outputs.tag_name }} back to scalar-next" "\${{ steps.release.outputs.sha }}"
git push origin scalar-next
`),
            shell: "bash",
          },
        ],
      },
      publish: {
        needs: "release-please",
        if: "${{ !cancelled() && needs.release-please.outputs.release_created == 'true' }}",
        "runs-on": "ubuntu-24.04",
        environment: "production",
        permissions: {
          contents: "write",
          "id-token": "write",
          packages: "write",
        },
        env: {
          VERSIONING_POLICY: "manual",
        },
        steps: [
          {
            ...publishSteps[0],
            with: { ref: "${{ needs.release-please.outputs.tag_name }}" },
          },
          ...publishSteps.slice(1),
        ],
      },
    },
  },
  { filename: "release-please.yml" },
);
