// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"testing"

	"github.com/dedalus-labs/dedalus-cli/internal/mocktest"
)

func TestOrgsUsageRetrieve(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"orgs:usage", "retrieve",
			"--org-id", "org_id",
			"--period-start", "period_start",
		)
	})
}

func TestOrgsUsageGetMachineStorageUsage(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"orgs:usage", "get-machine-storage-usage",
			"--org-id", "org_id",
			"--machine-id", "machine_id",
			"--period-end", "period_end",
			"--period-start", "period_start",
		)
	})
}

func TestOrgsUsageGetMachineUsage(t *testing.T) {
	t.Run("regular flags", func(t *testing.T) {
		mocktest.TestRunMockTestWithFlags(
			t,
			"--api-key", "string",
			"orgs:usage", "get-machine-usage",
			"--org-id", "org_id",
			"--granularity", "granularity",
			"--machine-id", "machine_id",
			"--period-end", "period_end",
			"--period-start", "period_start",
		)
	})
}
