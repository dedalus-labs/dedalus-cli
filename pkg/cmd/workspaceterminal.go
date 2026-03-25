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

var workspacesTerminalsCreate = cli.Command{
	Name:    "create",
	Usage:   "Create terminal",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "workspace-id",
			Required: true,
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
	Action:          handleWorkspacesTerminalsCreate,
	HideHelpCommand: true,
}

var workspacesTerminalsRetrieve = cli.Command{
	Name:    "retrieve",
	Usage:   "Get terminal",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "workspace-id",
			Required: true,
		},
		&requestflag.Flag[string]{
			Name:     "terminal-id",
			Required: true,
		},
	},
	Action:          handleWorkspacesTerminalsRetrieve,
	HideHelpCommand: true,
}

var workspacesTerminalsList = cli.Command{
	Name:    "list",
	Usage:   "List terminals",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "workspace-id",
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
	Action:          handleWorkspacesTerminalsList,
	HideHelpCommand: true,
}

var workspacesTerminalsDelete = cli.Command{
	Name:    "delete",
	Usage:   "Delete terminal",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "workspace-id",
			Required: true,
		},
		&requestflag.Flag[string]{
			Name:     "terminal-id",
			Required: true,
		},
	},
	Action:          handleWorkspacesTerminalsDelete,
	HideHelpCommand: true,
}

func handleWorkspacesTerminalsCreate(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("workspace-id") && len(unusedArgs) > 0 {
		cmd.Set("workspace-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := dedalus.WorkspaceTerminalNewParams{}

	options, err := flagOptions(
		cmd,
		apiquery.NestedQueryFormatBrackets,
		apiquery.ArrayQueryFormatComma,
		ApplicationJSON,
		false,
	)
	if err != nil {
		return err
	}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Workspaces.Terminals.New(
		ctx,
		cmd.Value("workspace-id").(string),
		params,
		options...,
	)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "workspaces:terminals create", obj, format, transform)
}

func handleWorkspacesTerminalsRetrieve(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("terminal-id") && len(unusedArgs) > 0 {
		cmd.Set("terminal-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := dedalus.WorkspaceTerminalGetParams{
		WorkspaceID: cmd.Value("workspace-id").(string),
	}

	options, err := flagOptions(
		cmd,
		apiquery.NestedQueryFormatBrackets,
		apiquery.ArrayQueryFormatComma,
		EmptyBody,
		false,
	)
	if err != nil {
		return err
	}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Workspaces.Terminals.Get(
		ctx,
		cmd.Value("terminal-id").(string),
		params,
		options...,
	)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "workspaces:terminals retrieve", obj, format, transform)
}

func handleWorkspacesTerminalsList(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("workspace-id") && len(unusedArgs) > 0 {
		cmd.Set("workspace-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := dedalus.WorkspaceTerminalListParams{}

	options, err := flagOptions(
		cmd,
		apiquery.NestedQueryFormatBrackets,
		apiquery.ArrayQueryFormatComma,
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
		_, err = client.Workspaces.Terminals.List(
			ctx,
			cmd.Value("workspace-id").(string),
			params,
			options...,
		)
		if err != nil {
			return err
		}
		obj := gjson.ParseBytes(res)
		return ShowJSON(os.Stdout, "workspaces:terminals list", obj, format, transform)
	} else {
		iter := client.Workspaces.Terminals.ListAutoPaging(
			ctx,
			cmd.Value("workspace-id").(string),
			params,
			options...,
		)
		maxItems := int64(-1)
		if cmd.IsSet("max-items") {
			maxItems = cmd.Value("max-items").(int64)
		}
		return ShowJSONIterator(os.Stdout, "workspaces:terminals list", iter, format, transform, maxItems)
	}
}

func handleWorkspacesTerminalsDelete(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("terminal-id") && len(unusedArgs) > 0 {
		cmd.Set("terminal-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := dedalus.WorkspaceTerminalDeleteParams{
		WorkspaceID: cmd.Value("workspace-id").(string),
	}

	options, err := flagOptions(
		cmd,
		apiquery.NestedQueryFormatBrackets,
		apiquery.ArrayQueryFormatComma,
		EmptyBody,
		false,
	)
	if err != nil {
		return err
	}

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Workspaces.Terminals.Delete(
		ctx,
		cmd.Value("terminal-id").(string),
		params,
		options...,
	)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "workspaces:terminals delete", obj, format, transform)
}
