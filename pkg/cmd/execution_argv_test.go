// @custom start
// Regression coverage for handwritten execution argument forwarding.

package cmd

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"runtime"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestInvariantExecutionArgumentsReachAPIUnchanged checks the built CLI against
// a local HTTP server. It covers literal arguments, existing input formats and
// subcommands, help output, and rejection before any request is sent.
func TestInvariantExecutionArgumentsReachAPIUnchanged(t *testing.T) {
	// A real binary exercises command routing and request encoding together.
	binary := filepath.Join(t.TempDir(), "dedalus")
	if runtime.GOOS == "windows" {
		binary += ".exe"
	}
	output, err := exec.Command("go", "build", "-o", binary, "../../cmd/dedalus").CombinedOutput()
	require.NoError(t, err, "%s", output)

	// An existing file makes accidental @file expansion observable in the body.
	localFile := filepath.Join(t.TempDir(), "literal.txt")
	require.NoError(t, os.WriteFile(localFile, []byte("must not be uploaded"), 0600))
	// These values must survive without shell interpretation or flag parsing.
	argv := []string{"echo", "hello world", "", "--help", "--", "a\"b", "$HOME", "&&", "@" + localFile, `\@literal`}

	// Both resource names support explicit create and the shorthand form.
	for _, resource := range []string{"executions", "exec"} {
		for _, create := range []bool{false, true} {
			t.Run(resource+"/create="+strconv.FormatBool(create), func(t *testing.T) {
				// Buffer the body so the handler can reply before the CLI exits.
				requests := make(chan map[string]any, 1)
				server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					assert.Equal(t, "POST", r.Method)
					assert.Equal(t, "/v1/machines/dm-test/executions", r.URL.Path)
					var body map[string]any
					assert.NoError(t, json.NewDecoder(r.Body).Decode(&body))
					requests <- body
					w.Header().Set("Content-Type", "application/json")
					_, _ = w.Write([]byte(`{"execution_id":"ex-test","status":"queued"}`))
				}))
				defer server.Close()
				args := []string{"--base-url", server.URL, "--api-key", "test", "machines", resource}
				if create {
					args = append(args, "create")
				}
				args = append(args, "--machine-id", "dm-test", "--cwd", "/tmp", "--env", `{"MODE":"test"}`, "--stdin", "input", "--timeout-ms", "1000", "--")
				args = append(args, argv...)
				output, err := exec.Command(binary, args...).CombinedOutput()
				require.NoError(t, err, "%s", output)
				select {
				case body := <-requests:
					// Decode the expected slice too: JSON arrays in map[string]any
					// have type []any, so []string would fail a type-sensitive comparison.
					encoded, err := json.Marshal(argv)
					require.NoError(t, err)
					var want any
					require.NoError(t, json.Unmarshal(encoded, &want))
					require.Equal(t, want, body["command"])
					require.Equal(t, "/tmp", body["cwd"])
					require.Equal(t, map[string]any{"MODE": "test"}, body["env"])
					require.Equal(t, "input", body["stdin"])
					require.Equal(t, float64(1000), body["timeout_ms"])
				default:
					t.Fatal("no execution request received")
				}
			})
		}
	}

	// The alias preserves JSON and piped input plus every generated subcommand.
	// A command named list after -- must still create a remote execution.
	for _, test := range []struct {
		name    string
		args    []string
		stdin   string
		command []string
		method  string
		suffix  string
	}{
		{name: "subcommand name is literal", args: []string{"exec", "--machine-id", "dm-test", "--", "list"}, command: []string{"list"}},
		{name: "explicit remote shell", args: []string{"exec", "--machine-id", "dm-test", "--", "sh", "-c", `echo "hello world" && ls -la`}, command: []string{"sh", "-c", `echo "hello world" && ls -la`}},
		{name: "json command", args: []string{"exec", "create", "--machine-id", "dm-test", "--command", `["echo","hello world"]`}, command: []string{"echo", "hello world"}},
		{name: "piped command", args: []string{"exec", "create"}, stdin: `{"machine_id":"dm-test","command":["echo","hello world"]}`, command: []string{"echo", "hello world"}},
		{name: "retrieve alias", args: []string{"exec", "retrieve", "--machine-id", "dm-test", "--execution-id", "ex-test"}, method: "GET", suffix: "/ex-test"},
		{name: "output alias", args: []string{"exec", "output", "--machine-id", "dm-test", "--execution-id", "ex-test"}, method: "GET", suffix: "/ex-test/output"},
		{name: "events alias", args: []string{"exec", "events", "--machine-id", "dm-test", "--execution-id", "ex-test"}, method: "GET", suffix: "/ex-test/events"},
		{name: "list alias", args: []string{"exec", "list", "--machine-id", "dm-test"}, method: "GET"},
		{name: "delete alias", args: []string{"exec", "delete", "--machine-id", "dm-test", "--execution-id", "ex-test"}, method: "DELETE", suffix: "/ex-test"},
	} {
		t.Run(test.name, func(t *testing.T) {
			requests := make(chan *http.Request, 1)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if test.command != nil {
					var body struct {
						Command []string `json:"command"`
					}
					if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
						t.Error(err)
					}
					if !reflect.DeepEqual(test.command, body.Command) {
						t.Errorf("command = %q, want %q", body.Command, test.command)
					}
				}
				requests <- r
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"execution_id":"ex-test","status":"queued","items":[]}`))
			}))
			defer server.Close()
			args := append([]string{"--base-url", server.URL, "--api-key", "test", "machines"}, test.args...)
			run := exec.Command(binary, args...)
			run.Stdin = strings.NewReader(test.stdin)
			output, err := run.CombinedOutput()
			require.NoError(t, err, "%s", output)
			select {
			case request := <-requests:
				method := test.method
				if method == "" {
					method = "POST"
				}
				require.Equal(t, method, request.Method)
				require.Equal(t, "/v1/machines/dm-test/executions"+test.suffix, request.URL.Path)
			default:
				t.Fatal("no execution request received")
			}
		})
	}

	// Help must remain reachable at both the resource and create levels.
	for _, args := range [][]string{{"exec", "--help"}, {"exec", "create", "--help"}} {
		output, err := exec.Command(binary, append([]string{"machines"}, args...)...).CombinedOutput()
		require.NoError(t, err, "%s", output)
		require.Contains(t, string(output), "machine-id")
	}

	// Invalid input must fail locally. A nonzero exit alone would also allow
	// a server-side rejection, so the atomic counter checks for zero requests.
	for _, args := range [][]string{
		{"exec", "--machine-id", "dm-test", "--"},
		{"exec", "--machine-id", "dm-test", "--", ""},
		{"exec", "--machine-id", "dm-test", "--command", `["echo"]`, "--", "pwd"},
		{"exec", "--", "echo"},
		{"exec", "typo"},
	} {
		t.Run("reject/"+strings.Join(args, " "), func(t *testing.T) {
			var requests atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requests.Add(1)
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"execution_id":"unexpected"}`))
			}))
			defer server.Close()
			output, err := exec.Command(binary, append([]string{"--base-url", server.URL, "--api-key", "test", "machines"}, args...)...).CombinedOutput()
			require.Error(t, err, "%s", output)
			require.Zero(t, requests.Load(), "invalid input must not send an API request")
		})
	}
}

// @custom end
