# Machine aliases

`dedalus rename <current-name-or-id> <new-name>` sends only the `name` field to the
machine update API. Validation belongs to the server; the CLI forwards names
unchanged. Success requires the response to confirm the requested name and a
canonical machine ID; an explicit input ID must match the returned ID. The CLI
supplies a fresh idempotency key per rename and preserves it across retries.
Global authentication, output formats, transforms, and error formatting apply
to the rename command. For example:

```sh
dedalus rename dev-box build-box --format pretty
dedalus rename dm-12345678-1234-4234-8234-123456789abc build-box --format json
```

Validation:

```sh
npm run typecheck
npm run build
node --test tests/machine-aliases.test.mjs
node --test tests/ssh-paths.test.mjs
```

`dedalus ssh <name|machine_id>` connects with an ephemeral key and verifies the server host certificate. Session polling uses the canonical machine ID returned by the server.
