# SSH shortcut

`dedalus ssh` opens a searchable machine picker in an interactive terminal.
Filter by machine ID or lifecycle status, then use the arrow keys and Enter to
connect. Escape and Ctrl-C cancel, including while machines are loading.
Destroyed machines are excluded.

For scripts, use `dedalus ssh <machine-id>` with a bare UUID. Omitting the ID
without a terminal is a usage error. SSH polling uses the machine ID returned
by the server and waits through wake and SSH setup states.

```sh
dedalus ssh 12345678-1234-4234-8234-123456789abc
```

Validation:

```sh
npm run typecheck
npm run build
node --test tests/machine-aliases.test.mjs
node --test tests/ssh-paths.test.mjs
python3 tests/ssh-picker-pty.py
```

# Execution arguments

Use `dedalus machines exec --machine-id <id> -- <command> [args...]` to
create an execution. `machines executions` accepts the same arguments, with optional `create`.
Arguments after `--` are literal: spaces, empty arguments, remote flags, and
`@file` references are sent unchanged. The executable itself cannot be empty.
Do not combine these arguments with `--command`.

```sh
dedalus machines exec --machine-id 12345678-1234-4234-8234-123456789abc -- printf '%s\n' '@remote-file'
dedalus machines exec create --machine-id 12345678-1234-4234-8234-123456789abc --command '["echo", "hello"]'
```

Existing execution management subcommands remain available under every spelling.
This shortcut returns the execution response; use `output` to retrieve output.
The custom machines registration installs the shortcut after generated commands.
Keep the `LiteralCliValue` coercion guard when regenerating the runtime so remote
arguments never become local file reads.

```sh
node --test tests/execution-argv.test.mjs
```

# Nested resources

Resource levels use spaces: `machines ssh`, `machines executions logs`,
`machines autoresizing`, and `organization autoresizing`. The custom runtime path normalization
runs before execution shortcuts and creates missing parent groups without
changing API handlers or flags. Preserve that marked block when regenerating. Colon spellings are removed.
Help and shell completion follow the resulting command tree.
