// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/dedalus-labs/dedalus-cli/internal/mocktest"
)

func TestWorkspacesExecutionsCreate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:executions", "create",
			"--workspace-id", "workspace_id",
			"--command", "[string]",
			"--cwd", "cwd",
			"--env", "{foo: string}",
			"--stdin", "stdin",
			"--timeout-ms", "0",
			"--wake-if-needed=true",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"command:\n" +
			"  - string\n" +
			"cwd: cwd\n" +
			"env:\n" +
			"  foo: string\n" +
			"stdin: stdin\n" +
			"timeout_ms: 0\n" +
			"wake_if_needed: true\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--api-key", "string",
			"workspaces:executions", "create",
			"--workspace-id", "workspace_id",
		)
	})
}

func TestWorkspacesExecutionsRetrieve(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:executions", "retrieve",
			"--workspace-id", "workspace_id",
			"--execution-id", "execution_id",
		)
	})
}

func TestWorkspacesExecutionsList(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:executions", "list",
			"--max-items", "10",
			"--workspace-id", "workspace_id",
			"--cursor", "cursor",
			"--limit", "0",
		)
	})
}

func TestWorkspacesExecutionsDelete(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:executions", "delete",
			"--workspace-id", "workspace_id",
			"--execution-id", "execution_id",
		)
	})
}

func TestWorkspacesExecutionsEvents(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:executions", "events",
			"--max-items", "10",
			"--workspace-id", "workspace_id",
			"--execution-id", "execution_id",
			"--cursor", "cursor",
			"--limit", "0",
		)
	})
}

func TestWorkspacesExecutionsOutput(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"workspaces:executions", "output",
			"--workspace-id", "workspace_id",
			"--execution-id", "execution_id",
		)
	})
}
