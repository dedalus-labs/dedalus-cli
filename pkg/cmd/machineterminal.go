// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"context"
	"fmt"

	"github.com/dedalus-labs/dedalus-cli/internal/apiquery"
	"github.com/dedalus-labs/dedalus-cli/internal/requestflag"
	"github.com/dedalus-labs/dedalus-go"
	"github.com/dedalus-labs/dedalus-go/option"
	"github.com/tidwall/gjson"
	"github.com/urfave/cli/v3"
)

var machinesTerminalsCreate = cli.Command{
	Name:    "create",
	Usage:   "Create terminal",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "machine-id",
			Required:  true,
			PathParam: "machine_id",
		},
		&requestflag.Flag[int64]{
			Name:     "height",
			Required: true,
			BodyPath: "height",
		},
		&requestflag.Flag[int64]{
			Name:     "width",
			Required: true,
			BodyPath: "width",
		},
		&requestflag.Flag[string]{
			Name:     "cwd",
			BodyPath: "cwd",
		},
		&requestflag.Flag[map[string]any]{
			Name:     "env",
			BodyPath: "env",
		},
		&requestflag.Flag[string]{
			Name:     "shell",
			BodyPath: "shell",
		},
	},
	Action:          handleMachinesTerminalsCreate,
	HideHelpCommand: true,
}

var machinesTerminalsRetrieve = cli.Command{
	Name:    "retrieve",
	Usage:   "Get terminal",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "machine-id",
			Required:  true,
			PathParam: "machine_id",
		},
		&requestflag.Flag[string]{
			Name:      "terminal-id",
			Required:  true,
			PathParam: "terminal_id",
		},
	},
	Action:          handleMachinesTerminalsRetrieve,
	HideHelpCommand: true,
}

var machinesTerminalsList = cli.Command{
	Name:    "list",
	Usage:   "List terminals",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "machine-id",
			Required:  true,
			PathParam: "machine_id",
		},
		&requestflag.Flag[string]{
			Name:      "cursor",
			QueryPath: "cursor",
		},
		&requestflag.Flag[int64]{
			Name:      "limit",
			QueryPath: "limit",
		},
		&requestflag.Flag[int64]{
			Name:  "max-items",
			Usage: "The maximum number of items to return (use -1 for unlimited).",
		},
	},
	Action:          handleMachinesTerminalsList,
	HideHelpCommand: true,
}

var machinesTerminalsDelete = cli.Command{
	Name:    "delete",
	Usage:   "Delete terminal",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "machine-id",
			Required:  true,
			PathParam: "machine_id",
		},
		&requestflag.Flag[string]{
			Name:      "terminal-id",
			Required:  true,
			PathParam: "terminal_id",
		},
	},
	Action:          handleMachinesTerminalsDelete,
	HideHelpCommand: true,
}

func handleMachinesTerminalsCreate(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	options, err := flagOptions(
		cmd,
		apiquery.NestedQueryFormatBrackets,
		apiquery.ArrayQueryFormatRepeat,
		ApplicationJSON,
		false,
	)
	if err != nil {
		return err
	}

	params := dedalus.MachineTerminalNewParams{
		MachineID: cmd.Value("machine-id").(string),
	}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Machines.Terminals.New(ctx, params, options...)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	explicitFormat := cmd.Root().IsSet("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(obj, ShowJSONOpts{
		ExplicitFormat: explicitFormat,
		Format:         format,
		RawOutput:      cmd.Root().Bool("raw-output"),
		Title:          "machines:terminals create",
		Transform:      transform,
	})
}

func handleMachinesTerminalsRetrieve(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	options, err := flagOptions(
		cmd,
		apiquery.NestedQueryFormatBrackets,
		apiquery.ArrayQueryFormatRepeat,
		EmptyBody,
		false,
	)
	if err != nil {
		return err
	}

	params := dedalus.MachineTerminalGetParams{
		MachineID:  cmd.Value("machine-id").(string),
		TerminalID: cmd.Value("terminal-id").(string),
	}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Machines.Terminals.Get(ctx, params, options...)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	explicitFormat := cmd.Root().IsSet("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(obj, ShowJSONOpts{
		ExplicitFormat: explicitFormat,
		Format:         format,
		RawOutput:      cmd.Root().Bool("raw-output"),
		Title:          "machines:terminals retrieve",
		Transform:      transform,
	})
}

func handleMachinesTerminalsList(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	options, err := flagOptions(
		cmd,
		apiquery.NestedQueryFormatBrackets,
		apiquery.ArrayQueryFormatRepeat,
		EmptyBody,
		false,
	)
	if err != nil {
		return err
	}

	params := dedalus.MachineTerminalListParams{
		MachineID: cmd.Value("machine-id").(string),
	}

	format := cmd.Root().String("format")
	explicitFormat := cmd.Root().IsSet("format")
	transform := cmd.Root().String("transform")
	if format == "raw" {
		var res []byte
		options = append(options, option.WithResponseBodyInto(&res))
		_, err = client.Machines.Terminals.List(ctx, params, options...)
		if err != nil {
			return err
		}
		obj := gjson.ParseBytes(res)
		return ShowJSON(obj, ShowJSONOpts{
			ExplicitFormat: explicitFormat,
			Format:         format,
			RawOutput:      cmd.Root().Bool("raw-output"),
			Title:          "machines:terminals list",
			Transform:      transform,
		})
	} else {
		iter := client.Machines.Terminals.ListAutoPaging(ctx, params, options...)
		maxItems := int64(-1)
		if cmd.IsSet("max-items") {
			maxItems = cmd.Value("max-items").(int64)
		}
		return ShowJSONIterator(iter, maxItems, ShowJSONOpts{
			ExplicitFormat: explicitFormat,
			Format:         format,
			RawOutput:      cmd.Root().Bool("raw-output"),
			Title:          "machines:terminals list",
			Transform:      transform,
		})
	}
}

func handleMachinesTerminalsDelete(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	options, err := flagOptions(
		cmd,
		apiquery.NestedQueryFormatBrackets,
		apiquery.ArrayQueryFormatRepeat,
		EmptyBody,
		false,
	)
	if err != nil {
		return err
	}

	params := dedalus.MachineTerminalDeleteParams{
		MachineID:  cmd.Value("machine-id").(string),
		TerminalID: cmd.Value("terminal-id").(string),
	}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Machines.Terminals.Delete(ctx, params, options...)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	explicitFormat := cmd.Root().IsSet("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(obj, ShowJSONOpts{
		ExplicitFormat: explicitFormat,
		Format:         format,
		RawOutput:      cmd.Root().Bool("raw-output"),
		Title:          "machines:terminals delete",
		Transform:      transform,
	})
}
