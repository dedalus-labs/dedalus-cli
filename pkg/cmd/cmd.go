// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

package cmd

import (
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/dedalus-labs/dedalus-cli/internal/autocomplete"
	"github.com/dedalus-labs/dedalus-cli/internal/requestflag"
	docs "github.com/urfave/cli-docs/v3"
	"github.com/urfave/cli/v3"
)

var (
	Command            *cli.Command
	CommandErrorBuffer bytes.Buffer
)

func init() {
	Command = &cli.Command{
		Name:      "dedalus",
		Usage:     "CLI for the Dedalus API",
		Suggest:   true,
		Version:   Version,
		ErrWriter: &CommandErrorBuffer,
		Flags: []cli.Flag{
			&cli.BoolFlag{
				Name:  "debug",
				Usage: "Enable debug logging",
			},
			&cli.StringFlag{
				Name:        "base-url",
				DefaultText: "url",
				Usage:       "Override the base URL for API requests",
			},
			&cli.StringFlag{
				Name:  "format",
				Usage: "The format for displaying response data (one of: " + strings.Join(OutputFormats, ", ") + ")",
				Value: "pretty",
				Validator: func(format string) error {
					if !slices.Contains(OutputFormats, strings.ToLower(format)) {
						return fmt.Errorf("format must be one of: %s", strings.Join(OutputFormats, ", "))
					}
					return nil
				},
			},
			&cli.StringFlag{
				Name:  "format-error",
				Usage: "The format for displaying error data (one of: " + strings.Join(OutputFormats, ", ") + ")",
				Value: "pretty",
				Validator: func(format string) error {
					if !slices.Contains(OutputFormats, strings.ToLower(format)) {
						return fmt.Errorf("format must be one of: %s", strings.Join(OutputFormats, ", "))
					}
					return nil
				},
			},
			&cli.StringFlag{
				Name:  "transform",
				Usage: "The GJSON transformation for data output.",
			},
			&cli.StringFlag{
				Name:  "transform-error",
				Usage: "The GJSON transformation for errors.",
			},
			&requestflag.Flag[string]{
				Name:    "api-key",
				Usage:   "Dedalus API key sent as Authorization Bearer.",
				Sources: cli.EnvVars("DEDALUS_API_KEY"),
			},
			&requestflag.Flag[string]{
				Name:    "x-api-key",
				Usage:   "Dedalus API key sent as x-api-key header.",
				Sources: cli.EnvVars("DEDALUS_X_API_KEY"),
			},
			&requestflag.Flag[string]{
				Name:    "dedalus-org-id",
				Usage:   "Organization ID header for all DCS requests.",
				Sources: cli.EnvVars("DEDALUS_ORG_ID"),
			},
		},
		Commands: []*cli.Command{
			{
				Name:     "machines",
				Category: "API RESOURCE",
				Suggest:  true,
				Commands: []*cli.Command{
					&machinesCreate,
					&machinesRetrieve,
					&machinesUpdate,
					&machinesList,
					&machinesDelete,
					&machinesWatch,
				},
			},
			{
				Name:     "machines:artifacts",
				Category: "API RESOURCE",
				Suggest:  true,
				Commands: []*cli.Command{
					&machinesArtifactsRetrieve,
					&machinesArtifactsList,
					&machinesArtifactsDelete,
				},
			},
			{
				Name:     "machines:previews",
				Category: "API RESOURCE",
				Suggest:  true,
				Commands: []*cli.Command{
					&machinesPreviewsCreate,
					&machinesPreviewsRetrieve,
					&machinesPreviewsList,
					&machinesPreviewsDelete,
				},
			},
			{
				Name:     "machines:ssh",
				Category: "API RESOURCE",
				Suggest:  true,
				Commands: []*cli.Command{
					&machinesSSHCreate,
					&machinesSSHRetrieve,
					&machinesSSHList,
					&machinesSSHDelete,
				},
			},
			{
				Name:     "machines:executions",
				Category: "API RESOURCE",
				Suggest:  true,
				Commands: []*cli.Command{
					&machinesExecutionsCreate,
					&machinesExecutionsRetrieve,
					&machinesExecutionsList,
					&machinesExecutionsDelete,
					&machinesExecutionsEvents,
					&machinesExecutionsOutput,
				},
			},
			{
				Name:     "machines:terminals",
				Category: "API RESOURCE",
				Suggest:  true,
				Commands: []*cli.Command{
					&machinesTerminalsCreate,
					&machinesTerminalsRetrieve,
					&machinesTerminalsList,
					&machinesTerminalsDelete,
				},
			},
			{
				Name:            "@manpages",
				Usage:           "Generate documentation for 'man'",
				UsageText:       "dedalus @manpages [-o dedalus.1] [--gzip]",
				Hidden:          true,
				Action:          generateManpages,
				HideHelpCommand: true,
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:    "output",
						Aliases: []string{"o"},
						Usage:   "write manpages to the given folder",
						Value:   "man",
					},
					&cli.BoolFlag{
						Name:    "gzip",
						Aliases: []string{"z"},
						Usage:   "output gzipped manpage files to .gz",
						Value:   true,
					},
					&cli.BoolFlag{
						Name:    "text",
						Aliases: []string{"z"},
						Usage:   "output uncompressed text files",
						Value:   false,
					},
				},
			},
			{
				Name:            "__complete",
				Hidden:          true,
				HideHelpCommand: true,
				Action:          autocomplete.ExecuteShellCompletion,
			},
			{
				Name:            "@completion",
				Hidden:          true,
				HideHelpCommand: true,
				Action:          autocomplete.OutputCompletionScript,
			},
		},
		HideHelpCommand: true,
	}
}

func generateManpages(ctx context.Context, c *cli.Command) error {
	manpage, err := docs.ToManWithSection(Command, 1)
	if err != nil {
		return err
	}
	dir := c.String("output")
	err = os.MkdirAll(filepath.Join(dir, "man1"), 0755)
	if err != nil {
		// handle error
	}
	if c.Bool("text") {
		file, err := os.Create(filepath.Join(dir, "man1", "dedalus.1"))
		if err != nil {
			return err
		}
		defer file.Close()
		if _, err := file.WriteString(manpage); err != nil {
			return err
		}
	}
	if c.Bool("gzip") {
		file, err := os.Create(filepath.Join(dir, "man1", "dedalus.1.gz"))
		if err != nil {
			return err
		}
		defer file.Close()
		gzWriter := gzip.NewWriter(file)
		defer gzWriter.Close()
		_, err = gzWriter.Write([]byte(manpage))
		if err != nil {
			return err
		}
	}
	fmt.Printf("Wrote manpages to %s\n", dir)
	return nil
}
