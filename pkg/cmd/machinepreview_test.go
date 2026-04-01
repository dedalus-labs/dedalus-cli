// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/dedalus-labs/dedalus-cli/internal/mocktest"
)

func TestMachinesPreviewsCreate(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:previews", "create",
			"--machine-id", "machine_id",
			"--port", "0",
			"--protocol", "http",
			"--visibility", "public",
		)
	})

	t.Run("piping data", func(t *testing.T) {
		// Test piping YAML data over stdin
		pipeData := []byte("" +
			"port: 0\n" +
			"protocol: http\n" +
			"visibility: public\n")
		mocktest.TestRunMockTestWithPipeAndFlags(
			t, pipeData,
			"--api-key", "string",
			"machines:previews", "create",
			"--machine-id", "machine_id",
		)
	})
}

func TestMachinesPreviewsRetrieve(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:previews", "retrieve",
			"--machine-id", "machine_id",
			"--preview-id", "preview_id",
		)
	})
}

func TestMachinesPreviewsList(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:previews", "list",
			"--max-items", "10",
			"--machine-id", "machine_id",
			"--cursor", "cursor",
			"--limit", "0",
		)
	})
}

func TestMachinesPreviewsDelete(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:previews", "delete",
			"--machine-id", "machine_id",
			"--preview-id", "preview_id",
		)
	})
}
