package cmd

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/dedalus-labs/dedalus-go"
	"github.com/dedalus-labs/dedalus-go/option"
	"github.com/urfave/cli/v3"
)

const oldMachine = `{"machine_id":"machine-1","vcpu":1,"memory_mib":2048,"storage_gib":10,"autosleep_seconds":0,"desired_state":"running","status":{"phase":"running","resize_state":"pending","resources":{"memory":{"target_mib":4096}}}}`
const newMachine = `{"machine_id":"machine-1","vcpu":4,"memory_mib":4096,"storage_gib":10,"autosleep_seconds":0,"desired_state":"running","status":{"phase":"running"}}`

func TestInvariantRetrieveHidesInternalResizeFields(t *testing.T) {
	got, err := machineDisplay([]byte(oldMachine))
	if err != nil {
		t.Fatal(err)
	}
	var view map[string]json.RawMessage
	if err := json.Unmarshal([]byte(got.Raw), &view); err != nil {
		t.Fatal(err)
	}
	if len(view) != 7 || string(view["vcpu"]) != "1" || string(view["memory_mib"]) != "2048" || string(view["phase"]) != `"running"` {
		t.Fatalf("retrieve=%s", got.Raw)
	}
}

func TestInvariantUpdateWaitsForBothCommittedSizes(t *testing.T) {
	reads := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reads++
		w.Header().Set("Content-Type", "application/json")
		if reads == 1 {
			io.WriteString(w, oldMachine)
		} else if reads == 2 {
			io.WriteString(w, strings.Replace(oldMachine, `"vcpu":1`, `"vcpu":4`, 1))
		} else {
			io.WriteString(w, newMachine)
		}
	}))
	defer server.Close()
	client := dedalus.NewClient(option.WithBaseURL(server.URL), option.WithMaxRetries(0))
	cpu, ram := 4.0, int64(4096)
	if err := waitMachineUpdate(t.Context(), client, "machine-1", machineUpdateTarget{VCPU: &cpu, MemoryMiB: &ram}, 0); err != nil {
		t.Fatal(err)
	}
	if reads != 3 {
		t.Fatalf("returned after %d reads", reads)
	}
}

func TestInvariantUpdateNeverReportsSuccessOnFailureOrUncertainty(t *testing.T) {
	for _, kind := range []string{"failed", "destroyed", "read error", "timeout", "invalid response"} {
		t.Run(kind, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				switch kind {
				case "read error":
					w.WriteHeader(503)
					io.WriteString(w, `{"message":"unavailable"}`)
				case "invalid response":
					io.WriteString(w, `{}`)
				case "failed", "destroyed":
					io.WriteString(w, strings.Replace(oldMachine, `"phase":"running"`, `"phase":"`+kind+`"`, 1))
				default:
					io.WriteString(w, oldMachine)
				}
			}))
			defer server.Close()
			client := dedalus.NewClient(option.WithBaseURL(server.URL), option.WithMaxRetries(0))
			ctx, cancel := context.WithTimeout(t.Context(), 30*time.Millisecond)
			defer cancel()
			cpu := 4.0
			err := waitMachineUpdate(ctx, client, "machine-1", machineUpdateTarget{VCPU: &cpu}, time.Millisecond)
			if err == nil {
				t.Fatal("unconfirmed update succeeded")
			}
			if (kind == "failed" || kind == "destroyed") && !strings.Contains(err.Error(), "Machine update failed") {
				t.Fatalf("terminal failure was not reported: %v", err)
			}
			if (kind == "timeout" || kind == "read error") && !strings.Contains(err.Error(), "may still complete") {
				t.Fatalf("uncertain result: %v", err)
			}
		})
	}
}

func TestInvariantUpdateUsesActualRequestAndReturnsOnlyAnOutcome(t *testing.T) {
	for _, reject := range []bool{false, true} {
		t.Run(map[bool]string{false: "success", true: "rejected"}[reject], func(t *testing.T) {
			reads := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				if r.Method == http.MethodPatch {
					var body machineUpdateTarget
					if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
						t.Error(err)
					}
					if body.VCPU == nil || *body.VCPU != 4 {
						t.Error("lost request body")
					}
					if reject {
						w.WriteHeader(422)
						io.WriteString(w, `{"message":"Requested size exceeds your plan limit."}`)
					} else {
						io.WriteString(w, oldMachine)
					}
					return
				}
				reads++
				io.WriteString(w, newMachine)
			}))
			defer server.Close()
			client := dedalus.NewClient(option.WithBaseURL(server.URL), option.WithMaxRetries(0))
			output, err := os.CreateTemp(t.TempDir(), "stdout")
			if err != nil {
				t.Fatal(err)
			}
			defer output.Close()
			previous := os.Stdout
			os.Stdout = output
			defer func() { os.Stdout = previous }()
			command := &cli.Command{Name: "update", Flags: []cli.Flag{&cli.StringFlag{Name: "format", Value: "json"}}, Action: func(ctx context.Context, c *cli.Command) error {
				return runMachineUpdate(ctx, c, client, dedalus.MachineUpdateParams{MachineID: "machine-1"}, []option.RequestOption{option.WithRequestBody("application/json", []byte(`{"vcpu":4,"memory_mib":4096}`))})
			}}
			err = command.Run(t.Context(), []string{"update"})
			if reject {
				if err == nil || !strings.Contains(err.Error(), `"resized":false`) || !strings.Contains(err.Error(), "Requested size exceeds your plan limit.") || reads != 0 {
					t.Fatalf("rejection: %v reads=%d", err, reads)
				}
			} else if err != nil {
				t.Fatal(err)
			}
			output.Seek(0, 0)
			raw, _ := io.ReadAll(output)
			if reject && len(raw) > 0 {
				t.Fatalf("failure printed success: %s", raw)
			}
			if !reject && (!strings.Contains(string(raw), `"resized": true`) || strings.Contains(string(raw), "resources")) {
				t.Fatalf("outcome=%s", raw)
			}
		})
	}
}

func TestInvariantServerErrorDoesNotPromiseAnUnchangedMachine(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(503)
		io.WriteString(w, `{"message":"unavailable"}`)
	}))
	defer server.Close()
	client := dedalus.NewClient(option.WithBaseURL(server.URL), option.WithMaxRetries(0))
	err := runMachineUpdate(t.Context(), &cli.Command{}, client, dedalus.MachineUpdateParams{MachineID: "machine-1"}, []option.RequestOption{option.WithRequestBody("application/json", []byte(`{"vcpu":4}`))})
	if err == nil || !strings.Contains(err.Error(), "Could not confirm") || !strings.Contains(err.Error(), `"resized":null`) || strings.Contains(err.Error(), "Machine update failed") {
		t.Fatalf("server error result: %v", err)
	}
}
