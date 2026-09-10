# Feedback diagnostics

`createDiagnostics` records command names, route templates, HTTP status, duration,
and server-issued request IDs. It excludes arguments, headers, message bodies,
terminal output, and workspace files. Recording failures report an error to
stderr and stop local recording without interrupting the API command.

`diagnosticScope` separates API hosts, credentials, and organization overrides.
`selectDiagnostics` returns a failed command from the last 15 minutes in that
scope. It rebuilds permitted fields when reading and excludes feedback commands
and symlinked files. The credential digest stays in local filenames.

The default directory is `~/.dedalus/debug`. Each process records at most 1,000
events and 10 MiB. New writes prune files older than 10 days and keep the directory
under 50 MiB. Run `pnpm build && pnpm test` to verify these boundaries.
