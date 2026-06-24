package cmd

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func TestLatestVersion(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("latestVersion request method = %q, want GET", r.Method)
		}
		if r.URL.Path != "/latest" {
			t.Errorf("latestVersion request path = %q, want /latest", r.URL.Path)
		}
		if got := r.Header.Get("Accept"); got != "application/vnd.github+json" {
			t.Errorf("latestVersion Accept header = %q, want application/vnd.github+json", got)
		}
		if got := r.Header.Get("User-Agent"); got == "" {
			t.Error("latestVersion User-Agent header is empty")
		}
		io.WriteString(w, `{"tag_name":"v9.8.7"}`)
	}))
	defer server.Close()

	updater := newTestUpdater(t)
	updater.latestURL = server.URL + "/latest"

	got, err := updater.latestVersion(context.Background())
	if err != nil {
		t.Fatalf("latestVersion() returned unexpected error: %v", err)
	}
	if want := "v9.8.7"; got != want {
		t.Errorf("latestVersion() = %q, want %q", got, want)
	}
}

func TestUpdateCheckOnly(t *testing.T) {
	t.Parallel()

	server := latestVersionServer(t, "v9.9.9")
	defer server.Close()

	var stdout bytes.Buffer
	updater := newTestUpdater(t)
	updater.stdout = &stdout
	updater.latestURL = server.URL + "/latest"
	updater.runCommand = func(context.Context, []string, string, ...string) error {
		t.Fatal("update --check should not run commands")
		return nil
	}

	if err := updater.update(context.Background(), updateOptions{checkOnly: true}); err != nil {
		t.Fatalf("update(checkOnly: true) returned unexpected error: %v", err)
	}

	got := stdout.String()
	for _, want := range []string{"Current version: v" + Version, "Latest version:  v9.9.9"} {
		if !strings.Contains(got, want) {
			t.Errorf("update(checkOnly: true) output = %q, want substring %q", got, want)
		}
	}
}

func TestUpdateSkipsCurrentVersion(t *testing.T) {
	t.Parallel()

	server := latestVersionServer(t, "v"+Version)
	defer server.Close()

	var stdout bytes.Buffer
	updater := newTestUpdater(t)
	updater.stdout = &stdout
	updater.latestURL = server.URL + "/latest"
	updater.runCommand = func(context.Context, []string, string, ...string) error {
		t.Fatal("update should not run commands when current version is latest")
		return nil
	}

	if err := updater.update(context.Background(), updateOptions{}); err != nil {
		t.Fatalf("update() returned unexpected error: %v", err)
	}
	if got, want := stdout.String(), "dedalus is already at v"+Version; !strings.Contains(got, want) {
		t.Errorf("update() output = %q, want substring %q", got, want)
	}
}

func TestUpdateHomebrewCask(t *testing.T) {
	t.Parallel()

	prefix := t.TempDir()
	exe := filepath.Join(prefix, "bin", "dedalus")
	writeExecutable(t, exe)

	server := latestVersionServer(t, "v9.9.9")
	defer server.Close()

	var ranName string
	var ranArgs []string
	updater := newTestUpdater(t)
	updater.goos = "darwin"
	updater.executable = func() (string, error) { return exe, nil }
	updater.latestURL = server.URL + "/latest"
	updater.lookPath = func(name string) (string, error) {
		if name == "brew" {
			return "/opt/homebrew/bin/brew", nil
		}
		return "", errors.New("not found")
	}
	updater.commandOutput = func(_ context.Context, name string, args ...string) (string, error) {
		switch {
		case name == "/opt/homebrew/bin/brew" && slices.Equal(args, []string{"--prefix"}):
			return prefix + "\n", nil
		case name == "/opt/homebrew/bin/brew" && slices.Equal(args, []string{"list", "--cask", "--versions", "dedalus"}):
			return "dedalus 9.8.0\n", nil
		default:
			return "", errors.New("unexpected command")
		}
	}
	updater.runCommand = func(_ context.Context, _ []string, name string, args ...string) error {
		ranName = name
		ranArgs = slices.Clone(args)
		return nil
	}

	if err := updater.update(context.Background(), updateOptions{}); err != nil {
		t.Fatalf("update() returned unexpected error: %v", err)
	}
	if ranName != "/opt/homebrew/bin/brew" {
		t.Errorf("update() command name = %q, want /opt/homebrew/bin/brew", ranName)
	}
	if want := []string{"upgrade", "--cask", "dedalus"}; !slices.Equal(ranArgs, want) {
		t.Errorf("update() command args = %v, want %v", ranArgs, want)
	}
}

