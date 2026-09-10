package cmd

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/dedalus-labs/dedalus-go"
	"github.com/dedalus-labs/dedalus-go/option"
	"github.com/tidwall/gjson"
	"github.com/urfave/cli/v3"
)

// doctorCmd is a non-generated DX helper for onboarding / support.
var doctorCmd = cli.Command{
	Name:  "doctor",
	Usage: "Run diagnostics: API credentials, reachability, optional machine health",
	Flags: []cli.Flag{
		&cli.StringFlag{
			Name:  "machine-id",
			Usage: "Optional machine to inspect",
		},
		&cli.DurationFlag{
			Name:  "timeout",
			Usage: "Per-check timeout",
			Value: 15 * time.Second,
		},
	},
	Action:          handleDoctor,
	HideHelpCommand: true,
	Suggest:         true,
}

type doctorCheck struct {
	Name   string `json:"name"`
	OK     bool   `json:"ok"`
	Detail string `json:"detail"`
}

func handleDoctor(ctx context.Context, cmd *cli.Command) error {
	timeout := cmd.Duration("timeout")
	machineID := cmd.String("machine-id")

	checks := make([]doctorCheck, 0, 6)
	allOK := true

	// 1. API key presence
	hasKey := os.Getenv("DEDALUS_API_KEY") != "" ||
		os.Getenv("DEDALUS_X_API_KEY") != "" ||
		cmd.IsSet("api-key") ||
		cmd.IsSet("x-api-key")
	if hasKey {
		checks = append(checks, doctorCheck{Name: "api_key", OK: true, Detail: "API key is configured"})
	} else {
		allOK = false
		checks = append(checks, doctorCheck{
			Name:   "api_key",
			OK:     false,
			Detail: "Set DEDALUS_API_KEY or pass --api-key",
		})
	}

	if !hasKey {
		return printDoctor(cmd, allOK, checks)
	}

	// 2. API reachability via machines.list
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	listCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	var res []byte
	_, err := client.Machines.List(listCtx, dedalus.MachineListParams{}, option.WithResponseBodyInto(&res))
	if err != nil {
		allOK = false
		checks = append(checks, doctorCheck{
			Name:   "api_reachable",
			OK:     false,
			Detail: err.Error(),
		})
		return printDoctor(cmd, allOK, checks)
	}
	checks = append(checks, doctorCheck{
		Name:   "api_reachable",
		OK:     true,
		Detail: "machines.list succeeded",
	})

	obj := gjson.ParseBytes(res)
	items := obj.Get("items")
	if items.Exists() && items.IsArray() {
		checks = append(checks, doctorCheck{
			Name:   "machines_visible",
			OK:     true,
			Detail: fmt.Sprintf("list returned %d item(s) on first page", len(items.Array())),
		})
	}

	// 3. Optional machine inspection
	if machineID != "" {
		getCtx, cancelGet := context.WithTimeout(ctx, timeout)
		defer cancelGet()

		var mres []byte
		params := dedalus.MachineGetParams{MachineID: machineID}
		_, err := client.Machines.Get(getCtx, params, option.WithResponseBodyInto(&mres))
		if err != nil {
			allOK = false
			checks = append(checks, doctorCheck{
				Name:   "machine_status",
				OK:     false,
				Detail: err.Error(),
			})
		} else {
			m := gjson.ParseBytes(mres)
			phase := m.Get("status.phase").String()
			lastErr := m.Get("status.last_error").String()
			ok := phase != "failed" && phase != "destroyed"
			if !ok {
				allOK = false
			}
			detail := fmt.Sprintf("%s phase=%s", machineID, phase)
			if lastErr != "" {
				detail = detail + " last_error=" + lastErr
			}
			checks = append(checks, doctorCheck{
				Name:   "machine_status",
				OK:     ok,
				Detail: detail,
			})
		}
	}

	return printDoctor(cmd, allOK, checks)
}

func printDoctor(cmd *cli.Command, allOK bool, checks []doctorCheck) error {
	// Human-readable summary always goes to stderr; structured to stdout when format=json
	for _, c := range checks {
		mark := "PASS"
		if !c.OK {
			mark = "FAIL"
		}
		fmt.Fprintf(cmd.Root().ErrWriter, "[%s] %s — %s\n", mark, c.Name, c.Detail)
	}
	if allOK {
		fmt.Fprintln(cmd.Root().ErrWriter, "\nAll checks passed.")
	} else {
		fmt.Fprintln(cmd.Root().ErrWriter, "\nOne or more checks failed.")
	}

	format := strings.ToLower(cmd.Root().String("format"))
	if format == "json" || format == "pretty" || cmd.Root().IsSet("format") {
		// Emit a small JSON report on stdout
		b := strings.Builder{}
		b.WriteString(`{"ok":`)
		if allOK {
			b.WriteString("true")
		} else {
			b.WriteString("false")
		}
		b.WriteString(`,"checks":[`)
		for i, c := range checks {
			if i > 0 {
				b.WriteByte(',')
			}
			b.WriteString(fmt.Sprintf(
				`{"name":%q,"ok":%v,"detail":%q}`,
				c.Name, c.OK, c.Detail,
			))
		}
		b.WriteString(`]}`)
		fmt.Fprintln(cmd.Root().Writer, b.String())
	}

	if !allOK {
		return cli.Exit("", 1)
	}
	return nil
}
