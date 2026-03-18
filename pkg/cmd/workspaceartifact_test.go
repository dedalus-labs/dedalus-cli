// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/dedalus-labs/dedalus-cli/internal/mocktest"
)

func TestWorkspacesArtifactsRetrieve(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:artifacts", "retrieve",
			"--workspace-id", "workspace_id",
			"--artifact-id", "artifact_id",
		)
	})
}

func TestWorkspacesArtifactsList(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:artifacts", "list",
			"--max-items", "10",
			"--workspace-id", "workspace_id",
			"--cursor", "cursor",
			"--limit", "0",
		)
	})
}

func TestWorkspacesArtifactsDelete(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:artifacts", "delete",
			"--workspace-id", "workspace_id",
			"--artifact-id", "artifact_id",
		)
	})
}
