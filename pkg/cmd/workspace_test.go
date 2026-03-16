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
