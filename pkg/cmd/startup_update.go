// Copyright (c) 2026 Dedalus Labs, Inc. All rights reserved.

package cmd

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/charmbracelet/x/term"
)

/*
The startup update prompt runs before urfave parses or executes the requested
command. Its control flow is:

  1. Skip non-interactive, CI, help, version, completion, and update commands.
  2. Read the cached release and use it immediately while it is fresh.
  3. Refresh stale or missing cache entries with a bounded network request.
  4. If that refresh fails, compare a previously valid cache entry.
  5. Prompt only when the selected release is newer than the running build.

Accepting the prompt delegates to the same updater used by `dedalus update`.
The true return value tells the caller not to execute the original command.
*/

const (
	dedalusHomeEnv         = "DEDALUS_HOME"
	disableUpdateCheckEnv  = "DEDALUS_NO_UPDATE_CHECK"
	startupUpdateCacheFile = "version.json"
	// startupUpdateCheckInterval keeps routine invocations off the release API
	// while allowing a fresh check during each day of CLI use.
	startupUpdateCheckInterval = 20 * time.Hour
	// startupUpdateCheckTimeout keeps a slow network from delaying command dispatch.
	startupUpdateCheckTimeout = 2 * time.Second
)

// startupVersionInfo is the complete on-disk cache entry. LastCheckedAt is the
// time of a successful release query, not the time the cache was read.
type startupVersionInfo struct {
	LatestVersion string    `json:"latest_version"`
	LastCheckedAt time.Time `json:"last_checked_at"`
}

// startupUpdatePrompt owns startup eligibility, release caching, and prompting.
// Function fields isolate terminal, clock, network, and update effects in tests.
type startupUpdatePrompt struct {
	stdin         io.Reader
	stderr        io.Writer
	getenv        func(string) string
	homeDir       func() (string, error)
	now           func() time.Time
	isInteractive func() bool
	latestVersion func(context.Context) (string, error)
	runUpdate     func(context.Context) error
	cachePath     string
}

// MaybeRunStartupUpdate prompts interactive users before command execution. It
// returns true only when the user selected the updater, so callers can stop the
// original command even when the update returns an error.
func MaybeRunStartupUpdate(ctx context.Context, args []string, stdin io.Reader, stdout, stderr io.Writer) (bool, error) {
	p := newStartupUpdatePrompt(stdin, stdout, stderr)
	return p.run(ctx, args)
}

func newStartupUpdatePrompt(stdin io.Reader, stdout, stderr io.Writer) *startupUpdatePrompt {
	p := &startupUpdatePrompt{
		stdin:   stdin,
		stderr:  stderr,
		getenv:  os.Getenv,
		homeDir: os.UserHomeDir,
		now:     time.Now,
	}
	p.isInteractive = func() bool {
		return terminalReader(stdin) && terminalWriter(stdout) && terminalWriter(stderr)
	}
	p.latestVersion = func(ctx context.Context) (string, error) {
		updater := newUpdater(io.Discard, io.Discard)
		return updater.latestVersion(ctx)
	}
	p.runUpdate = func(ctx context.Context) error {
		return newUpdater(stdout, stderr).update(ctx, updateOptions{})
	}
	return p
}

// run returns whether startup processing consumed the original command.
func (p *startupUpdatePrompt) run(ctx context.Context, args []string) (bool, error) {
	if p.shouldSkip(args) {
		return false, nil
	}

	latest, ok := p.upgradeVersion(ctx)
	if !ok {
		return false, nil
	}

	return p.prompt(ctx, latest)
}

// shouldSkip protects flows that must remain non-interactive. It examines raw
// arguments because startup prompting runs before the CLI parser.
func (p *startupUpdatePrompt) shouldSkip(args []string) bool {
	if !p.isInteractive() {
		return true
	}
	if envTruthy(p.getenv("CI")) || envTruthy(p.getenv(disableUpdateCheckEnv)) {
		return true
	}
	if hasHelpOrVersionArg(args) {
		return true
	}

	switch rootCommandArg(args) {
	case "update", "__complete", "@completion", "@manpages", "help":
		return true
	default:
		return false
	}
}

