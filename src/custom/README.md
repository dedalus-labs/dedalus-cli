# Machine aliases

`dedalus ssh` opens a searchable machine picker in an interactive terminal. Type
a name, machine ID, or lifecycle status to filter; use the arrow keys and Enter
to connect. Escape and Ctrl-C cancel, including while machines are loading.
Unnamed machines show their stable ID. Destroyed machines are excluded.

For scripts, use `dedalus ssh <name|machine_id>`. Omitting the target without a
terminal is a usage error. Selection uses the machine ID, and SSH session polling
uses the canonical ID returned by the server, so renaming during connection does
not redirect the session.

`dedalus rename <current-name-or-id> <new-name>` sends only the `name` field to the
machine update API. Validation belongs to the server; the CLI forwards names
unchanged. Success requires the response to confirm the requested name and a
canonical machine ID; an explicit input ID must match the returned ID. The CLI
supplies a fresh idempotency key per rename and preserves it across retries.
Global authentication, output formats, transforms, and error formatting apply
to both aliases. For example:

```sh
dedalus rename dev-box build-box --format pretty
dedalus rename dm-12345678-1234-4234-8234-123456789abc build-box --format json
dedalus ssh build-box
```

Validation:

```sh
npm run typecheck
npm run build
node --test tests/machine-aliases.test.mjs
node --test tests/ssh-paths.test.mjs
python3 tests/ssh-picker-pty.py
```
