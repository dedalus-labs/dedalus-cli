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
			"--machine-id", "machine_id",
		)
	})
}

func TestMachinesUpdate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines", "update",
			"--machine-id", "machine_id",
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
			"machines", "update",
			"--machine-id", "machine_id",
			"--if-match", "If-Match",
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
			"--machine-id", "machine_id",
			"--if-match", "If-Match",
		)
	})
}

func TestMachinesWatch(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines", "watch",
			"--max-items", "10",
			"--machine-id", "machine_id",
			"--last-event-id", "Last-Event-ID",
		)
	})
}