// upgradeVersion selects one release for comparison. A fresh cache avoids the
// network. A stale or missing cache gets one bounded refresh; a successful
// response remains usable when the cache write fails, while a failed refresh
// may still use a previously valid cache entry.
func (p *startupUpdatePrompt) upgradeVersion(ctx context.Context) (string, bool) {
	cachePath, err := p.versionCachePath()
	if err != nil {
		return "", false
	}

	info, cacheOK := readStartupVersionInfo(cachePath)
	if cacheOK && p.now().Sub(info.LastCheckedAt) < startupUpdateCheckInterval {
		return newerStartupVersion(info.LatestVersion)
	}

	checkCtx, cancel := context.WithTimeout(ctx, startupUpdateCheckTimeout)
	defer cancel()

	latest, err := p.latestVersion(checkCtx)
	if err == nil {
		if err := writeStartupVersionInfo(cachePath, startupVersionInfo{
			LatestVersion: latest,
			LastCheckedAt: p.now(),
		}); err != nil {
			return newerStartupVersion(latest)
		}
		return newerStartupVersion(latest)
	}

	if cacheOK {
		return newerStartupVersion(info.LatestVersion)
	}
	return "", false
}

// prompt returns true only after the user accepts the update. Input failures and
// negative answers leave the original command eligible to run.
func (p *startupUpdatePrompt) prompt(ctx context.Context, latest string) (bool, error) {
	fmt.Fprintf(p.stderr, "A new Dedalus CLI is available.\n\n")
	fmt.Fprintf(p.stderr, "Current: %s\n", versionTag(Version))
	fmt.Fprintf(p.stderr, "Latest:  %s\n\n", versionTag(latest))
	fmt.Fprint(p.stderr, "Update now?\n")
	fmt.Fprint(p.stderr, "> Yes\n")
	fmt.Fprint(p.stderr, "  Not now\n\n")
	fmt.Fprint(p.stderr, "Press Enter to update, or type n then Enter to skip: ")

	answer, err := bufio.NewReader(p.stdin).ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		fmt.Fprintln(p.stderr)
		return false, nil
	}
	if errors.Is(err, io.EOF) && strings.TrimSpace(answer) == "" {
		fmt.Fprintln(p.stderr)
		return false, nil
	}
	if shouldRunStartupUpdate(answer) {
		fmt.Fprintln(p.stderr)
		return true, p.runUpdate(ctx)
	}

	fmt.Fprintln(p.stderr)
	return false, nil
}

func (p *startupUpdatePrompt) versionCachePath() (string, error) {
	if p.cachePath != "" {
		return p.cachePath, nil
	}
	home := strings.TrimSpace(p.getenv(dedalusHomeEnv))
	if home == "" {
		userHome, err := p.homeDir()
		if err != nil {
			return "", err
		}
		home = filepath.Join(userHome, ".dedalus")
	}
	return filepath.Join(home, startupUpdateCacheFile), nil
}

// readStartupVersionInfo treats unreadable, malformed, and incomplete data as a
// cache miss. The caller then decides whether a network refresh is possible.
func readStartupVersionInfo(path string) (startupVersionInfo, bool) {
	data, err := os.ReadFile(path)
	if err != nil {
		return startupVersionInfo{}, false
	}
	var info startupVersionInfo
	if err := json.Unmarshal(data, &info); err != nil {
		return startupVersionInfo{}, false
	}
	if strings.TrimSpace(info.LatestVersion) == "" || info.LastCheckedAt.IsZero() {
		return startupVersionInfo{}, false
	}
	return info, true
}

func writeStartupVersionInfo(path string, info startupVersionInfo) error {
	data, err := json.Marshal(info)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0644)
}

