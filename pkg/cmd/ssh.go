// Implements `dedalus ssh <machine_id>`:
//
//  1. Generate ephemeral ed25519 keypair in a temp directory.
//  2. POST /v1/machines/{machine_id}/ssh with the public key.
//  3. Poll GET until status=ready.
//  4. Write guest and jump-host credentials to a private OpenSSH config.
//  5. Exec the local ssh binary with explicit trust settings.
//  6. Clean up temp directory on exit (including signal-driven exit).

package cmd

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/dedalus-labs/dedalus-go"
	"github.com/urfave/cli/v3"
	"golang.org/x/crypto/ssh"
)

const (
	sshPollInterval = 500 * time.Millisecond
	sshPollMax      = 120
)

func init() {
	Command.Commands = append(Command.Commands, &cli.Command{
		Name:            "ssh",
		Usage:           "SSH into a running machine",
		UsageText:       "dedalus ssh <machine_id>",
		Category:        "MACHINE",
		Suggest:         true,
		Flags:           []cli.Flag{},
		Action:          handleSSH,
		HideHelpCommand: true,
	})
}

func handleSSH(ctx context.Context, cmd *cli.Command) error {
	machineID := cmd.Args().First()
	if machineID == "" {
		return fmt.Errorf("machine_id is required; usage: dedalus ssh <machine_id>")
	}

	client := dedalus.NewClient(getDefaultRequestOptions(cmd)...)

	dir, err := os.MkdirTemp("", "dedalus-ssh-*")
	if err != nil {
		return fmt.Errorf("create temp directory for ephemeral SSH keys: %w", err)
	}
	removed := false
	remove := func() {
		if !removed {
			os.RemoveAll(dir)
			removed = true
		}
	}
	defer remove()
	trapSignals(remove)

	keyPath := filepath.Join(dir, "key")
	pubKey, err := genKeypair(keyPath)
	if err != nil {
		return err
	}

	sess, err := awaitSSHSession(ctx, &client, machineID, pubKey)
	if err != nil {
		return err
	}

	return runSSH(ctx, dir, sess.Connection)
}

