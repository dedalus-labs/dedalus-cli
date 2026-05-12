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

var orgsUsageRetrieve = cli.Command{
	Name:    "retrieve",
	Usage:   "Get org billed machine usage",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "org-id",
			Required:  true,
			PathParam: "org_id",
		},
		&requestflag.Flag[string]{
			Name:      "period-start",
			Usage:     "Billing period start (YYYY-MM-DD). Defaults to first of current month.",
			QueryPath: "period_start",
		},
	},
	Action:          handleOrgsUsageRetrieve,
	HideHelpCommand: true,
}

var orgsUsageGetMachineStorageUsage = cli.Command{
	Name:    "get-machine-storage-usage",
	Usage:   "List machine storage usage evidence",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "org-id",
			Required:  true,
			PathParam: "org_id",
		},
		&requestflag.Flag[string]{
			Name:      "machine-id",
			Usage:     "Optional machine ID filter.",
			QueryPath: "machine_id",
		},
		&requestflag.Flag[string]{
			Name:      "period-end",
			Usage:     "Last UTC evidence date to include (YYYY-MM-DD). Defaults to current time.",
			QueryPath: "period_end",
		},
		&requestflag.Flag[string]{
			Name:      "period-start",
			Usage:     "Evidence period start (YYYY-MM-DD). Defaults to first of current month.",
			QueryPath: "period_start",
		},
	},
	Action:          handleOrgsUsageGetMachineStorageUsage,
	HideHelpCommand: true,
}

var orgsUsageGetMachineUsage = cli.Command{
	Name:    "get-machine-usage",
	Usage:   "List machine usage evidence",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:      "org-id",
			Required:  true,
			PathParam: "org_id",
		},
		&requestflag.Flag[string]{
			Name:      "granularity",
			Usage:     "Evidence granularity: hour or day. Defaults to hour.",
			QueryPath: "granularity",
		},
		&requestflag.Flag[string]{
			Name:      "machine-id",
			Usage:     "Optional machine ID filter.",
			QueryPath: "machine_id",
		},
		&requestflag.Flag[string]{
			Name:      "period-end",
			Usage:     "Last UTC evidence date to include (YYYY-MM-DD). Defaults to current time.",
			QueryPath: "period_end",
		},
		&requestflag.Flag[string]{
			Name:      "period-start",
			Usage:     "Evidence period start (YYYY-MM-DD). Defaults to first of current month.",
			QueryPath: "period_start",
		},
	},
	Action:          handleOrgsUsageGetMachineUsage,
	HideHelpCommand: true,
}

func handleOrgsUsageRetrieve(ctx context.Context, cmd *cli.Command) error {
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

	params := dedalus.OrgUsageGetParams{
		OrgID: cmd.Value("org-id").(string),
	}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Orgs.Usage.Get(ctx, params, options...)
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
		Title:          "orgs:usage retrieve",
		Transform:      transform,
	})
}

func handleOrgsUsageGetMachineStorageUsage(ctx context.Context, cmd *cli.Command) error {
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

	params := dedalus.OrgUsageGetMachineStorageUsageParams{
		OrgID: cmd.Value("org-id").(string),
	}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Orgs.Usage.GetMachineStorageUsage(ctx, params, options...)
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
		Title:          "orgs:usage get-machine-storage-usage",
		Transform:      transform,
	})
}

func handleOrgsUsageGetMachineUsage(ctx context.Context, cmd *cli.Command) error {
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

	params := dedalus.OrgUsageGetMachineUsageParams{
		OrgID: cmd.Value("org-id").(string),
	}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Orgs.Usage.GetMachineUsage(ctx, params, options...)
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
		Title:          "orgs:usage get-machine-usage",
		Transform:      transform,
	})
}
