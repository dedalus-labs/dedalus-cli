// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/dedalus-labs/dedalus-cli/internal/mocktest"
)

func TestMachinesArtifactsRetrieve(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:artifacts", "retrieve",
			"--machine-id", "machine_id",
			"--artifact-id", "artifact_id",
		)
	})
}

func TestMachinesArtifactsList(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:artifacts", "list",
			"--max-items", "10",
			"--machine-id", "machine_id",
			"--cursor", "cursor",
			"--limit", "0",
		)
	})
}

func TestMachinesArtifactsDelete(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"machines:artifacts", "delete",
			"--machine-id", "machine_id",
			"--artifact-id", "artifact_id",
		)
	})
}
