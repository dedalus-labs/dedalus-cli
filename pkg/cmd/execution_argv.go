// @custom start
// Adds literal argument forwarding to execution commands.

package cmd

import (
	"context"
	"fmt"
	"strings"

	"github.com/urfave/cli/v3"
)

// configureExecutionArguments adds the exec alias and implicit create command.
// Existing execution subcommands remain available under both resource names.
// Flag parsing belongs to create so names after -- stay literal arguments.
// Call this after the execution resource is nested under machines.
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

// @custom end
