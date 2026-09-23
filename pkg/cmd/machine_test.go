// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/dedalus-labs/dedalus-cli/internal/mocktest"
)

func TestMachinesCreate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines", "create",
			"--autosleep", "autosleep",
			"--memory-mib", "1",
			"--storage-gib", "1",
			"--vcpu", "1",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"autosleep: autosleep\n" +
			"memory_mib: 1\n" +
			"storage_gib: 1\n" +
			"vcpu: 1\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--api-key", "string",
			"machines", "create",
		)
	})
}

func TestMachinesRetrieve(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines", "retrieve",
			"--machine-id", "dm-ecc2efdd-ddfa-31a9-c6f1-b833d337aa7c",
		)
	})
}

func TestMachinesUpdate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines", "update",
			"--machine-id", "dm-ecc2efdd-ddfa-31a9-c6f1-b833d337aa7c",
			"--autosleep", "autosleep",
			"--memory-mib", "0",
			"--storage-gib", "0",
			"--vcpu", "0",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"autosleep: autosleep\n" +
			"memory_mib: 0\n" +
			"storage_gib: 0\n" +
			"vcpu: 0\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--api-key", "string",
			"machines", "update",
			"--machine-id", "dm-ecc2efdd-ddfa-31a9-c6f1-b833d337aa7c",
		)
	})
}

func TestMachinesList(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines", "list",
			"--max-items", "10",
			"--cursor", "cursor",
			"--limit", "0",
		)
	})
}

func TestMachinesDelete(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines", "delete",
			"--machine-id", "dm-ecc2efdd-ddfa-31a9-c6f1-b833d337aa7c",
		)
	})
}

func TestMachinesSleep(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines", "sleep",
			"--machine-id", "dm-ecc2efdd-ddfa-31a9-c6f1-b833d337aa7c",
		)
	})
}

func TestMachinesWake(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines", "wake",
			"--machine-id", "dm-ecc2efdd-ddfa-31a9-c6f1-b833d337aa7c",
		)
	})
}
