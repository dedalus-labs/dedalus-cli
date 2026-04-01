// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/dedalus-labs/dedalus-cli/internal/mocktest"
)

func TestMachinesTerminalsCreate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:terminals", "create",
			"--machine-id", "machine_id",
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
			"machines:terminals", "create",
			"--machine-id", "machine_id",
		)
	})
}

func TestMachinesTerminalsRetrieve(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:terminals", "retrieve",
			"--machine-id", "machine_id",
			"--terminal-id", "terminal_id",
		)
	})
}

func TestMachinesTerminalsList(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:terminals", "list",
			"--max-items", "10",
			"--machine-id", "machine_id",
			"--cursor", "cursor",
			"--limit", "0",
		)
	})
}

func TestMachinesTerminalsDelete(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:terminals", "delete",
			"--machine-id", "machine_id",
			"--terminal-id", "terminal_id",
		)
	})
}
