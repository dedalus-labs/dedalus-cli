package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/dedalus-labs/dedalus-go"
	"github.com/dedalus-labs/dedalus-go/option"
	"github.com/tidwall/gjson"
	"github.com/urfave/cli/v3"
)

type machineView struct {
	MachineID        string  `json:"machine_id"`
	VCPU             float64 `json:"vcpu"`
	MemoryMiB        int64   `json:"memory_mib"`
	StorageGiB       int64   `json:"storage_gib"`
	AutosleepSeconds int64   `json:"autosleep_seconds"`
	DesiredState     string  `json:"desired_state"`
	Phase            string  `json:"phase"`
}

type machineResizeResult struct {
	MachineID string `json:"machine_id"`
	Resized   *bool  `json:"resized"`
	Message   string `json:"message"`
}

// A nil result means confirmation was lost, so neither outcome is known.
type machineResizeError struct{ machineResizeResult }

func (err *machineResizeError) Error() string {
	encoded, _ := json.Marshal(err.machineResizeResult)
	return string(encoded)
}

type machineUpdateTarget struct {
	VCPU             *float64 `json:"vcpu"`
	MemoryMiB        *int64   `json:"memory_mib"`
	StorageGiB       *int64   `json:"storage_gib"`
	AutosleepSeconds *int64   `json:"autosleep_seconds"`
}

func (target machineUpdateTarget) matches(view machineView) bool {
	return (target.VCPU == nil || *target.VCPU == view.VCPU) &&
		(target.MemoryMiB == nil || *target.MemoryMiB == view.MemoryMiB) &&
		(target.StorageGiB == nil || *target.StorageGiB == view.StorageGiB) &&
		(target.AutosleepSeconds == nil || *target.AutosleepSeconds == view.AutosleepSeconds)
}

// Decode a stable display shape so internal status fields never reach command output.
func machineDisplay(raw []byte) (gjson.Result, error) {
	view, err := readMachineView(raw)
	if err != nil {
		return gjson.Result{}, err
	}
	encoded, err := json.Marshal(view)
	return gjson.ParseBytes(encoded), err
}

func readMachineView(raw []byte) (machineView, error) {
	var view machineView
	if err := json.Unmarshal(raw, &view); err != nil {
		return view, err
	}
	if view.Phase == "" {
		view.Phase = gjson.GetBytes(raw, "status.phase").String()
	}
	if view.MachineID == "" || view.VCPU <= 0 || view.MemoryMiB <= 0 || view.StorageGiB <= 0 || view.Phase == "" {
		return view, fmt.Errorf("machine response is missing its identity, size, or phase")
	}
	return view, nil
}

// runMachineUpdate reports success only after reads confirm every requested field.
func runMachineUpdate(ctx context.Context, cmd *cli.Command, client dedalus.Client, params dedalus.MachineUpdateParams, options []option.RequestOption) error {
	// Capture the actual JSON request, including piped input, before sending it.
	var target machineUpdateTarget
	options = append(options, option.WithMiddleware(func(req *http.Request, next option.MiddlewareNext) (*http.Response, error) {
		if req.GetBody == nil {
			return nil, fmt.Errorf("cannot read machine update request")
		}
		body, err := req.GetBody()
		if err != nil {
			return nil, err
		}
		defer body.Close()
		if err = json.NewDecoder(body).Decode(&target); err != nil {
			return nil, err
		}
		return next(req)
	}))
	if _, err := client.Machines.Update(ctx, params, options...); err != nil {
		var apierr *dedalus.Error
		if errors.As(err, &apierr) && apierr.StatusCode < 500 {
			message := gjson.Get(apierr.RawJSON(), "message").String()
			if message == "" {
				message = gjson.Get(apierr.RawJSON(), "detail").String()
			}
			if message == "" {
				message = http.StatusText(apierr.StatusCode)
			}
			resized := false
			return &machineResizeError{machineResizeResult{params.MachineID, &resized, "Machine update failed: " + message}}
		}
		return &machineResizeError{machineResizeResult{params.MachineID, nil, fmt.Sprintf("Could not confirm machine update. It may still complete. Run 'dedalus machines retrieve --machine-id %s' to check its current size", params.MachineID)}}
	}
	// An accepted PATCH is not proof that the runtime applied the resize.
	waitCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	if err := waitMachineUpdate(waitCtx, client, params.MachineID, target, time.Second); err != nil {
		var result *machineResizeError
		if errors.As(err, &result) {
			return result
		}
		return &machineResizeError{machineResizeResult{params.MachineID, nil, err.Error()}}
	}
	resized := true
	result := machineResizeResult{params.MachineID, &resized, "Machine resized successfully."}
	encoded, err := json.Marshal(result)
	if err != nil {
		return err
	}
	return ShowJSON(gjson.ParseBytes(encoded), ShowJSONOpts{ExplicitFormat: cmd.Root().IsSet("format"), Format: cmd.Root().String("format"), RawOutput: cmd.Root().Bool("raw-output"), Title: "machines update", Transform: cmd.Root().String("transform")})
}

func waitMachineUpdate(ctx context.Context, client dedalus.Client, id string, target machineUpdateTarget, interval time.Duration) error {
	for {
		var raw []byte
		_, err := client.Machines.Get(ctx, dedalus.MachineGetParams{MachineID: id}, option.WithResponseBodyInto(&raw))
		if err != nil {
			return fmt.Errorf("Could not confirm machine update. It may still complete. Run 'dedalus machines retrieve --machine-id %s' to check its current size: %v", id, err)
		}
		view, err := readMachineView(raw)
		if err != nil {
			return err
		}
		if view.Phase == "failed" || view.Phase == "destroying" || view.Phase == "destroyed" {
			resized := false
			return &machineResizeError{machineResizeResult{id, &resized, fmt.Sprintf("Machine update failed: machine is %s. Run 'dedalus machines retrieve --machine-id %s' to check its current size", view.Phase, id)}}
		}
		if target.matches(view) {
			return nil
		}
		timer := time.NewTimer(interval)
		select {
		case <-ctx.Done():
			timer.Stop()
			return fmt.Errorf("Could not confirm machine update. It may still complete. Run 'dedalus machines retrieve --machine-id %s' to check its current size", id)
		case <-timer.C:
		}
	}
}
