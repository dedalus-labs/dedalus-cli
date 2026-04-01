// Implements `dedalus ssh <machine_id>`:
//
//  1. Generate ephemeral ed25519 keypair in a temp directory.
//  2. POST /v1/machines/{machine_id}/ssh with the public key.
//  3. Poll GET until status=ready.
//  4. Write user certificate and host CA to temp files.
//  5. Exec the local ssh binary with explicit trust settings.
//  6. Clean up temp directory on exit (including signal-driven exit).

package cmd

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/pem"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strconv"
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
		Name:      "ssh",
		Usage:     "SSH into a running machine",
		UsageText: "dedalus ssh <machine_id>",
		Category:  "MACHINE",
		Suggest:   true,
		Flags:  []cli.Flag{},
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

	conn := sess.Connection
	if conn.UserCertificate == "" {
		return fmt.Errorf("SSH session %s is ready but the server returned no user certificate; this is a server-side bug", sess.SessionID)
	}
	if conn.Endpoint == "" {
		return fmt.Errorf("SSH session %s is ready but the server returned no endpoint; this is a server-side bug", sess.SessionID)
	}
	if conn.HostTrust.PublicKey == "" {
		return fmt.Errorf("SSH session %s is ready but the server returned no host CA public key; this is a server-side bug", sess.SessionID)
	}

	certPath := filepath.Join(dir, "key-cert.pub")
	if err := os.WriteFile(certPath, []byte(conn.UserCertificate), 0600); err != nil {
		return fmt.Errorf("write certificate: %w", err)
	}

	khPath := filepath.Join(dir, "known_hosts")
	line := fmt.Sprintf("@cert-authority %s %s\n", conn.HostTrust.HostPattern, conn.HostTrust.PublicKey)
	if err := os.WriteFile(khPath, []byte(line), 0600); err != nil {
		return fmt.Errorf("write known_hosts: %w", err)
	}

	return runSSH(ctx, keyPath, certPath, khPath, conn)
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

func runSSH(ctx context.Context, keyPath, certPath, khPath string, conn dedalus.SSHConnection) error {
	bin, err := exec.LookPath("ssh")
	if err != nil {
		return fmt.Errorf("ssh not found in PATH; install OpenSSH and ensure 'ssh' is available in your shell: %w", err)
	}

	fmt.Fprintf(os.Stderr, "connecting to %s@%s:%d\n", conn.SSHUsername, conn.Endpoint, conn.Port)

	c := exec.CommandContext(ctx, bin,
		"-i", keyPath,
		"-o", "CertificateFile="+certPath,
		"-o", "UserKnownHostsFile="+khPath,
		"-o", "GlobalKnownHostsFile=/dev/null",
		"-o", "StrictHostKeyChecking=yes",
		"-o", "IdentitiesOnly=yes",
		"-p", strconv.FormatInt(conn.Port, 10),
		conn.SSHUsername+"@"+conn.Endpoint,
	)
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
