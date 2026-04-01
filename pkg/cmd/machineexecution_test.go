// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/dedalus-labs/dedalus-cli/internal/mocktest"
)

func TestMachinesExecutionsCreate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:executions", "create",
			"--machine-id", "machine_id",
			"--command", "[string]",
			"--cwd", "cwd",
			"--env", "{foo: string}",
			"--stdin", "stdin",
			"--timeout-ms", "0",
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
			"timeout_ms: 0\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--api-key", "string",
			"machines:executions", "create",
			"--machine-id", "machine_id",
		)
	})
}

func TestMachinesExecutionsRetrieve(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:executions", "retrieve",
			"--machine-id", "machine_id",
			"--execution-id", "execution_id",
		)
	})
}

func TestMachinesExecutionsList(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:executions", "list",
			"--max-items", "10",
			"--machine-id", "machine_id",
			"--cursor", "cursor",
			"--limit", "0",
		)
	})
}

func TestMachinesExecutionsDelete(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:executions", "delete",
			"--machine-id", "machine_id",
			"--execution-id", "execution_id",
		)
	})
}

func TestMachinesExecutionsEvents(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:executions", "events",
			"--max-items", "10",
			"--machine-id", "machine_id",
			"--execution-id", "execution_id",
			"--cursor", "cursor",
			"--limit", "0",
		)
	})
}

func TestMachinesExecutionsOutput(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:executions", "output",
			"--machine-id", "machine_id",
			"--execution-id", "execution_id",
		)
	})
}
