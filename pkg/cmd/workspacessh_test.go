// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/dedalus-labs/dedalus-cli/internal/mocktest"
)

func TestWorkspacesSSHCreate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:ssh", "create",
			"--workspace-id", "workspace_id",
			"--public-key", "public_key",
			"--wake-if-needed=true",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"public_key: public_key\n" +
			"wake_if_needed: true\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--api-key", "string",
			"workspaces:ssh", "create",
			"--workspace-id", "workspace_id",
		)
	})
}

func TestWorkspacesSSHRetrieve(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:ssh", "retrieve",
			"--workspace-id", "workspace_id",
			"--session-id", "session_id",
		)
	})
}

func TestWorkspacesSSHList(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:ssh", "list",
			"--max-items", "10",
			"--workspace-id", "workspace_id",
			"--cursor", "cursor",
			"--limit", "0",
		)
	})
}

func TestWorkspacesSSHDelete(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:ssh", "delete",
			"--workspace-id", "workspace_id",
			"--session-id", "session_id",
		)
	})
}
