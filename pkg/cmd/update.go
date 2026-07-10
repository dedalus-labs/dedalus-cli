package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/urfave/cli/v3"
)

/*
The update command delegates installation to the mechanism that owns the
running binary. Its control flow is:

  1. Fetch the newest GitHub release and stop if it matches the current build.
  2. Stop after reporting versions when --check is set.
  3. Classify the executable from its platform, resolved path, and installer
     evidence.
  4. Run the matching installer, or print manual instructions when ownership
     cannot be proved.

Homebrew ownership requires both a path inside Homebrew's prefix and an
installed dedalus cask. Direct installs are recognized by their default path,
the marker written by install.sh, or DEDALUS_INSTALL_DIR. Detection checks
Homebrew first because its cask also installs a binary named dedalus.
*/

const (
	installScriptURL  = "https://raw.githubusercontent.com/dedalus-labs/dedalus-cli/main/scripts/install.sh"
	installPS1URL     = "https://raw.githubusercontent.com/dedalus-labs/dedalus-cli/main/scripts/install.ps1"
	latestReleaseURL  = "https://api.github.com/repos/dedalus-labs/dedalus-cli/releases/latest"
	defaultUnixBinDir = ".local/bin"
	installMarkerFile = ".dedalus-cli-install"
)

var updateCommand = cli.Command{
	Name:      "update",
	Usage:     "Update the Dedalus CLI",
	UsageText: "dedalus update [--check]",
	Category:  "CLI",
	Suggest:   true,
	Flags: []cli.Flag{
		&cli.BoolFlag{
			Name:  "check",
			Usage: "Check for the latest release without installing it.",
		},
	},
	Action:          handleUpdate,
	HideHelpCommand: true,
}

func init() {
	Command.Commands = append(Command.Commands, &updateCommand)
}

type updateOptions struct {
	checkOnly bool
}

// installMethod identifies the update action selected for the running binary.
type installMethod int

const (
	installMethodCurl installMethod = iota
	installMethodHomebrewCask
	installMethodWindows
	installMethodUnknown
)

// updater owns release discovery, install detection, and command execution.
// Function fields isolate operating-system effects so tests can replace them.
type updater struct {
	goos          string
	stdout        io.Writer
	stderr        io.Writer
	executable    func() (string, error)
	lookPath      func(string) (string, error)
	commandOutput func(context.Context, string, ...string) (string, error)
	runCommand    func(context.Context, []string, string, ...string) error
	httpClient    *http.Client
	latestURL     string
}

// detectedInstall records the selected action and the executable, when available.
type detectedInstall struct {
	method installMethod
	exe    string
}

type latestRelease struct {
	TagName string `json:"tag_name"`
}

func handleUpdate(ctx context.Context, c *cli.Command) error {
	return newUpdater(c.Root().Writer, c.Root().ErrWriter).update(ctx, updateOptions{
		checkOnly: c.Bool("check"),
	})
}

func newUpdater(stdout, stderr io.Writer) *updater {
	if stdout == nil {
		stdout = os.Stdout
	}
	if stderr == nil {
		stderr = os.Stderr
	}
	u := &updater{
		goos:       runtime.GOOS,
		stdout:     stdout,
		stderr:     stderr,
		executable: os.Executable,
		lookPath:   exec.LookPath,
		httpClient: http.DefaultClient,
		latestURL:  latestReleaseURL,
	}
	u.commandOutput = u.defaultCommandOutput
	u.runCommand = u.defaultRunCommand
	return u
}

func (u *updater) update(ctx context.Context, opts updateOptions) error {
	latest, err := u.latestVersion(ctx)
	if err != nil {
		return err
	}

	current := versionTag(Version)
	fmt.Fprintf(u.stdout, "Current version: %s\n", current)
	fmt.Fprintf(u.stdout, "Latest version:  %s\n", latest)

	if sameVersion(current, latest) {
		fmt.Fprintf(u.stdout, "dedalus is already at %s\n", current)
		return nil
	}
	if opts.checkOnly {
		return nil
	}

	install := u.detectInstall(ctx)

	switch install.method {
	case installMethodHomebrewCask:
		return u.updateWithHomebrew(ctx)
	case installMethodWindows:
		return u.printWindowsUpdateCommand(install.exe)
	case installMethodCurl:
		return u.updateWithInstallScript(ctx, install.exe)
	case installMethodUnknown:
		return u.printManualUpdate()
	default:
		return fmt.Errorf("unknown install method %d", install.method)
	}
}

func (u *updater) latestVersion(ctx context.Context) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.latestURL, nil)
	if err != nil {
		return "", fmt.Errorf("build latest release request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", fmt.Sprintf("Dedalus/CLI %s", Version))

	resp, err := u.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("fetch latest release: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("fetch latest release: got %s", resp.Status)
	}

	var release latestRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return "", fmt.Errorf("decode latest release: %w", err)
	}
	tag := strings.TrimSpace(release.TagName)
	if tag == "" {
		return "", fmt.Errorf("fetch latest release: missing tag_name")
	}
	return versionTag(tag), nil
}

// detectInstall returns unknown unless one install mechanism has enough evidence.
// The checks are ordered from strongest ownership evidence to weakest.
func (u *updater) detectInstall(ctx context.Context) detectedInstall {
	exe, err := u.executablePath()
	if err != nil {
		if u.goos == "windows" {
			return detectedInstall{method: installMethodWindows}
		}
		return detectedInstall{method: installMethodUnknown}
	}

	if u.goos == "windows" {
		return detectedInstall{method: installMethodWindows, exe: exe}
	}
	if u.isHomebrewCask(ctx, exe) {
		return detectedInstall{method: installMethodHomebrewCask, exe: exe}
	}
	if u.isLikelyCurlInstall(exe) {
		return detectedInstall{method: installMethodCurl, exe: exe}
	}
	return detectedInstall{method: installMethodUnknown, exe: exe}
}

