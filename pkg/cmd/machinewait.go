package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/dedalus-labs/dedalus-cli/internal/requestflag"
	"github.com/dedalus-labs/dedalus-go"
	"github.com/dedalus-labs/dedalus-go/option"
	"github.com/tidwall/gjson"
	"github.com/urfave/cli/v3"
)

// machinesWait is a DX helper (not generated from OpenAPI).
// It polls retrieve until the machine reaches the desired phase.
var machinesWait = cli.Command{
	Name:  "wait",
	Usage: "Wait until a machine reaches a lifecycle phase (default: running)",
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "machine-id",
			Required:  true,
			PathParam: "machine_id",
		},
		&cli.StringFlag{
			Name:  "phase",
			Usage: "Target phase to wait for (default: running)",
			Value: "running",
		},
		&cli.DurationFlag{
			Name:  "timeout",
			Usage: "Maximum time to wait",
			Value: 2 * time.Minute,
		},
		&cli.DurationFlag{
			Name:  "interval",
			Usage: "Poll interval",
			Value: 1500 * time.Millisecond,
		},
	},
	Action:          handleMachinesWait,
	HideHelpCommand: true,
	Suggest:         true,
}

func handleMachinesWait(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)

	machineID := cmd.Value("machine-id").(string)
	targetPhase := cmd.String("phase")
	timeout := cmd.Duration("timeout")
	interval := cmd.Duration("interval")

	deadline := time.Now().Add(timeout)
	var lastPhase string

	for {
		if err := ctx.Err(); err != nil {
			return err
		}

		var res []byte
		params := dedalus.MachineGetParams{MachineID: machineID}
		_, err := client.Machines.Get(ctx, params, option.WithResponseBodyInto(&res))
		if err != nil {
			return err
		}

		obj := gjson.ParseBytes(res)
		lastPhase = obj.Get("status.phase").String()
		lastError := obj.Get("status.last_error").String()

		if lastPhase == targetPhase {
			format := cmd.Root().String("format")
			explicitFormat := cmd.Root().IsSet("format")
			transform := cmd.Root().String("transform")
			return ShowJSON(obj, ShowJSONOpts{
				ExplicitFormat: explicitFormat,
				Format:         format,
				RawOutput:      cmd.Root().Bool("raw-output"),
				Title:          "machines wait",
				Transform:      transform,
			})
		}

		if lastPhase == "failed" || lastPhase == "destroyed" {
			if lastError != "" {
				return fmt.Errorf("machine %s reached terminal phase %q: %s", machineID, lastPhase, lastError)
			}
			return fmt.Errorf("machine %s reached terminal phase %q", machineID, lastPhase)
		}

		if time.Now().After(deadline) {
			return fmt.Errorf("timed out waiting for machine %s to reach %q after %s (last phase: %s)",
				machineID, targetPhase, timeout, lastPhase)
		}

		// Best-effort progress on stderr so JSON stdout stays clean
		fmt.Fprintf(cmd.Root().ErrWriter, "waiting: phase=%s target=%s\n", lastPhase, targetPhase)

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(interval):
		}
	}
}
