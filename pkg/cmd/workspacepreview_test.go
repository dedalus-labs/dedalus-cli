// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/dedalus-labs/dedalus-cli/internal/mocktest"
)

func TestWorkspacesPreviewsCreate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:previews", "create",
			"--workspace-id", "workspace_id",
			"--port", "0",
			"--protocol", "http",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"port: 0\n" +
			"protocol: http\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--api-key", "string",
			"workspaces:previews", "create",
			"--workspace-id", "workspace_id",
		)
	})
}

func TestWorkspacesPreviewsRetrieve(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:previews", "retrieve",
			"--workspace-id", "workspace_id",
			"--preview-id", "preview_id",
		)
	})
}

func TestWorkspacesPreviewsList(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:previews", "list",
			"--max-items", "10",
			"--workspace-id", "workspace_id",
			"--cursor", "cursor",
			"--limit", "0",
		)
	})
}

func TestWorkspacesPreviewsDelete(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:previews", "delete",
			"--workspace-id", "workspace_id",
			"--preview-id", "preview_id",
		)
	})
}
