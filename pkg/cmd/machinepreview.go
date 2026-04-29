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

var machinesPreviewsCreate = cli.Command{
	Name:    "create",
	Usage:   "Create preview",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "machine-id",
			Required:  true,
			PathParam: "machine_id",
		},
		&requestflag.Flag[int64]{
			Name:     "port",
			Required: true,
			BodyPath: "port",
		},
		&requestflag.Flag[string]{
			Name:     "protocol",
			Usage:    `Allowed values: "http", "https".`,
			BodyPath: "protocol",
		},
		&requestflag.Flag[string]{
			Name:     "visibility",
			Usage:    `Allowed values: "public", "private", "org".`,
			BodyPath: "visibility",
		},
	},
	Action:          handleMachinesPreviewsCreate,
	HideHelpCommand: true,
}

var machinesPreviewsRetrieve = cli.Command{
	Name:    "retrieve",
	Usage:   "Get preview",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "machine-id",
			Required:  true,
			PathParam: "machine_id",
		},
		&requestflag.Flag[string]{
			Name:      "preview-id",
			Required:  true,
			PathParam: "preview_id",
		},
	},
	Action:          handleMachinesPreviewsRetrieve,
	HideHelpCommand: true,
}

var machinesPreviewsList = cli.Command{
	Name:    "list",
	Usage:   "List previews",
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
	Action:          handleMachinesPreviewsList,
	HideHelpCommand: true,
}

var machinesPreviewsDelete = cli.Command{
	Name:    "delete",
	Usage:   "Delete preview",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "machine-id",
			Required:  true,
			PathParam: "machine_id",
		},
		&requestflag.Flag[string]{
			Name:      "preview-id",
			Required:  true,
			PathParam: "preview_id",
		},
	},
	Action:          handleMachinesPreviewsDelete,
	HideHelpCommand: true,
}

func handleMachinesPreviewsCreate(ctx context.Context, cmd *cli.Command) error {
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

	params := dedalus.MachinePreviewNewParams{
		MachineID: cmd.Value("machine-id").(string),
	}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Machines.Previews.New(ctx, params, options...)
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
		Title:          "machines:previews create",
		Transform:      transform,
	})
}

func handleMachinesPreviewsRetrieve(ctx context.Context, cmd *cli.Command) error {
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

	params := dedalus.MachinePreviewGetParams{
		MachineID: cmd.Value("machine-id").(string),
		PreviewID: cmd.Value("preview-id").(string),
	}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Machines.Previews.Get(ctx, params, options...)
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
		Title:          "machines:previews retrieve",
		Transform:      transform,
	})
}

func handleMachinesPreviewsList(ctx context.Context, cmd *cli.Command) error {
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

	params := dedalus.MachinePreviewListParams{
		MachineID: cmd.Value("machine-id").(string),
	}

	format := cmd.Root().String("format")
	explicitFormat := cmd.Root().IsSet("format")
	transform := cmd.Root().String("transform")
	if format == "raw" {
		var res []byte
		options = append(options, option.WithResponseBodyInto(&res))
		_, err = client.Machines.Previews.List(ctx, params, options...)
		if err != nil {
			return err
		}
		obj := gjson.ParseBytes(res)
		return ShowJSON(obj, ShowJSONOpts{
			ExplicitFormat: explicitFormat,
			Format:         format,
			RawOutput:      cmd.Root().Bool("raw-output"),
			Title:          "machines:previews list",
			Transform:      transform,
		})
	} else {
		iter := client.Machines.Previews.ListAutoPaging(ctx, params, options...)
		maxItems := int64(-1)
		if cmd.IsSet("max-items") {
			maxItems = cmd.Value("max-items").(int64)
		}
		return ShowJSONIterator(iter, maxItems, ShowJSONOpts{
			ExplicitFormat: explicitFormat,
			Format:         format,
			RawOutput:      cmd.Root().Bool("raw-output"),
			Title:          "machines:previews list",
			Transform:      transform,
		})
	}
}

func handleMachinesPreviewsDelete(ctx context.Context, cmd *cli.Command) error {
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

	params := dedalus.MachinePreviewDeleteParams{
		MachineID: cmd.Value("machine-id").(string),
		PreviewID: cmd.Value("preview-id").(string),
	}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Machines.Previews.Delete(ctx, params, options...)
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
		Title:          "machines:previews delete",
		Transform:      transform,
	})
}
