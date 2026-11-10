import { workflow, unsafeShell } from "@dedalus-labs/hollywood";
import { publishSteps } from "./publish-steps";

export const manualReleaseWorkflow = workflow(
  {
    name: "CLI SDK Release",
    on: {
      workflow_dispatch: null,
    },
    permissions: {
      contents: "write",
      "id-token": "write",
      packages: "write",
    },
    jobs: {
      release: {
        "runs-on": "ubuntu-24.04",
        environment: "production",
        env: {
          VERSIONING_POLICY: "manual",
        },
        steps: [{ ...publishSteps[0] }, ...publishSteps.slice(1)],
      },
    },
  },
  { filename: "sdk-release.yml" },
);
