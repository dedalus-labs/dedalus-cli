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

var workspacesExecutionsCreate = cli.Command{
	Name:    "create",
	Usage:   "Create execution",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "workspace-id",
			Required: true,
		},
		&requestflag.Flag[any]{
			Name:     "command",
			Required: true,
			BodyPath: "command",
		},
		&requestflag.Flag[any]{
			Name:     "capture-path",
			BodyPath: "capture_paths",
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
			Name:     "stdin",
			BodyPath: "stdin",
		},
		&requestflag.Flag[int64]{
			Name:     "timeout-ms",
			BodyPath: "timeout_ms",
		},
		&requestflag.Flag[bool]{
			Name:     "wake-if-needed",
			BodyPath: "wake_if_needed",
		},
	},
	Action:          handleWorkspacesExecutionsCreate,
	HideHelpCommand: true,
}

var workspacesExecutionsRetrieve = cli.Command{
	Name:    "retrieve",
	Usage:   "Get execution",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "workspace-id",
			Required: true,
		},
		&requestflag.Flag[string]{
			Name:     "execution-id",
			Required: true,
		},
	},
	Action:          handleWorkspacesExecutionsRetrieve,
	HideHelpCommand: true,
}

var workspacesExecutionsList = cli.Command{
	Name:    "list",
	Usage:   "List executions",
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
	Action:          handleWorkspacesExecutionsList,
	HideHelpCommand: true,
}

var workspacesExecutionsDelete = cli.Command{
	Name:    "delete",
	Usage:   "Delete execution",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "workspace-id",
			Required: true,
		},
		&requestflag.Flag[string]{
			Name:     "execution-id",
			Required: true,
		},
	},
	Action:          handleWorkspacesExecutionsDelete,
	HideHelpCommand: true,
}

var workspacesExecutionsEvents = cli.Command{
	Name:    "events",
	Usage:   "List execution events",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "workspace-id",
			Required: true,
		},
		&requestflag.Flag[string]{
			Name:     "execution-id",
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
	Action:          handleWorkspacesExecutionsEvents,
	HideHelpCommand: true,
}

var workspacesExecutionsOutput = cli.Command{
	Name:    "output",
	Usage:   "Get execution output",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "workspace-id",
			Required: true,
		},
		&requestflag.Flag[string]{
			Name:     "execution-id",
			Required: true,
		},
	},
	Action:          handleWorkspacesExecutionsOutput,
	HideHelpCommand: true,
}

func handleWorkspacesExecutionsCreate(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("workspace-id") && len(unusedArgs) > 0 {
		cmd.Set("workspace-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := dedalus.WorkspaceExecutionNewParams{}

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
	_, err = client.Workspaces.Executions.New(
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
	return ShowJSON(os.Stdout, "workspaces:executions create", obj, format, transform)
}

func handleWorkspacesExecutionsRetrieve(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("execution-id") && len(unusedArgs) > 0 {
		cmd.Set("execution-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := dedalus.WorkspaceExecutionGetParams{
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
	_, err = client.Workspaces.Executions.Get(
		ctx,
		cmd.Value("execution-id").(string),
		params,
		options...,
	)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "workspaces:executions retrieve", obj, format, transform)
}

func handleWorkspacesExecutionsList(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("workspace-id") && len(unusedArgs) > 0 {
		cmd.Set("workspace-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := dedalus.WorkspaceExecutionListParams{}

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
		_, err = client.Workspaces.Executions.List(
			ctx,
			cmd.Value("workspace-id").(string),
			params,
			options...,
		)
		if err != nil {
			return err
		}
		obj := gjson.ParseBytes(res)
		return ShowJSON(os.Stdout, "workspaces:executions list", obj, format, transform)
	} else {
		iter := client.Workspaces.Executions.ListAutoPaging(
			ctx,
			cmd.Value("workspace-id").(string),
			params,
			options...,
		)
		maxItems := int64(-1)
		if cmd.IsSet("max-items") {
			maxItems = cmd.Value("max-items").(int64)
		}
		return ShowJSONIterator(os.Stdout, "workspaces:executions list", iter, format, transform, maxItems)
	}
}

func handleWorkspacesExecutionsDelete(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("execution-id") && len(unusedArgs) > 0 {
		cmd.Set("execution-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := dedalus.WorkspaceExecutionDeleteParams{
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
	_, err = client.Workspaces.Executions.Delete(
		ctx,
		cmd.Value("execution-id").(string),
		params,
		options...,
	)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "workspaces:executions delete", obj, format, transform)
}

func handleWorkspacesExecutionsEvents(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("execution-id") && len(unusedArgs) > 0 {
		cmd.Set("execution-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := dedalus.WorkspaceExecutionEventsParams{
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

	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	if format == "raw" {
		var res []byte
		options = append(options, option.WithResponseBodyInto(&res))
		_, err = client.Workspaces.Executions.Events(
			ctx,
			cmd.Value("execution-id").(string),
			params,
			options...,
		)
		if err != nil {
			return err
		}
		obj := gjson.ParseBytes(res)
		return ShowJSON(os.Stdout, "workspaces:executions events", obj, format, transform)
	} else {
		iter := client.Workspaces.Executions.EventsAutoPaging(
			ctx,
			cmd.Value("execution-id").(string),
			params,
			options...,
		)
		maxItems := int64(-1)
		if cmd.IsSet("max-items") {
			maxItems = cmd.Value("max-items").(int64)
		}
		return ShowJSONIterator(os.Stdout, "workspaces:executions events", iter, format, transform, maxItems)
	}
}

func handleWorkspacesExecutionsOutput(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()
	if !cmd.IsSet("execution-id") && len(unusedArgs) > 0 {
		cmd.Set("execution-id", unusedArgs[0])
		unusedArgs = unusedArgs[1:]
	}
	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := dedalus.WorkspaceExecutionOutputParams{
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
	_, err = client.Workspaces.Executions.Output(
		ctx,
		cmd.Value("execution-id").(string),
		params,
		options...,
	)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "workspaces:executions output", obj, format, transform)
}
