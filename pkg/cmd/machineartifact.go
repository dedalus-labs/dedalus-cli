// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/dedalus-labs/dedalus-cli/internal/apiquery"
	"github.com/dedalus-labs/dedalus-cli/internal/requestflag"
	"github.com/dedalus-labs/dedalus-go"
	"github.com/dedalus-labs/dedalus-go/option"
	"github.com/tidwall/gjson"
	"github.com/urfave/cli/v3"
)

var machinesArtifactsRetrieve = cli.Command{
	Name:    "retrieve",
	Usage:   "Get artifact",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "machine-id",
			Required: true,
		},
		&requestflag.Flag[string]{
			Name:     "artifact-id",
			Required: true,
		},
	},
	Action:          handleMachinesArtifactsRetrieve,
	HideHelpCommand: true,
}

var machinesArtifactsList = cli.Command{
	Name:    "list",
	Usage:   "List artifacts",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "machine-id",
			Required: true,
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
	Action:          handleMachinesArtifactsList,
	HideHelpCommand: true,
}

var machinesArtifactsDelete = cli.Command{
	Name:    "delete",
	Usage:   "Delete artifact",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "machine-id",
			Required: true,
		},
		&requestflag.Flag[string]{
			Name:     "artifact-id",
			Required: true,
		},
	},
	Action:          handleMachinesArtifactsDelete,
	HideHelpCommand: true,
}

func handleMachinesArtifactsRetrieve(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := dedalus.MachineArtifactGetParams{
		MachineID:  cmd.Value("machine-id").(string),
		ArtifactID: cmd.Value("artifact-id").(string),
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

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Machines.Artifacts.Get(ctx, params, options...)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "machines:artifacts retrieve", obj, format, transform)
}

func handleMachinesArtifactsList(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := dedalus.MachineArtifactListParams{
		MachineID: cmd.Value("machine-id").(string),
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

	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	if format == "raw" {
		var res []byte
		options = append(options, option.WithResponseBodyInto(&res))
		_, err = client.Machines.Artifacts.List(ctx, params, options...)
		if err != nil {
			return err
		}
		obj := gjson.ParseBytes(res)
		return ShowJSON(os.Stdout, "machines:artifacts list", obj, format, transform)
	} else {
		iter := client.Machines.Artifacts.ListAutoPaging(ctx, params, options...)
		maxItems := int64(-1)
		if cmd.IsSet("max-items") {
			maxItems = cmd.Value("max-items").(int64)
		}
		return ShowJSONIterator(os.Stdout, "machines:artifacts list", iter, format, transform, maxItems)
	}
}

func handleMachinesArtifactsDelete(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := dedalus.MachineArtifactDeleteParams{
		MachineID:  cmd.Value("machine-id").(string),
		ArtifactID: cmd.Value("artifact-id").(string),
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

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Machines.Artifacts.Delete(ctx, params, options...)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "machines:artifacts delete", obj, format, transform)
}
