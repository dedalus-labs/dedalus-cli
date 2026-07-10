// Copyright (c) 2026 Dedalus Labs, Inc. All rights reserved.

package cmd

import (
	"bytes"
	"context"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestStartupUpdatePromptUsesFreshCacheAndRunsUpdate(t *testing.T) {
	now := time.Date(2026, 6, 24, 12, 0, 0, 0, time.UTC)
	cachePath := filepath.Join(t.TempDir(), startupUpdateCacheFile)
	if err := writeStartupVersionInfo(cachePath, startupVersionInfo{
		LatestVersion: "v9.9.9",
		LastCheckedAt: now,
	}); err != nil {
		t.Fatalf("writeStartupVersionInfo() returned unexpected error: %v", err)
	}

	var stderr bytes.Buffer
	ranUpdate := false
	prompt := newTestStartupUpdatePrompt(t, cachePath, "\n", &stderr)
	prompt.now = func() time.Time { return now }
	prompt.latestVersion = func(context.Context) (string, error) {
		t.Fatal("fresh cache should not fetch latest version")
		return "", nil
	}
	prompt.runUpdate = func(context.Context) error {
		ranUpdate = true
		return nil
	}

	updated, err := prompt.run(context.Background(), []string{"dedalus", "machines", "list"})
	if err != nil {
		t.Fatalf("startup update prompt returned unexpected error: %v", err)
	}
	if !updated {
		t.Fatal("startup update prompt did not report that update ran")
	}
	if !ranUpdate {
		t.Fatal("startup update prompt did not run updater")
	}

	got := stderr.String()
	for _, want := range []string{
		"A new Dedalus CLI is available.",
		"Current: v" + Version,
		"Latest:  v9.9.9",
		"Update now?\n> Yes\n  Not now",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("prompt output = %q, want substring %q", got, want)
		}
	}
}

func TestStartupUpdatePromptDeclinesUpdate(t *testing.T) {
	now := time.Date(2026, 6, 24, 12, 0, 0, 0, time.UTC)
	cachePath := filepath.Join(t.TempDir(), startupUpdateCacheFile)
	if err := writeStartupVersionInfo(cachePath, startupVersionInfo{
		LatestVersion: "v9.9.9",
		LastCheckedAt: now,
	}); err != nil {
		t.Fatalf("writeStartupVersionInfo() returned unexpected error: %v", err)
	}

	var stderr bytes.Buffer
	prompt := newTestStartupUpdatePrompt(t, cachePath, "n\n", &stderr)
	prompt.now = func() time.Time { return now }
	prompt.runUpdate = func(context.Context) error {
		t.Fatal("declining the prompt should not run updater")
		return nil
	}

	updated, err := prompt.run(context.Background(), []string{"dedalus", "machines", "list"})
	if err != nil {
		t.Fatalf("startup update prompt returned unexpected error: %v", err)
	}
	if updated {
		t.Fatal("startup update prompt reported an update after user declined")
	}
	if got, want := stderr.String(), "Update now?\n> Yes\n  Not now"; !strings.Contains(got, want) {
		t.Errorf("prompt output = %q, want substring %q", got, want)
	}
}

func TestStartupUpdatePromptSkipsNonInteractiveLaunch(t *testing.T) {
	cachePath := filepath.Join(t.TempDir(), startupUpdateCacheFile)
	if err := writeStartupVersionInfo(cachePath, startupVersionInfo{
		LatestVersion: "v9.9.9",
		LastCheckedAt: time.Now(),
	}); err != nil {
		t.Fatalf("writeStartupVersionInfo() returned unexpected error: %v", err)
	}

	var stderr bytes.Buffer
	prompt := newTestStartupUpdatePrompt(t, cachePath, "\n", &stderr)
	prompt.isInteractive = func() bool { return false }
	prompt.runUpdate = func(context.Context) error {
		t.Fatal("noninteractive launch should not run updater")
		return nil
	}

	updated, err := prompt.run(context.Background(), []string{"dedalus", "machines", "list"})
	if err != nil {
		t.Fatalf("startup update prompt returned unexpected error: %v", err)
	}
	if updated {
		t.Fatal("noninteractive launch reported an update")
	}
	if got := stderr.String(); got != "" {
		t.Errorf("noninteractive prompt output = %q, want empty", got)
	}
}

