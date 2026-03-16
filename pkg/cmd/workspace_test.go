// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/dedalus-labs/dedalus-cli/internal/mocktest"
)

func TestWorkspacesCreate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t, "workspaces", "create",
			"--api-key", "string",
			"--cpus", "0",
			"--image-version", "image_version",
			"--memory-mib", "0",
			"--storage-gib", "0",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"cpus: 0\n" +
			"image_version: image_version\n" +
			"memory_mib: 0\n" +
			"storage_gib: 0\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData, "workspaces", "create",
			"--api-key", "string",
		)
	})
}

func TestWorkspacesRetrieve(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t, "workspaces", "retrieve",
			"--api-key", "string",
			"--workspace-id", "workspace_id",
		)
	})
}

func TestWorkspacesUpdate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t, "workspaces", "update",
			"--api-key", "string",
			"--workspace-id", "workspace_id",
			"--if-match", "If-Match",
			"--cpus", "0",
			"--memory-mib", "0",
			"--storage-gib", "0",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"cpus: 0\n" +
			"memory_mib: 0\n" +
			"storage_gib: 0\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData, "workspaces", "update",
			"--api-key", "string",
			"--workspace-id", "workspace_id",
			"--if-match", "If-Match",
		)
	})
}

func TestWorkspacesList(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t, "workspaces", "list",
			"--api-key", "string",
			"--max-items", "10",
			"--cursor", "cursor",
			"--limit", "0",
		)
	})
}

func TestWorkspacesDelete(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t, "workspaces", "delete",
			"--api-key", "string",
			"--workspace-id", "workspace_id",
			"--if-match", "If-Match",
		)
	})
}
