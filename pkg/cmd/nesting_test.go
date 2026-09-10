package cmd

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/urfave/cli/v3"
)

// findSub returns the immediate subcommand of c with the given name, or nil.
func findSub(c *cli.Command, name string) *cli.Command {
	for _, sc := range c.Commands {
		if sc.Name == name {
			return sc
		}
	}
	return nil
}

func TestRenestColonCommands_one_level(t *testing.T) {
	t.Parallel()

	cmds := []*cli.Command{
		{Name: "machines", Commands: []*cli.Command{{Name: "create"}, {Name: "list"}}},
		{Name: "machines:executions", Commands: []*cli.Command{{Name: "create"}, {Name: "list"}}},
		{Name: "machines:ssh", Commands: []*cli.Command{{Name: "create"}}},
	}

	out := renestColonCommands(cmds)

	require.Len(t, out, 1, "only `machines` should remain at the top level")
	assert.Equal(t, "machines", out[0].Name)

	// Parent's own commands are preserved.
	assert.NotNil(t, findSub(out[0], "create"))
	assert.NotNil(t, findSub(out[0], "list"))

	// Subresources are re-parented and renamed.
	execs := findSub(out[0], "executions")
	require.NotNil(t, execs, "machines:executions should become machines > executions")
	assert.NotNil(t, findSub(execs, "create"))
	assert.NotNil(t, findSub(execs, "list"))

	ssh := findSub(out[0], "ssh")
	require.NotNil(t, ssh)
	assert.NotNil(t, findSub(ssh, "create"))
}

func TestRenestColonCommands_recurses_for_nested_subresources(t *testing.T) {
	t.Parallel()

	// Hypothetical future shape: `a:b:c`. Today Stainless only emits one
	// colon, but if that ever changes we want the wrapper to keep working.
	cmds := []*cli.Command{
		{Name: "a", Commands: []*cli.Command{
			{Name: "list"},
			{Name: "b", Commands: []*cli.Command{
				{Name: "list"},
			}},
			{Name: "b:c", Commands: []*cli.Command{
				{Name: "create"},
			}},
		}},
	}

	out := renestColonCommands(cmds)

	require.Len(t, out, 1)
	a := out[0]
	assert.NotNil(t, findSub(a, "list"))

	b := findSub(a, "b")
	require.NotNil(t, b)
	assert.NotNil(t, findSub(b, "list"))

	c := findSub(b, "c")
	require.NotNil(t, c, "b:c should be re-parented under b as `c`")
	assert.NotNil(t, findSub(c, "create"))

	// Original colon entry is gone from `a`'s direct children.
	assert.Nil(t, findSub(a, "b:c"))
}

func TestRenestColonCommands_leaves_orphan_colon_commands_alone(t *testing.T) {
	t.Parallel()

	// No `foo` parent exists, so `foo:bar` has nothing to attach to and
	// must be left at the top level rather than silently dropped.
	cmds := []*cli.Command{
		{Name: "foo:bar"},
	}

	out := renestColonCommands(cmds)
	require.Len(t, out, 1)
	assert.Equal(t, "foo:bar", out[0].Name)
}

// @custom start
func TestInvariantMachineCommandsMatchPublicContract(t *testing.T) {
	t.Parallel()

	if findSub(Command, "usage") != nil {
		t.Error("usage is outside the public API contract")
	}
	machines := findSub(Command, "machines")
	require.NotNil(t, machines)
	names := make([]string, 0, len(machines.Commands))
	for _, command := range machines.Commands {
		names = append(names, command.Name)
	}
	require.ElementsMatch(t, []string{
		"create", "retrieve", "update", "list", "delete", "sleep", "wake", "ssh", "executions",
	}, names)
}

// @custom end
