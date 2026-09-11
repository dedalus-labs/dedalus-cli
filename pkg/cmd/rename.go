package cmd

import (
	"context"
	"fmt"
	"net/http"
	"net/url"

	"github.com/dedalus-labs/dedalus-cli/internal/apiquery"
	"github.com/dedalus-labs/dedalus-go"
	"github.com/dedalus-labs/dedalus-go/option"
	"github.com/urfave/cli/v3"
)

type renameMachineResponse struct {
	MachineID string `json:"machine_id"`
	Name      string `json:"name"`
}

func init() {
	Command.Commands = append(Command.Commands, &cli.Command{
		Name:            "rename",
		Usage:           "Rename a machine",
		UsageText:       "dedalus rename <current> <new-name>",
		Category:        "MACHINE",
		Suggest:         true,
		Action:          handleRename,
		HideHelpCommand: true,
	})
}

func handleRename(ctx context.Context, cmd *cli.Command) error {
	args := cmd.Args().Slice()
	if len(args) != 2 {
		return fmt.Errorf("expected a current machine ID or name and a new name; usage: dedalus rename <current> <new-name>")
	}
	current, newName := args[0], args[1]

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

	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	result, err := renameMachine(ctx, &client, current, newName, options...)
	if err != nil {
		return err
	}
	acceptedName := result.Name
	if acceptedName == "" {
		acceptedName = newName
	}

	fmt.Printf("Successfully renamed %s to %s\nmachine-id: %s\n", current, acceptedName, result.MachineID)
	return nil
}

func renameMachine(
	ctx context.Context,
	client *dedalus.Client,
	current string,
	newName string,
	options ...option.RequestOption,
) (*renameMachineResponse, error) {
	var result renameMachineResponse
	err := client.Execute(
		ctx,
		http.MethodPatch,
		fmt.Sprintf("v1/machines/%s", url.PathEscape(current)),
		map[string]string{"name": newName},
		&result,
		options...,
	)
	if err != nil {
		return nil, err
	}
	return &result, nil
}
