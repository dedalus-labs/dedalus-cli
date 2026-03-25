// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/dedalus-labs/dedalus-cli/internal/mocktest"
)

func TestWorkspacesTerminalsCreate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:terminals", "create",
			"--workspace-id", "workspace_id",
			"--height", "0",
			"--width", "0",
			"--cwd", "cwd",
			"--env", "{foo: string}",
			"--shell", "shell",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"height: 0\n" +
			"width: 0\n" +
			"cwd: cwd\n" +
			"env:\n" +
			"  foo: string\n" +
			"shell: shell\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--api-key", "string",
			"workspaces:terminals", "create",
			"--workspace-id", "workspace_id",
		)
	})
}

func TestWorkspacesTerminalsRetrieve(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:terminals", "retrieve",
			"--workspace-id", "workspace_id",
			"--terminal-id", "terminal_id",
		)
	})
}

func TestWorkspacesTerminalsList(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:terminals", "list",
			"--max-items", "10",
			"--workspace-id", "workspace_id",
			"--cursor", "cursor",
			"--limit", "0",
		)
	})
}

func TestWorkspacesTerminalsDelete(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:terminals", "delete",
			"--workspace-id", "workspace_id",
			"--terminal-id", "terminal_id",
		)
	})
}