func TestStartupUpdatePromptRefreshesStaleCache(t *testing.T) {
	now := time.Date(2026, 6, 24, 12, 0, 0, 0, time.UTC)
	cachePath := filepath.Join(t.TempDir(), startupUpdateCacheFile)
	if err := writeStartupVersionInfo(cachePath, startupVersionInfo{
		LatestVersion: "v" + Version,
		LastCheckedAt: now.Add(-startupUpdateCheckInterval - time.Minute),
	}); err != nil {
		t.Fatalf("writeStartupVersionInfo() returned unexpected error: %v", err)
	}

	var stderr bytes.Buffer
	prompt := newTestStartupUpdatePrompt(t, cachePath, "n\n", &stderr)
	prompt.now = func() time.Time { return now }
	prompt.latestVersion = func(context.Context) (string, error) {
		return "v9.9.9", nil
	}

	updated, err := prompt.run(context.Background(), []string{"dedalus", "machines", "list"})
	if err != nil {
		t.Fatalf("startup update prompt returned unexpected error: %v", err)
	}
	if updated {
		t.Fatal("declining refreshed prompt reported an update")
	}

	info, ok := readStartupVersionInfo(cachePath)
	if !ok {
		t.Fatal("expected refreshed startup version cache")
	}
	if info.LatestVersion != "v9.9.9" {
		t.Errorf("refreshed latest version = %q, want v9.9.9", info.LatestVersion)
	}
	if !info.LastCheckedAt.Equal(now) {
		t.Errorf("refreshed last_checked_at = %s, want %s", info.LastCheckedAt, now)
	}
}

func TestRootCommandArgSkipsRootUpdateOnly(t *testing.T) {
	t.Parallel()

	if got, want := rootCommandArg([]string{"dedalus", "--format", "json", "update"}), "update"; got != want {
		t.Errorf("rootCommandArg(root update) = %q, want %q", got, want)
	}
	if got, want := rootCommandArg([]string{"dedalus", "machines", "update"}), "machines"; got != want {
		t.Errorf("rootCommandArg(nested update) = %q, want %q", got, want)
	}
}

func TestIsNewerVersion(t *testing.T) {
	t.Parallel()

	tests := []struct {
		candidate string
		current   string
		want      bool
	}{
		{candidate: "v0.4.1", current: "0.4.0", want: true},
		{candidate: "v0.4.0", current: "0.4.0", want: false},
		{candidate: "v0.3.9", current: "0.4.0", want: false},
		{candidate: "v1.0.0-beta", current: "v1.0.0", want: false},
		{candidate: "v1.0.0", current: "v1.0.0-beta", want: true},
	}

	for _, tt := range tests {
		if got := isNewerVersion(tt.candidate, tt.current); got != tt.want {
			t.Errorf("isNewerVersion(%q, %q) = %t, want %t", tt.candidate, tt.current, got, tt.want)
		}
	}
}

func newTestStartupUpdatePrompt(t *testing.T, cachePath string, stdin string, stderr *bytes.Buffer) *startupUpdatePrompt {
	t.Helper()

	return &startupUpdatePrompt{
		stdin:         strings.NewReader(stdin),
		stderr:        stderr,
		getenv:        func(string) string { return "" },
		homeDir:       func() (string, error) { return t.TempDir(), nil },
		now:           time.Now,
		isInteractive: func() bool { return true },
		latestVersion: func(context.Context) (string, error) { return "v" + Version, nil },
		runUpdate:     func(context.Context) error { return nil },
		cachePath:     cachePath,
	}
}
