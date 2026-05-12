// Re-parents Stainless's colon-flattened subresource commands into
// space-separated subcommands. `dedalus machines:executions create` becomes
// `dedalus machines executions create`. The colon form is removed.
//
// Stainless's Go CLI generator emits nested subresources as colon-delimited
// top-level commands; native nesting is a tracked feature request (Slack
// thread with Nick, 2026-04). Once that ships, delete this file.

package cmd

import (
	"strings"

	"github.com/urfave/cli/v3"
)

func init() {
	Command.Commands = renestColonCommands(Command.Commands)
}

// renestColonCommands moves any command whose Name contains ':' under the
// matching prefix command at the same level. Applied recursively so future
// `a:b:c` shapes work without changes.
func renestColonCommands(cmds []*cli.Command) []*cli.Command {
	byName := map[string]*cli.Command{}
	for _, c := range cmds {
		byName[c.Name] = c
	}
	kept := cmds[:0]
	for _, c := range cmds {
		if i := strings.IndexByte(c.Name, ':'); i > 0 {
			if parent, ok := byName[c.Name[:i]]; ok {
				child := *c
				child.Name = c.Name[i+1:]
				parent.Commands = append(parent.Commands, &child)
				continue
			}
		}
		kept = append(kept, c)
	}
	for _, c := range kept {
		c.Commands = renestColonCommands(c.Commands)
	}
	return kept
}
