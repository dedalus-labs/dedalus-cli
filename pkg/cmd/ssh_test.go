package cmd

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
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

// The built CLI consumes the API response, then OpenSSH parses its actual output.
func TestSSHConsumerUsesTwoHopContract(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("the OpenSSH probe uses a POSIX executable wrapper")
	}
	realSSH, err := exec.LookPath("ssh")
	require.NoError(t, err)
	dir := t.TempDir()
	binary := filepath.Join(dir, "dedalus")
	output, err := exec.Command("go", "build", "-p", "2", "-o", binary, "../../cmd/dedalus").CombinedOutput()
	require.NoError(t, err, "%s", output)
	wrapper := `#!/bin/sh
config=
previous=
for arg do
    if [ "$previous" = -F ]; then config=$arg; fi
    previous=$arg
done
if [ -n "$config" ]; then cp -R "$(dirname "$config")/." "$SSH_CAPTURE/"; fi
exec "$REAL_SSH" -G "$@"
`
	require.NoError(t, os.WriteFile(filepath.Join(dir, "ssh"), []byte(wrapper), 0700))
	guestKey, err := genKeypair(filepath.Join(dir, "guest-host"))
	require.NoError(t, err)
	jumpKey, err := genKeypair(filepath.Join(dir, "jump-ca"))
	require.NoError(t, err)
	connection := map[string]any{
		"endpoint": "0199a1b2-c3d4-7000-8000-000000000001", "port": 22, "ssh_username": "root",
		"user_certificate": "guest-certificate\n",
		"host_trust":       map[string]any{"kind": "public_key", "host_pattern": "machine.runtime", "public_key": guestKey},
		"jump_host": map[string]any{
			"endpoint": "ssh.example.test", "port": 2222, "ssh_username": "wssh-session",
			"user_certificate": "jump-certificate\n",
			"host_trust":       map[string]any{"kind": "cert_authority", "host_pattern": "ssh.example.test", "public_key": jumpKey},
		},
	}
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(map[string]any{"session_id": "wssh-session", "status": "ready", "connection": connection}))
	})
	server := httptest.NewServer(handler)
	defer server.Close()
	capture := filepath.Join(dir, "capture")
	require.NoError(t, os.Mkdir(capture, 0700))
	temp := filepath.Join(dir, "temp with spaces")
	require.NoError(t, os.Mkdir(temp, 0700))
	command := exec.Command(binary, "--base-url", server.URL, "--api-key", "test", "ssh", connection["endpoint"].(string))
	command.Env = append(os.Environ(), "PATH="+dir+string(os.PathListSeparator)+os.Getenv("PATH"), "REAL_SSH="+realSSH, "SSH_CAPTURE="+capture, "TMPDIR="+temp)
	output, err = command.CombinedOutput()
	require.NoError(t, err, "%s", output)
	require.Contains(t, string(output), "proxyjump dedalus-jump\n")
	require.Contains(t, string(output), "hostname "+connection["endpoint"].(string)+"\n")
	require.Contains(t, string(output), "hostkeyalias machine.runtime\n")
	require.Contains(t, string(output), "/guest-cert.pub\n")
	jumpOutput, err := exec.Command(realSSH, "-G", "-F", filepath.Join(capture, "config"), "dedalus-jump").CombinedOutput()
	require.NoError(t, err, "%s", jumpOutput)
	require.Contains(t, string(jumpOutput), "/jump-cert.pub\n")
	for _, field := range []string{"hostname ssh.example.test", "port 2222", "user wssh-session", "hostkeyalias ssh.example.test"} {
		require.Contains(t, string(jumpOutput), field+"\n")
	}
	for _, text := range []string{string(output), string(jumpOutput)} {
		require.Contains(t, text, "stricthostkeychecking true\n")
		require.Contains(t, text, "identitiesonly yes\n")
		require.Contains(t, text, "/known_hosts\n")
		require.Contains(t, text, "globalknownhostsfile "+os.DevNull+"\n")
	}
	known, err := os.ReadFile(filepath.Join(capture, "known_hosts"))
	require.NoError(t, err)
	require.Equal(t, "machine.runtime "+strings.TrimSpace(guestKey)+"\n@cert-authority ssh.example.test "+strings.TrimSpace(jumpKey)+"\n", string(known))
	for name, want := range map[string]string{"guest-cert.pub": "guest-certificate\n", "jump-cert.pub": "jump-certificate\n"} {
		value, err := os.ReadFile(filepath.Join(capture, name))
		require.NoError(t, err)
		require.Equal(t, want, string(value))
	}
	for _, name := range []string{"key", "guest-cert.pub", "jump-cert.pub", "known_hosts", "config"} {
		info, err := os.Stat(filepath.Join(capture, name))
		require.NoError(t, err)
		require.Equal(t, os.FileMode(0600), info.Mode().Perm())
	}
	server.Close() // Finish the first response before changing the fixture contract.
	delete(connection, "jump_host")
	server = httptest.NewServer(handler)
	defer server.Close()
	command = exec.Command(binary, "--base-url", server.URL, "--api-key", "test", "ssh", connection["endpoint"].(string))
	command.Env = append(os.Environ(), "PATH="+dir+string(os.PathListSeparator)+os.Getenv("PATH"), "REAL_SSH="+realSSH)
	output, err = command.CombinedOutput()
	require.Error(t, err)
	require.Contains(t, string(output), "jump host")
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
