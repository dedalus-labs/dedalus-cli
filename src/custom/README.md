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