func newerStartupVersion(latest string) (string, bool) {
	if isNewerVersion(latest, Version) {
		return versionTag(latest), true
	}
	return "", false
}

func shouldRunStartupUpdate(answer string) bool {
	answer = strings.ToLower(strings.TrimSpace(answer))
	return answer == "" || answer == "y" || answer == "yes"
}

// rootCommandArg finds the first positional root command without invoking the
// CLI parser. Root flags that consume a following value must be skipped here.
func rootCommandArg(args []string) string {
	for i := 1; i < len(args); i++ {
		arg := args[i]
		if arg == "--" {
			return ""
		}
		if strings.HasPrefix(arg, "-") {
			if rootFlagTakesValue(arg) && !strings.Contains(arg, "=") {
				i++
			}
			continue
		}
		return arg
	}
	return ""
}

// rootFlagTakesValue mirrors value-bearing flags on the Stainless-generated root
// command. New root flags must be added here or their value may be mistaken for
// a command.
func rootFlagTakesValue(arg string) bool {
	name := strings.TrimLeft(strings.SplitN(arg, "=", 2)[0], "-")
	switch name {
	case "api-key", "base-url", "dedalus-org-id", "format", "format-error", "transform", "transform-error", "x-api-key":
		return true
	default:
		return false
	}
}

func hasHelpOrVersionArg(args []string) bool {
	for _, arg := range args[1:] {
		switch arg {
		case "-h", "--help", "-v", "--version":
			return true
		}
	}
	return false
}

func envTruthy(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func terminalReader(r io.Reader) bool {
	f, ok := r.(*os.File)
	return ok && term.IsTerminal(f.Fd())
}

func terminalWriter(w io.Writer) bool {
	f, ok := w.(*os.File)
	return ok && term.IsTerminal(f.Fd())
}

type parsedVersion struct {
	major      int
	minor      int
	patch      int
	prerelease string
}

// isNewerVersion compares the numeric release tuple, then the prerelease suffix.
// Tags outside that grammar compare as normalized strings; any difference is
// treated as an available update.
func isNewerVersion(candidate, current string) bool {
	candidateVersion, okCandidate := parseVersion(candidate)
	currentVersion, okCurrent := parseVersion(current)
	if !okCandidate || !okCurrent {
		return !sameVersion(candidate, current)
	}

	if candidateVersion.major != currentVersion.major {
		return candidateVersion.major > currentVersion.major
	}
	if candidateVersion.minor != currentVersion.minor {
		return candidateVersion.minor > currentVersion.minor
	}
	if candidateVersion.patch != currentVersion.patch {
		return candidateVersion.patch > currentVersion.patch
	}
	if candidateVersion.prerelease == currentVersion.prerelease {
		return false
	}
	if candidateVersion.prerelease == "" {
		return true
	}
	if currentVersion.prerelease == "" {
		return false
	}
	return candidateVersion.prerelease > currentVersion.prerelease
}

// parseVersion accepts three numeric components and an optional prerelease
// suffix. Prerelease suffixes are compared lexicographically by isNewerVersion.
func parseVersion(version string) (parsedVersion, bool) {
	version = strings.TrimPrefix(strings.TrimSpace(version), "v")
	if version == "" {
		return parsedVersion{}, false
	}

	mainVersion, prerelease, _ := strings.Cut(version, "-")
	parts := strings.Split(mainVersion, ".")
	if len(parts) != 3 {
		return parsedVersion{}, false
	}

	major, err := strconv.Atoi(parts[0])
	if err != nil {
		return parsedVersion{}, false
	}
	minor, err := strconv.Atoi(parts[1])
	if err != nil {
		return parsedVersion{}, false
	}
	patch, err := strconv.Atoi(parts[2])
	if err != nil {
		return parsedVersion{}, false
	}

	return parsedVersion{
		major:      major,
		minor:      minor,
		patch:      patch,
		prerelease: prerelease,
	}, true
}
