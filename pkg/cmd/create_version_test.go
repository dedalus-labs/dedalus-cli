// @custom start
// Copyright (c) 2026 Dedalus Labs, Inc. All rights reserved.

package cmd

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A create selects exactly one API version, preserving its body and credentials.
// Invalid versions send nothing. An unavailable v2 never triggers a v1 create.
func TestCreateAPIVersion(t *testing.T) {
	binary := filepath.Join(t.TempDir(), "dedalus")
	if runtime.GOOS == "windows" {
		binary += ".exe"
	}
	output, err := exec.Command("go", "build", "-o", binary, "../../cmd/dedalus").CombinedOutput()
	require.NoError(t, err, "%s", output)
	for _, test := range []struct {
		name, version, prefix, stdin, path, errorText string
		status, requests                              int
	}{
		{name: "default", path: "/v1/machines", status: 202, requests: 1},
		{name: "explicit v1", version: "v1", path: "/v1/machines", status: 202, requests: 1},
		{name: "v2", version: "v2", path: "/v2/machines", status: 202, requests: 1},
		{name: "v2 gateway prefix", version: "v2", prefix: "/dcs", path: "/dcs/v2/machines", status: 202, requests: 1},
		{name: "v2 piped body", version: "v2", stdin: `{"vcpu":2,"memory_mib":2048,"storage_gib":20,"autosleep":"never"}`, path: "/v2/machines", status: 202, requests: 1},
		{name: "invalid", version: "v3", errorText: "api-version must be v1 or v2"},
		{name: "v2 unavailable", version: "v2", path: "/v2/machines", status: 404, requests: 1, errorText: "404"},
	} {
		t.Run(test.name, func(t *testing.T) {
			var calls atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls.Add(1)
				assert.Equal(t, http.MethodPost, r.Method)
				assert.Equal(t, test.path, r.URL.Path)
				assert.Equal(t, "Bearer test-key", r.Header.Get("Authorization"))
				var body map[string]any
				assert.NoError(t, json.NewDecoder(r.Body).Decode(&body))
				assert.Equal(t, map[string]any{"vcpu": float64(2), "memory_mib": float64(2048), "storage_gib": float64(20), "autosleep": "never"}, body)
				w.Header().Set("Content-Type", "application/json")
				if test.status == 0 {
					t.Error("invalid version reached the API")
					w.WriteHeader(http.StatusBadRequest)
					return
				}
				w.WriteHeader(test.status)
				_, err := w.Write([]byte(`{"machine_id":"dm-test","phase":"pending"}`))
				assert.NoError(t, err)
			}))
			defer server.Close()
			args := []string{"--base-url", server.URL + test.prefix, "--api-key", "test-key", "machines", "create"}
			if test.version != "" {
				args = append(args, "--api-version", test.version)
			}
			if test.stdin == "" {
				args = append(args, "--vcpu", "2", "--memory-mib", "2048", "--storage-gib", "20", "--autosleep", "never")
			}
			command := exec.Command(binary, args...)
			command.Stdin = strings.NewReader(test.stdin)
			output, err := command.CombinedOutput()
			if test.errorText != "" {
				require.Error(t, err, "%s", output)
				require.Contains(t, string(output), test.errorText)
			} else {
				require.NoError(t, err, "%s", output)
				require.Contains(t, string(output), "dm-test")
			}
			require.Equal(t, int32(test.requests), calls.Load())
		})
	}
}

// @custom end
