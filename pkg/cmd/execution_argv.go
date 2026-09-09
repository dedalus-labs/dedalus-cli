// @custom
// Adds literal argument forwarding to execution commands.

package cmd

import (
	"context"
	"fmt"
	"strings"

	"github.com/urfave/cli/v3"
)

// Keep the generated resource's subcommands available under both names. Defer
// flag parsing to create so even subcommand names after -- remain literal argv.
func configureExecutionArguments(executions *cli.Command) {
	executions.Aliases = append(executions.Aliases, "exec")
	executions.Usage = "Run commands on a machine or manage executions"
	executions.UsageText = "dedalus machines exec [create] --machine-id <id> [flags] -- <command> [args...]\n   dedalus machines exec <subcommand> [flags]"
	executions.SkipFlagParsing = true
	executions.Action = func(ctx context.Context, command *cli.Command) error {
		args := command.Args().Slice()
		if len(args) == 0 || args[0] == "--help" || args[0] == "-h" {
			return cli.ShowSubcommandHelp(command)
		}
		if !strings.HasPrefix(args[0], "-") {
			return fmt.Errorf("unknown execution subcommand %q; use -- before a remote command", args[0])
		}
		return command.Command("create").Run(ctx, append([]string{"create"}, args...))
	}
}
