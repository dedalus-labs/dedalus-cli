# Feedback diagnostics

`createDiagnostics` records command names, route templates, HTTP status, duration,
and server-issued request IDs. It excludes arguments, headers, message bodies,
terminal output, and workspace files. Recording failures report an error to
stderr and stop local recording without interrupting the API command.

`diagnosticScope` separates API hosts, credentials, and organization overrides.
`selectDiagnostics` returns a failed command from the last 15 minutes in that
scope, selected by its terminal `command_failure` event. Attempts that recover
before `command_complete` do not qualify. A failed command retains the final
response's valid receipt even if a successful HTTP response could not be processed;
failure status metadata requires the final HTTP response to be an error.
Selection rebuilds permitted fields when reading and excludes feedback commands
and symlinked files. The credential digest stays in local filenames.

The default directory is `~/.dedalus/debug`. Each process records at most 1,000
events and 10 MiB. New writes prune files older than 10 days and keep the directory
under 50 MiB. Run `pnpm build && pnpm test` to verify these boundaries.

`buildFeedbackBundle` selects files for the explicit `auto`, `true`, or `false`
log-inclusion mode. Opt-out sends no files while retaining a recent server
receipt as metadata. Auto mode attaches only recent failures in the same scope.
Explicit inclusion adds a runtime and proxy-presence report, even without logs.
Proxy values are omitted. Each attachment carries its exact byte count and
SHA-256 digest; the bundle contains at most four files and 1 MiB compressed.