func TestUpdateCurlInstall(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	exe := filepath.Join(home, ".local", "bin", "dedalus")
	writeExecutable(t, exe)

	server := latestVersionServer(t, "v9.9.9")
	defer server.Close()

	var ranEnv []string
	var ranName string
	var ranArgs []string
	updater := newTestUpdater(t)
	updater.executable = func() (string, error) { return exe, nil }
	updater.latestURL = server.URL + "/latest"
	updater.runCommand = func(_ context.Context, env []string, name string, args ...string) error {
		ranEnv = slices.Clone(env)
		ranName = name
		ranArgs = slices.Clone(args)
		return nil
	}

	if err := updater.update(context.Background(), updateOptions{}); err != nil {
		t.Fatalf("update() returned unexpected error: %v", err)
	}
	resolvedExe, err := filepath.EvalSymlinks(exe)
	if err != nil {
		t.Fatalf("EvalSymlinks(%q) returned unexpected error: %v", exe, err)
	}
	if want := []string{"DEDALUS_INSTALL_DIR=" + filepath.Dir(resolvedExe)}; !slices.Equal(ranEnv, want) {
		t.Errorf("update() env = %v, want %v", ranEnv, want)
	}
	if ranName != "bash" {
		t.Errorf("update() command name = %q, want bash", ranName)
	}
	if want := []string{"-c", "curl -fsSL " + installScriptURL + " | bash"}; !slices.Equal(ranArgs, want) {
		t.Errorf("update() command args = %v, want %v", ranArgs, want)
	}
}

func TestUpdateCustomCurlInstallWithMarker(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	exe := filepath.Join(t.TempDir(), "bin", "dedalus")
	writeExecutable(t, exe)
	writeInstallMarker(t, filepath.Dir(exe))

	server := latestVersionServer(t, "v9.9.9")
	defer server.Close()

	var ranEnv []string
	var ranName string
	updater := newTestUpdater(t)
	updater.executable = func() (string, error) { return exe, nil }
	updater.latestURL = server.URL + "/latest"
	updater.runCommand = func(_ context.Context, env []string, name string, args ...string) error {
		ranEnv = slices.Clone(env)
		ranName = name
		return nil
	}

	if err := updater.update(context.Background(), updateOptions{}); err != nil {
		t.Fatalf("update() returned unexpected error: %v", err)
	}
	resolvedExe, err := filepath.EvalSymlinks(exe)
	if err != nil {
		t.Fatalf("EvalSymlinks(%q) returned unexpected error: %v", exe, err)
	}
	if want := []string{"DEDALUS_INSTALL_DIR=" + filepath.Dir(resolvedExe)}; !slices.Equal(ranEnv, want) {
		t.Errorf("update() env = %v, want %v", ranEnv, want)
	}
	if ranName != "bash" {
		t.Errorf("update() command name = %q, want bash", ranName)
	}
}

func TestWindowsUpdatePrintsInstallerCommand(t *testing.T) {
	t.Parallel()

	server := latestVersionServer(t, "v9.9.9")
	defer server.Close()

	var stdout bytes.Buffer
	updater := newTestUpdater(t)
	updater.goos = "windows"
	updater.stdout = &stdout
	updater.latestURL = server.URL + "/latest"
	updater.executable = func() (string, error) {
		return filepath.Join("C:", "Users", "me", ".local", "bin", "dedalus.exe"), nil
	}

	if err := updater.update(context.Background(), updateOptions{}); err != nil {
		t.Fatalf("update() returned unexpected error: %v", err)
	}
	got := stdout.String()
	for _, want := range []string{"Windows does not allow replacing the running dedalus.exe process.", "install.ps1", "DEDALUS_INSTALL_DIR"} {
		if !strings.Contains(got, want) {
			t.Errorf("windows update output = %q, want substring %q", got, want)
		}
	}
}

func TestUnknownInstallPrintsManualInstructions(t *testing.T) {
	t.Parallel()

	exe := filepath.Join(t.TempDir(), "dedalus")
	server := latestVersionServer(t, "v9.9.9")
	defer server.Close()

	var stdout bytes.Buffer
	updater := newTestUpdater(t)
	updater.stdout = &stdout
	updater.executable = func() (string, error) { return exe, nil }
	updater.latestURL = server.URL + "/latest"

	if err := updater.update(context.Background(), updateOptions{}); err != nil {
		t.Fatalf("update() returned unexpected error: %v", err)
	}
	if got, want := stdout.String(), "Could not determine how this dedalus binary was installed."; !strings.Contains(got, want) {
		t.Errorf("unknown install output = %q, want substring %q", got, want)
	}
}

func newTestUpdater(t *testing.T) *updater {
	t.Helper()

	updater := newUpdater(io.Discard, io.Discard)
	updater.goos = "linux"
	updater.executable = func() (string, error) {
		return filepath.Join(t.TempDir(), "dedalus"), nil
	}
	updater.lookPath = func(string) (string, error) {
		return "", errors.New("not found")
	}
	updater.commandOutput = func(context.Context, string, ...string) (string, error) {
		return "", errors.New("not found")
	}
	updater.runCommand = func(context.Context, []string, string, ...string) error {
		return nil
	}
	return updater
}

func latestVersionServer(t *testing.T, tag string) *httptest.Server {
	t.Helper()

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/latest" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"tag_name":"`+tag+`"}`)
	}))
}

func writeExecutable(t *testing.T, path string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatalf("MkdirAll(%q) returned unexpected error: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte("old"), 0755); err != nil {
		t.Fatalf("WriteFile(%q) returned unexpected error: %v", path, err)
	}
}

func writeInstallMarker(t *testing.T, dir string) {
	t.Helper()

	if err := os.WriteFile(filepath.Join(dir, installMarkerFile), []byte("method=install-script\n"), 0644); err != nil {
		t.Fatalf("WriteFile(%q) returned unexpected error: %v", installMarkerFile, err)
	}
}
