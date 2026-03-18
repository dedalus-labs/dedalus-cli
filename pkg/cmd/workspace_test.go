// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/dedalus-labs/dedalus-cli/internal/mocktest"
)

func TestWorkspacesCreate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces", "create",
			"--memory-mib", "0",
			"--storage-gib", "0",
			"--vcpu", "0",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"memory_mib: 0\n" +
			"storage_gib: 0\n" +
			"vcpu: 0\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--api-key", "string",
			"workspaces", "create",
		)
	})
}

func TestWorkspacesRetrieve(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces", "retrieve",
			"--workspace-id", "workspace_id",
		)
	})
}

func TestWorkspacesUpdate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces", "update",
			"--workspace-id", "workspace_id",
			"--if-match", "If-Match",
			"--memory-mib", "0",
			"--storage-gib", "0",
			"--vcpu", "0",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"memory_mib: 0\n" +
			"storage_gib: 0\n" +
			"vcpu: 0\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--api-key", "string",
			"workspaces", "update",
			"--workspace-id", "workspace_id",
			"--if-match", "If-Match",
		)
	})
}

func TestWorkspacesList(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces", "list",
			"--max-items", "10",
			"--cursor", "cursor",
			"--limit", "0",
		)
	})
}

func TestWorkspacesDelete(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces", "delete",
			"--workspace-id", "workspace_id",
			"--if-match", "If-Match",
		)
	})
}