func awaitSSHSession(
	ctx context.Context,
	client *dedalus.Client,
	machineID, pubKey string,
) (*dedalus.SSHSession, error) {
	resp, err := client.Machines.SSH.New(ctx, dedalus.MachineSSHNewParams{
		MachineID: machineID,
		SSHSessionCreateParams: dedalus.SSHSessionCreateParams{
			PublicKey: pubKey,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("create ssh session: %w", err)
	}
	fmt.Fprintf(os.Stderr, "ssh %s: %s\n", resp.SessionID, resp.Status)

	for i := 0; i < sshPollMax; i++ {
		switch resp.Status {
		case dedalus.SSHSessionStatusReady:
			return resp, nil
		case dedalus.SSHSessionStatusFailed:
			msg := resp.ErrorMessage
			if msg == "" {
				msg = "no detail from server"
			}
			return nil, fmt.Errorf("SSH session failed: %s (error_code=%s)", msg, resp.ErrorCode)
		case dedalus.SSHSessionStatusExpired:
			return nil, fmt.Errorf("SSH session expired before it became ready; try again with a fresh session")
		case dedalus.SSHSessionStatusClosed:
			return nil, fmt.Errorf("SSH session was closed before it became ready; another client may have deleted it")
		}

		delay := sshPollInterval
		if resp.RetryAfterMs > 0 {
			delay = time.Duration(resp.RetryAfterMs) * time.Millisecond
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(delay):
		}

		resp, err = client.Machines.SSH.Get(ctx, dedalus.MachineSSHGetParams{
			MachineID: machineID,
			SessionID: resp.SessionID,
		})
		if err != nil {
			return nil, fmt.Errorf("poll ssh session: %w", err)
		}
		fmt.Fprintf(os.Stderr, "ssh %s: %s\n", resp.SessionID, resp.Status)
	}
	return nil, fmt.Errorf("SSH session did not become ready after %d polls (%v); the Dedalus Machine may be unresponsive or the SSH gateway may be down", sshPollMax, time.Duration(sshPollMax)*sshPollInterval)
}

func runSSH(ctx context.Context, dir string, conn dedalus.SSHConnection) error {
	// The pinned SDK preserves new fields in RawJSON until its next generation.
	var response struct {
		JumpHost *dedalus.SSHConnection `json:"jump_host"`
	}
	if err := json.Unmarshal([]byte(conn.RawJSON()), &response); err != nil {
		return fmt.Errorf("read SSH jump host: %w", err)
	}
	if response.JumpHost == nil {
		return fmt.Errorf("SSH connection has no jump host")
	}
	pathValue := func(name string) string {
		path := filepath.ToSlash(filepath.Join(dir, name))
		return strconv.Quote(strings.ReplaceAll(path, "%", "%%"))
	}
	var config, knownHosts strings.Builder
	for _, hop := range []struct {
		name, kind, marker string
		connection         dedalus.SSHConnection
	}{
		{"guest", "public_key", "", conn},
		{"jump", "cert_authority", "@cert-authority ", *response.JumpHost},
	} {
		connection := hop.connection
		if string(connection.HostTrust.Kind) != hop.kind {
			return fmt.Errorf("SSH %s requires %s host trust", hop.name, hop.kind)
		}
		for _, token := range []string{connection.Endpoint, connection.SSHUsername, connection.HostTrust.HostPattern} {
			if token == "" || strings.ContainsAny(token, "\x00\r\n\t\v\f \"\\%$`;&|<>(){}#") {
				return fmt.Errorf("SSH %s has an invalid host, user, or host-key alias", hop.name)
			}
		}
		publicKey := strings.TrimSpace(connection.HostTrust.PublicKey)
		if connection.Port < 1 || connection.Port > 65535 || connection.UserCertificate == "" || publicKey == "" || strings.ContainsAny(publicKey, "\r\n") {
			return fmt.Errorf("SSH %s has an invalid port or missing credentials", hop.name)
		}
		certName := hop.name + "-cert.pub"
		if err := os.WriteFile(filepath.Join(dir, certName), []byte(connection.UserCertificate), 0600); err != nil {
			return fmt.Errorf("write SSH %s certificate: %w", hop.name, err)
		}
		fmt.Fprintf(&knownHosts, "%s%s %s\n", hop.marker, connection.HostTrust.HostPattern, publicKey)
		fmt.Fprintf(&config, `Host dedalus-%s
    HostName %s
    Port %d
    User %s
    HostKeyAlias %s
    CertificateFile %s
`,
			hop.name, connection.Endpoint, connection.Port, connection.SSHUsername, connection.HostTrust.HostPattern, pathValue(certName))
		if hop.name == "guest" {
			config.WriteString("    ProxyJump dedalus-jump\n")
		}
	}
	fmt.Fprintf(&config, `Host dedalus-guest dedalus-jump
    IdentityFile %s
    UserKnownHostsFile %s
    GlobalKnownHostsFile %q
    StrictHostKeyChecking yes
    IdentitiesOnly yes
`,
		pathValue("key"), pathValue("known_hosts"), filepath.ToSlash(os.DevNull))
	if err := os.WriteFile(filepath.Join(dir, "known_hosts"), []byte(knownHosts.String()), 0600); err != nil {
		return fmt.Errorf("write SSH host trust: %w", err)
	}
	configPath := filepath.Join(dir, "config")
	if err := os.WriteFile(configPath, []byte(config.String()), 0600); err != nil {
		return fmt.Errorf("write SSH config: %w", err)
	}
	bin, err := exec.LookPath("ssh")
	if err != nil {
		return fmt.Errorf("ssh not found in PATH; install OpenSSH and ensure 'ssh' is available in your shell: %w", err)
	}
	fmt.Fprintf(os.Stderr, "connecting to %s through %s\n", conn.Endpoint, response.JumpHost.Endpoint)
	c := exec.CommandContext(ctx, bin, "-F", configPath, "dedalus-guest")
	c.Stdin = os.Stdin
	c.Stdout = os.Stdout
	c.Stderr = os.Stderr

	if err := c.Run(); err != nil {
		if exit, ok := err.(*exec.ExitError); ok {
			os.Exit(exit.ExitCode())
		}
		return err
	}
	return nil
}

func genKeypair(keyPath string) (string, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return "", fmt.Errorf("generate ed25519 key: %w", err)
	}

	privPEM, err := ssh.MarshalPrivateKey(priv, "")
	if err != nil {
		return "", fmt.Errorf("marshal private key: %w", err)
	}
	if err := os.WriteFile(keyPath, pem.EncodeToMemory(privPEM), 0600); err != nil {
		return "", fmt.Errorf("write private key: %w", err)
	}

	sshPub, err := ssh.NewPublicKey(pub)
	if err != nil {
		return "", fmt.Errorf("convert to ssh public key: %w", err)
	}
	authorized := string(ssh.MarshalAuthorizedKey(sshPub))

	if err := os.WriteFile(keyPath+".pub", []byte(authorized), 0644); err != nil {
		return "", fmt.Errorf("write public key: %w", err)
	}
	return authorized, nil
}

func trapSignals(cleanup func()) {
	ch := make(chan os.Signal, 1)
	signal.Notify(ch, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-ch
		cleanup()
		signal.Reset(syscall.SIGINT, syscall.SIGTERM)
		p, _ := os.FindProcess(os.Getpid())
		_ = p.Signal(syscall.SIGINT)
	}()
}
