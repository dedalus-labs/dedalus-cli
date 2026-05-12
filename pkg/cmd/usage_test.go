// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/dedalus-labs/dedalus-cli/internal/mocktest"
)

func TestUsageRetrieve(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"usage", "retrieve",
			"--period-start", "period_start",
		)
	})
}

func TestUsageMachineCompute(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"usage", "machine-compute",
			"--granularity", "granularity",
			"--machine-id", "machine_id",
			"--period-end", "period_end",
			"--period-start", "period_start",
		)
	})
}

func TestUsageMachineStorage(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"usage", "machine-storage",
			"--machine-id", "machine_id",
			"--period-end", "period_end",
			"--period-start", "period_start",
		)
	})
}
