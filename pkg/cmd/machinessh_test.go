// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/dedalus-labs/dedalus-cli/internal/mocktest"
)

func TestMachinesSSHCreate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:ssh", "create",
			"--machine-id", "dm-ecc2efdd-ddfa-31a9-c6f1-b833d337aa7c",
			"--public-key", "public_key",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("public_key: public_key")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--api-key", "string",
			"machines:ssh", "create",
			"--machine-id", "dm-ecc2efdd-ddfa-31a9-c6f1-b833d337aa7c",
		)
	})
}

func TestMachinesSSHRetrieve(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:ssh", "retrieve",
			"--machine-id", "dm-ecc2efdd-ddfa-31a9-c6f1-b833d337aa7c",
			"--session-id", "session_id",
		)
	})
}

func TestMachinesSSHList(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:ssh", "list",
			"--max-items", "10",
			"--machine-id", "dm-ecc2efdd-ddfa-31a9-c6f1-b833d337aa7c",
			"--cursor", "cursor",
			"--limit", "0",
		)
	})
}

func TestMachinesSSHDelete(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:ssh", "delete",
			"--machine-id", "dm-ecc2efdd-ddfa-31a9-c6f1-b833d337aa7c",
			"--session-id", "session_id",
		)
	})
}
