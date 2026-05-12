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

var usageRetrieve = cli.Command{
	Name:    "retrieve",
	Usage:   "Get usage summary",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "period-start",
			Usage:     "Billing period start (YYYY-MM-DD). Defaults to first of current month.",
			QueryPath: "period_start",
		},
	},
	Action:          handleUsageRetrieve,
	HideHelpCommand: true,
}

var usageMachineCompute = cli.Command{
	Name:    "machine-compute",
	Usage:   "List machine compute usage breakdown",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "granularity",
			Usage:     "Usage breakdown granularity: hour or day. Defaults to hour.",
			QueryPath: "granularity",
		},
		&requestflag.Flag[string]{
			Name:      "machine-id",
			Usage:     "Optional machine ID filter.",
			QueryPath: "machine_id",
		},
		&requestflag.Flag[string]{
			Name:      "period-end",
			Usage:     "Last UTC usage date to include (YYYY-MM-DD). Defaults to current time.",
			QueryPath: "period_end",
		},
		&requestflag.Flag[string]{
			Name:      "period-start",
			Usage:     "Usage period start (YYYY-MM-DD). Defaults to first of current month.",
			QueryPath: "period_start",
		},
	},
	Action:          handleUsageMachineCompute,
	HideHelpCommand: true,
}

var usageMachineStorage = cli.Command{
	Name:    "machine-storage",
	Usage:   "List machine storage usage breakdown",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "machine-id",
			Usage:     "Optional machine ID filter.",
			QueryPath: "machine_id",
		},
		&requestflag.Flag[string]{
			Name:      "period-end",
			Usage:     "Last UTC usage date to include (YYYY-MM-DD). Defaults to current time.",
			QueryPath: "period_end",
		},
		&requestflag.Flag[string]{
			Name:      "period-start",
			Usage:     "Usage period start (YYYY-MM-DD). Defaults to first of current month.",
			QueryPath: "period_start",
		},
	},
	Action:          handleUsageMachineStorage,
	HideHelpCommand: true,
}

func handleUsageRetrieve(ctx context.Context, cmd *cli.Command) error {
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

	params := dedalus.UsageGetParams{}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Usage.Get(ctx, params, options...)
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
		Title:          "usage retrieve",
		Transform:      transform,
	})
}

func handleUsageMachineCompute(ctx context.Context, cmd *cli.Command) error {
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

	params := dedalus.UsageMachineComputeParams{}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Usage.MachineCompute(ctx, params, options...)
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
		Title:          "usage machine-compute",
		Transform:      transform,
	})
}

func handleUsageMachineStorage(ctx context.Context, cmd *cli.Command) error {
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

	params := dedalus.UsageMachineStorageParams{}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Usage.MachineStorage(ctx, params, options...)
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
		Title:          "usage machine-storage",
		Transform:      transform,
	})
}