// isHomebrewCask requires the executable path and Homebrew's cask database to
// agree. Merely finding brew on PATH does not establish ownership.
func (u *updater) isHomebrewCask(ctx context.Context, exe string) bool {
	if u.goos != "darwin" {
		return false
	}
	brew, err := u.lookPath("brew")
	if err != nil {
		return false
	}
	prefix, err := u.commandOutput(ctx, brew, "--prefix")
	if err != nil || !pathWithin(exe, strings.TrimSpace(prefix)) {
		return false
	}
	return u.commandSucceeds(ctx, brew, "list", "--cask", "--versions", "dedalus")
}

// isLikelyCurlInstall recognizes direct installer layouts. The default path
// covers installs created before the marker existed. The marker persists custom
// install directories; the environment recognizes an active installer override.
func (u *updater) isLikelyCurlInstall(exe string) bool {
	if u.goos == "windows" {
		return false
	}
	if filepath.Base(exe) != "dedalus" {
		return false
	}
	home, err := os.UserHomeDir()
	if err == nil && pathWithin(exe, filepath.Join(home, defaultUnixBinDir)) {
		return true
	}
	if hasInstallScriptMarker(exe) {
		return true
	}
	installDir := os.Getenv("DEDALUS_INSTALL_DIR")
	return installDir != "" && pathWithin(exe, installDir)
}

func (u *updater) updateWithHomebrew(ctx context.Context) error {
	brew, err := u.lookPath("brew")
	if err != nil {
		return fmt.Errorf("find brew: %w", err)
	}
	args := []string{"upgrade", "--cask", "dedalus"}
	fmt.Fprintf(u.stdout, "Running: brew %s\n", strings.Join(args, " "))
	return u.runCommand(ctx, nil, brew, args...)
}

// updateWithInstallScript pins the published installer to the executable's
// current directory so a custom direct install is updated in place.
func (u *updater) updateWithInstallScript(ctx context.Context, exe string) error {
	installDir := filepath.Dir(exe)
	fmt.Fprintf(u.stdout, "Running installer with DEDALUS_INSTALL_DIR=%s\n", installDir)
	return u.runCommand(ctx, []string{"DEDALUS_INSTALL_DIR=" + installDir}, "bash", "-c", "curl -fsSL "+installScriptURL+" | bash")
}

func (u *updater) printWindowsUpdateCommand(exe string) error {
	installDir := ""
	if exe != "" {
		installDir = filepath.Dir(exe)
	}
	fmt.Fprintln(u.stdout, "Windows does not allow replacing the running dedalus.exe process.")
	fmt.Fprintln(u.stdout, "Run this from a new PowerShell session:")
	if installDir != "" {
		fmt.Fprintf(u.stdout, "  $env:DEDALUS_INSTALL_DIR = '%s'; irm %s | iex\n", powerShellSingleQuoted(installDir), installPS1URL)
		return nil
	}
	fmt.Fprintf(u.stdout, "  irm %s | iex\n", installPS1URL)
	return nil
}

func (u *updater) printManualUpdate() error {
	fmt.Fprintln(u.stdout, "Could not determine how this dedalus binary was installed.")
	fmt.Fprintln(u.stdout, "Update with the package manager or installer you originally used.")
	return nil
}

// executablePath resolves symlinks when possible so detection inspects the
// installation path instead of the path of a launcher or shim.
func (u *updater) executablePath() (string, error) {
	exe, err := u.executable()
	if err != nil {
		return "", fmt.Errorf("locate current executable: %w", err)
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	return exe, nil
}

func (u *updater) commandSucceeds(ctx context.Context, name string, args ...string) bool {
	_, err := u.commandOutput(ctx, name, args...)
	return err == nil
}

func (u *updater) defaultCommandOutput(ctx context.Context, name string, args ...string) (string, error) {
	c := exec.CommandContext(ctx, name, args...)
	out, err := c.Output()
	return string(out), err
}

func (u *updater) defaultRunCommand(ctx context.Context, env []string, name string, args ...string) error {
	c := exec.CommandContext(ctx, name, args...)
	if len(env) > 0 {
		c.Env = append(os.Environ(), env...)
	}
	c.Stdin = os.Stdin
	c.Stdout = u.stdout
	c.Stderr = u.stderr
	return c.Run()
}

func versionTag(version string) string {
	version = strings.TrimSpace(version)
	if version == "" || strings.HasPrefix(version, "v") {
		return version
	}
	return "v" + version
}

func sameVersion(a, b string) bool {
	return strings.TrimPrefix(versionTag(a), "v") == strings.TrimPrefix(versionTag(b), "v")
}

// pathWithin uses path components instead of string prefixes, so directories
// such as /opt/homebrew-old cannot match /opt/homebrew.
func pathWithin(path, dir string) bool {
	if strings.TrimSpace(dir) == "" {
		return false
	}
	absPath, ok := comparablePath(path)
	if !ok {
		return false
	}
	absDir, ok := comparablePath(dir)
	if !ok {
		return false
	}
	rel, err := filepath.Rel(absDir, absPath)
	if err != nil {
		return false
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator)))
}

func comparablePath(path string) (string, bool) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", false
	}
	if resolved, err := filepath.EvalSymlinks(abs); err == nil {
		abs = resolved
	}
	return abs, true
}

func hasInstallScriptMarker(exe string) bool {
	info, err := os.Stat(filepath.Join(filepath.Dir(exe), installMarkerFile))
	return err == nil && !info.IsDir()
}

func powerShellSingleQuoted(value string) string {
	return strings.ReplaceAll(value, "'", "''")
}
