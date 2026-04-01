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

var machinesCreate = cli.Command{
	Name:    "create",
	Usage:   "Create machine",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[int64]{
			Name:     "memory-mib",
			Usage:    "Memory in MiB.",
			Required: true,
			BodyPath: "memory_mib",
		},
		&requestflag.Flag[int64]{
			Name:     "storage-gib",
			Usage:    "Storage in GiB.",
			Required: true,
			BodyPath: "storage_gib",
		},
		&requestflag.Flag[float64]{
			Name:     "vcpu",
			Usage:    "CPU in vCPUs.",
			Required: true,
			BodyPath: "vcpu",
		},
	},
	Action:          handleMachinesCreate,
	HideHelpCommand: true,
}

var machinesRetrieve = cli.Command{
	Name:    "retrieve",
	Usage:   "Get machine",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "machine-id",
			Required: true,
		},
	},
	Action:          handleMachinesRetrieve,
	HideHelpCommand: true,
}

var machinesUpdate = cli.Command{
	Name:    "update",
	Usage:   "Update machine",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "machine-id",
			Required: true,
		},
		&requestflag.Flag[string]{
			Name:       "if-match",
			Required:   true,
			HeaderPath: "If-Match",
		},
		&requestflag.Flag[int64]{
			Name:     "memory-mib",
			Usage:    "Memory in MiB.",
			BodyPath: "memory_mib",
		},
		&requestflag.Flag[int64]{
			Name:     "storage-gib",
			Usage:    "Storage in GiB.",
			BodyPath: "storage_gib",
		},
		&requestflag.Flag[float64]{
			Name:     "vcpu",
			Usage:    "CPU in vCPUs.",
			BodyPath: "vcpu",
		},
	},
	Action:          handleMachinesUpdate,
	HideHelpCommand: true,
}

var machinesList = cli.Command{
	Name:    "list",
	Usage:   "List machines",
	Suggest: true,
	Flags: []cli.Flag{
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
	Action:          handleMachinesList,
	HideHelpCommand: true,
}

var machinesDelete = cli.Command{
	Name:    "delete",
	Usage:   "Destroy machine",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "machine-id",
			Required: true,
		},
		&requestflag.Flag[string]{
			Name:       "if-match",
			Required:   true,
			HeaderPath: "If-Match",
		},
	},
	Action:          handleMachinesDelete,
	HideHelpCommand: true,
}

var machinesWatch = cli.Command{
	Name:    "watch",
	Usage:   "Streams machine lifecycle updates over Server-Sent Events. Each `status` event\ncontains a full `LifecycleResponse` payload. The stream closes after the machine\nreaches its current desired state.",
	Suggest: true,
	Flags: []cli.Flag{
		&requestflag.Flag[string]{
			Name:     "machine-id",
			Required: true,
		},
		&requestflag.Flag[string]{
			Name:       "last-event-id",
			HeaderPath: "Last-Event-ID",
		},
		&requestflag.Flag[int64]{
			Name:  "max-items",
			Usage: "The maximum number of items to return (use -1 for unlimited).",
		},
	},
	Action:          handleMachinesWatch,
	HideHelpCommand: true,
}

func handleMachinesCreate(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := dedalus.MachineNewParams{}

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

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Machines.New(ctx, params, options...)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "machines create", obj, format, transform)
}

func handleMachinesRetrieve(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := dedalus.MachineGetParams{
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

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Machines.Get(ctx, params, options...)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "machines retrieve", obj, format, transform)
}

func handleMachinesUpdate(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := dedalus.MachineUpdateParams{
		MachineID: cmd.Value("machine-id").(string),
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

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Machines.Update(ctx, params, options...)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "machines update", obj, format, transform)
}

func handleMachinesList(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := dedalus.MachineListParams{}

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
		_, err = client.Machines.List(ctx, params, options...)
		if err != nil {
			return err
		}
		obj := gjson.ParseBytes(res)
		return ShowJSON(os.Stdout, "machines list", obj, format, transform)
	} else {
		iter := client.Machines.ListAutoPaging(ctx, params, options...)
		maxItems := int64(-1)
		if cmd.IsSet("max-items") {
			maxItems = cmd.Value("max-items").(int64)
		}
		return ShowJSONIterator(os.Stdout, "machines list", iter, format, transform, maxItems)
	}
}

func handleMachinesDelete(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := dedalus.MachineDeleteParams{
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

	var res []byte
	options = append(options, option.WithResponseBodyInto(&res))
	_, err = client.Machines.Delete(ctx, params, options...)
	if err != nil {
		return err
	}

	obj := gjson.ParseBytes(res)
	format := cmd.Root().String("format")
	transform := cmd.Root().String("transform")
	return ShowJSON(os.Stdout, "machines delete", obj, format, transform)
}

func handleMachinesWatch(ctx context.Context, cmd *cli.Command) error {
	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)
	unusedArgs := cmd.Args().Slice()

	if len(unusedArgs) > 0 {
		return fmt.Errorf("Unexpected extra arguments: %v", unusedArgs)
	}

	params := dedalus.MachineWatchParams{
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
	stream := client.Machines.WatchStreaming(ctx, params, options...)
	maxItems := int64(-1)
	if cmd.IsSet("max-items") {
		maxItems = cmd.Value("max-items").(int64)
	}
	return ShowJSONIterator(os.Stdout, "machines watch", stream, format, transform, maxItems)
}
