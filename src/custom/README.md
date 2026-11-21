# Command customizations

`ports.ts` adds the sharing password flag to the generated port update
definition. Validation runs after flags, file arguments and piped JSON merge,
before the SDK sends a request. The command table and runtime hook stay inside
`@custom` regions so regeneration retains this behavior. The generated SDK
already forwards additional update body fields.

## SSH shortcut

`dedalus machines create --ssh` creates a machine, then connects through the
same SSH flow as `dedalus ssh <machine-id>`. The generated command owns the create flags,
piped JSON, API defaults, and authentication. Its result hook passes the raw
machine ID and the existing client to SSH before output transforms run.
Creation errors skip SSH. Session errors retain the usual CLI error format.

With piped JSON, SSH reads from the controlling terminal after the create command
consumes stdin. If the terminal cannot be opened, the command rejects `--ssh`
before creating a machine. The terminal descriptor closes after command execution.

Reconnect hints use the SDK's resolved endpoint and organization. Explicit
credential flags become environment-variable references with instructions to
reuse the same credential. File references remain file references. Endpoint URLs
containing credentials or query parameters also use an environment reference.

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
