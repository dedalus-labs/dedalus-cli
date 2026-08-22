package cmd

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/urfave/cli/v3"
)

const scalarConfigFile = "scalar.config.json"

type scalarCommandRunner func(
	context.Context,
	string,
	[]string,
	io.Reader,
	io.Writer,
	io.Writer,
) error

func init() {
	Command.Commands = append(Command.Commands, newScalarDocsCommand(os.Getwd, runScalarCommand))
}

func newScalarDocsCommand(
	getwd func() (string, error),
	run scalarCommandRunner,
) *cli.Command {
	return &cli.Command{
		Name:            "docs",
		Usage:           "Build and publish Dedalus documentation",
		Category:        "CLI",
		Suggest:         true,
		HideHelpCommand: true,
		Commands: []*cli.Command{
			{
				Name:            "scalar",
				Usage:           "Manage the Scalar documentation project",
				Suggest:         true,
				HideHelpCommand: true,
				Commands: []*cli.Command{
					{
						Name:            "preview",
						Usage:           "Preview the Scalar documentation project",
						UsageText:       "dedalus docs scalar preview [--port 3003] [--project-dir path]",
						HideHelpCommand: true,
						Flags: []cli.Flag{
							&cli.IntFlag{
								Name:  "port",
								Usage: "Port for the Scalar preview server",
								Value: 3003,
							},
							scalarProjectDirFlag(),
						},
						Action: func(ctx context.Context, c *cli.Command) error {
							port := c.Int("port")
							if port < 1 || port > 65_535 {
								return fmt.Errorf("--port must be an integer from 1 to 65535")
							}
							return runScalarProject(ctx, c, getwd, run, []string{
								"preview", scalarConfigFile, "--port", fmt.Sprintf("%d", port),
							})
						},
					},
					{
						Name:            "check",
						Usage:           "Validate the Scalar documentation configuration",
						UsageText:       "dedalus docs scalar check [--project-dir path]",
						HideHelpCommand: true,
						Flags:           []cli.Flag{scalarProjectDirFlag()},
						Action: func(ctx context.Context, c *cli.Command) error {
							return runScalarProject(ctx, c, getwd, run, []string{
								"check-config", scalarConfigFile,
							})
						},
					},
					{
						Name:            "publish",
						Usage:           "Publish a Scalar documentation preview",
						UsageText:       "dedalus docs scalar publish --preview [--project-dir path]",
						HideHelpCommand: true,
						Flags: []cli.Flag{
							&cli.BoolFlag{
								Name:  "preview",
								Usage: "Publish a preview deployment",
							},
							scalarProjectDirFlag(),
						},
						Action: func(ctx context.Context, c *cli.Command) error {
							if !c.Bool("preview") {
								return fmt.Errorf("Scalar publish requires --preview")
							}
							return runScalarProject(ctx, c, getwd, run, []string{
								"publish", "--config", scalarConfigFile, "--preview",
							})
						},
					},
				},
			},
		},
	}
}

func scalarProjectDirFlag() cli.Flag {
	return &cli.StringFlag{
		Name:  "project-dir",
		Usage: "Path to the Scalar project (defaults to discovering apps/docs-scalar)",
	}
}

func runScalarProject(
	ctx context.Context,
	c *cli.Command,
	getwd func() (string, error),
	run scalarCommandRunner,
	args []string,
) error {
	projectDir, err := findScalarProject(c.String("project-dir"), getwd)
	if err != nil {
		return err
	}

	root := c.Root()
	return run(
		ctx,
		projectDir,
		append([]string{"exec", "scalar", "project"}, args...),
		root.Reader,
		root.Writer,
		root.ErrWriter,
	)
}

func findScalarProject(explicit string, getwd func() (string, error)) (string, error) {
	if explicit != "" {
		projectDir, err := filepath.Abs(explicit)
		if err != nil {
			return "", fmt.Errorf("resolve Scalar project directory: %w", err)
		}
		if err := requireScalarConfig(projectDir); err != nil {
			return "", err
		}
		return projectDir, nil
	}

	dir, err := getwd()
	if err != nil {
		return "", fmt.Errorf("get current directory: %w", err)
	}
	dir, err = filepath.Abs(dir)
	if err != nil {
		return "", fmt.Errorf("resolve current directory: %w", err)
	}

	for {
		if scalarConfigExists(dir) {
			return dir, nil
		}

		projectDir := filepath.Join(dir, "apps", "docs-scalar")
		if scalarConfigExists(projectDir) {
			return projectDir, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return "", fmt.Errorf(
		"could not find %s; run inside the Dedalus monorepo or pass --project-dir",
		scalarConfigFile,
	)
}

func requireScalarConfig(projectDir string) error {
	if !scalarConfigExists(projectDir) {
		return fmt.Errorf("Scalar project %q does not contain %s", projectDir, scalarConfigFile)
	}
	return nil
}

func scalarConfigExists(projectDir string) bool {
	info, err := os.Stat(filepath.Join(projectDir, scalarConfigFile))
	return err == nil && !info.IsDir()
}

func runScalarCommand(
	ctx context.Context,
	projectDir string,
	args []string,
	stdin io.Reader,
	stdout io.Writer,
	stderr io.Writer,
) error {
	if stdin == nil {
		stdin = os.Stdin
	}
	if stdout == nil {
		stdout = os.Stdout
	}
	if stderr == nil {
		stderr = os.Stderr
	}

	command := exec.CommandContext(ctx, "pnpm", args...)
	command.Dir = projectDir
	command.Stdin = stdin
	command.Stdout = stdout
	command.Stderr = stderr
	if err := command.Run(); err != nil {
		return fmt.Errorf("run Scalar CLI: %w", err)
	}
	return nil
}
