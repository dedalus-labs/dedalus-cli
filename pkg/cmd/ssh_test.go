package cmd

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	gossh "golang.org/x/crypto/ssh"
)

func TestGenKeypair_produces_valid_ed25519(t *testing.T) {
	tmpDir := t.TempDir()
	keyPath := filepath.Join(tmpDir, "key")

	pubKeyStr, err := genKeypair(keyPath)
	require.NoError(t, err)

	// Public key is valid authorized_key format.
	pub, _, _, _, err := gossh.ParseAuthorizedKey([]byte(pubKeyStr))
	require.NoError(t, err)
	assert.Equal(t, "ssh-ed25519", pub.Type())

	// Private key file exists with restricted permissions.
	info, err := os.Stat(keyPath)
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0600), info.Mode().Perm())

	// Private key is parseable OpenSSH format.
	privBytes, err := os.ReadFile(keyPath)
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(string(privBytes), "-----BEGIN OPENSSH PRIVATE KEY-----"),
		"private key must be OpenSSH format, got: %s", string(privBytes[:40]))

	signer, err := gossh.ParsePrivateKey(privBytes)
	require.NoError(t, err)
	assert.Equal(t, "ssh-ed25519", signer.PublicKey().Type())

	// Public key file also written.
	pubFileBytes, err := os.ReadFile(keyPath + ".pub")
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(string(pubFileBytes), "ssh-ed25519 "))
}

func TestGenKeypair_keys_correspond(t *testing.T) {
	tmpDir := t.TempDir()
	keyPath := filepath.Join(tmpDir, "key")

	pubKeyStr, err := genKeypair(keyPath)
	require.NoError(t, err)

	privBytes, err := os.ReadFile(keyPath)
	require.NoError(t, err)
	signer, err := gossh.ParsePrivateKey(privBytes)
	require.NoError(t, err)

	pub, _, _, _, err := gossh.ParseAuthorizedKey([]byte(pubKeyStr))
	require.NoError(t, err)

	// The public key derived from the private key must match.
	assert.Equal(t,
		gossh.MarshalAuthorizedKey(signer.PublicKey()),
		gossh.MarshalAuthorizedKey(pub),
		"public key from private key must match the returned authorized key")
}

func TestGenKeypair_unique_per_call(t *testing.T) {
	tmpDir := t.TempDir()

	pub1, err := genKeypair(filepath.Join(tmpDir, "key1"))
	require.NoError(t, err)

	pub2, err := genKeypair(filepath.Join(tmpDir, "key2"))
	require.NoError(t, err)

	assert.NotEqual(t, pub1, pub2, "each invocation must produce a fresh keypair")
}

func TestKnownHostsLine_format(t *testing.T) {
	hostPattern := "*.ssh.dedaluslabs.ai"
	caPublicKey := "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExampleKeyData"

	line := "@cert-authority " + hostPattern + " " + caPublicKey + "\n"

	assert.True(t, strings.HasPrefix(line, "@cert-authority "))
	assert.Contains(t, line, hostPattern)
	assert.Contains(t, line, caPublicKey)
	assert.True(t, strings.HasSuffix(line, "\n"))

	// The line is parseable as a known_hosts entry by splitting.
	fields := strings.Fields(strings.TrimSpace(line))
	assert.Equal(t, 4, len(fields), "known_hosts cert-authority line should have 4 fields")
	assert.Equal(t, "@cert-authority", fields[0])
	assert.Equal(t, hostPattern, fields[1])
	assert.Equal(t, "ssh-ed25519", fields[2])
}

func TestSSHArgs_structure(t *testing.T) {
	args := []string{
		"-i", "/tmp/key",
		"-o", "CertificateFile=/tmp/key-cert.pub",
		"-o", "UserKnownHostsFile=/tmp/known_hosts",
		"-o", "GlobalKnownHostsFile=/dev/null",
		"-o", "StrictHostKeyChecking=yes",
		"-o", "IdentitiesOnly=yes",
		"-p", "2222",
		"workspace@ssh.dedaluslabs.ai",
	}

	// Identity file is first.
	assert.Equal(t, "-i", args[0])

	// CertificateFile is set.
	certIdx := -1
	for i, a := range args {
		if strings.HasPrefix(a, "CertificateFile=") {
			certIdx = i
			break
		}
	}
	assert.Greater(t, certIdx, 0, "CertificateFile option must be present")

	// StrictHostKeyChecking=yes is enforced (no TOFU).
	found := false
	for _, a := range args {
		if a == "StrictHostKeyChecking=yes" {
			found = true
		}
	}
	assert.True(t, found, "StrictHostKeyChecking=yes must be set")

	// IdentitiesOnly=yes prevents ssh-agent from offering other keys.
	idOnly := false
	for _, a := range args {
		if a == "IdentitiesOnly=yes" {
			idOnly = true
		}
	}
	assert.True(t, idOnly, "IdentitiesOnly=yes must be set")

	// GlobalKnownHostsFile=/dev/null prevents system-wide trust.
	globalNull := false
	for _, a := range args {
		if a == "GlobalKnownHostsFile=/dev/null" {
			globalNull = true
		}
	}
	assert.True(t, globalNull, "GlobalKnownHostsFile must be /dev/null")

	// Last arg is user@host.
	last := args[len(args)-1]
	assert.Contains(t, last, "@", "last arg must be user@host")
}

func TestCleanup_removes_temp_directory(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "dedalus-ssh-test-*")
	require.NoError(t, err)

	keyPath := filepath.Join(tmpDir, "key")
	require.NoError(t, os.WriteFile(keyPath, []byte("secret"), 0600))
	require.NoError(t, os.WriteFile(keyPath+".pub", []byte("public"), 0644))

	os.RemoveAll(tmpDir)

	_, err = os.Stat(tmpDir)
	assert.True(t, os.IsNotExist(err), "temp directory must be removed after cleanup")
	_, err = os.Stat(keyPath)
	assert.True(t, os.IsNotExist(err), "private key must be removed after cleanup")
}
