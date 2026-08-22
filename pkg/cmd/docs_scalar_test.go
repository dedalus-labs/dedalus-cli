package cmd

import (
	"bytes"
	"context"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/urfave/cli/v3"
)

type scalarInvocation struct {
	projectDir string
	args       []string
}

func TestScalarPreviewUsesDiscoveredProject(t *testing.T) {
	root := t.TempDir()
	projectDir := writeScalarConfig(t, filepath.Join(root, "apps", "docs-scalar"))
	nestedDir := filepath.Join(root, "packages", "example")
	if err := os.MkdirAll(nestedDir, 0o755); err != nil {
		t.Fatalf("MkdirAll(%q): %v", nestedDir, err)
	}

	invocations, app := newScalarTestApp(func() (string, error) { return nestedDir, nil })
	if err := app.Run(context.Background(), []string{
		"dedalus", "docs", "scalar", "preview", "--port", "3100",
	}); err != nil {
		t.Fatalf("preview returned unexpected error: %v", err)
	}

	assertScalarInvocation(t, *invocations, projectDir, []string{
		"exec", "scalar", "project", "preview", scalarConfigFile, "--port", "3100",
	})
}

func TestScalarCheckUsesExplicitProject(t *testing.T) {
	projectDir := writeScalarConfig(t, filepath.Join(t.TempDir(), "scalar-docs"))
	invocations, app := newScalarTestApp(func() (string, error) {
		t.Fatal("explicit --project-dir should not inspect the current directory")
		return "", nil
	})

	if err := app.Run(context.Background(), []string{
		"dedalus", "docs", "scalar", "check", "--project-dir", projectDir,
	}); err != nil {
		t.Fatalf("check returned unexpected error: %v", err)
	}

	assertScalarInvocation(t, *invocations, projectDir, []string{
		"exec", "scalar", "project", "check-config", scalarConfigFile,
	})
}

func TestScalarPublishRequiresPreview(t *testing.T) {
	projectDir := writeScalarConfig(t, filepath.Join(t.TempDir(), "scalar-docs"))
	invocations, app := newScalarTestApp(func() (string, error) { return projectDir, nil })

	err := app.Run(context.Background(), []string{"dedalus", "docs", "scalar", "publish"})
	if err == nil || !strings.Contains(err.Error(), "requires --preview") {
		t.Fatalf("publish error = %v, want preview requirement", err)
	}
	if len(*invocations) != 0 {
		t.Fatalf("publish without --preview ran Scalar: %#v", *invocations)
	}
}

func TestScalarPublishPreview(t *testing.T) {
	projectDir := writeScalarConfig(t, filepath.Join(t.TempDir(), "scalar-docs"))
	invocations, app := newScalarTestApp(func() (string, error) { return projectDir, nil })

	if err := app.Run(context.Background(), []string{
		"dedalus", "docs", "scalar", "publish", "--preview",
	}); err != nil {
		t.Fatalf("publish returned unexpected error: %v", err)
	}

	assertScalarInvocation(t, *invocations, projectDir, []string{
		"exec", "scalar", "project", "publish", "--config", scalarConfigFile, "--preview",
	})
}

func TestScalarPreviewRejectsInvalidPort(t *testing.T) {
	projectDir := writeScalarConfig(t, filepath.Join(t.TempDir(), "scalar-docs"))
	invocations, app := newScalarTestApp(func() (string, error) { return projectDir, nil })

	err := app.Run(context.Background(), []string{
		"dedalus", "docs", "scalar", "preview", "--port", "65536",
	})
	if err == nil || !strings.Contains(err.Error(), "1 to 65535") {
		t.Fatalf("preview error = %v, want port range error", err)
	}
	if len(*invocations) != 0 {
		t.Fatalf("preview with invalid port ran Scalar: %#v", *invocations)
	}
}

func TestScalarProjectDiscoveryFailureIsActionable(t *testing.T) {
	invocations, app := newScalarTestApp(func() (string, error) { return t.TempDir(), nil })

	err := app.Run(context.Background(), []string{"dedalus", "docs", "scalar", "check"})
	if err == nil || !strings.Contains(err.Error(), "pass --project-dir") {
		t.Fatalf("check error = %v, want --project-dir guidance", err)
	}
	if len(*invocations) != 0 {
		t.Fatalf("check without a project ran Scalar: %#v", *invocations)
	}
}

func newScalarTestApp(getwd func() (string, error)) (*[]scalarInvocation, *cli.Command) {
	invocations := []scalarInvocation{}
	runner := func(
		_ context.Context,
		projectDir string,
		args []string,
		_ io.Reader,
		_ io.Writer,
		_ io.Writer,
	) error {
		invocations = append(invocations, scalarInvocation{
			projectDir: projectDir,
			args:       slices.Clone(args),
		})
		return nil
	}

	app := &cli.Command{
		Name:      "dedalus",
		Commands:  []*cli.Command{newScalarDocsCommand(getwd, runner)},
		Reader:    bytes.NewReader(nil),
		Writer:    io.Discard,
		ErrWriter: io.Discard,
	}
	return &invocations, app
}

func writeScalarConfig(t *testing.T, projectDir string) string {
	t.Helper()
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		t.Fatalf("MkdirAll(%q): %v", projectDir, err)
	}
	if err := os.WriteFile(filepath.Join(projectDir, scalarConfigFile), []byte("{}\n"), 0o644); err != nil {
		t.Fatalf("WriteFile(%q): %v", projectDir, err)
	}
	return projectDir
}

func assertScalarInvocation(
	t *testing.T,
	invocations []scalarInvocation,
	wantProjectDir string,
	wantArgs []string,
) {
	t.Helper()
	if len(invocations) != 1 {
		t.Fatalf("Scalar invocation count = %d, want 1: %#v", len(invocations), invocations)
	}
	if invocations[0].projectDir != wantProjectDir {
		t.Errorf("Scalar project directory = %q, want %q", invocations[0].projectDir, wantProjectDir)
	}
	if !slices.Equal(invocations[0].args, wantArgs) {
		t.Errorf("Scalar arguments = %#v, want %#v", invocations[0].args, wantArgs)
	}
}
