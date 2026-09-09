# CLI API input

`dcs.openapi.json` is a Dedalus-owned snapshot of the API contract used by the
reviewed CLI command table. It was copied without changes from
`dedalus-labs/dedalus-cli` commit `fd5540f2220b861f6b36ebf653f954e36d5b069a`,
path `openapi.augmented.json` (Scalar generator 0.23.6).

Scalar 0.30.0 removed that intermediate file from its output. Do not depend on
it returning or restore it into a Scalar-owned path. This snapshot is maintained
with the CLI and is not refreshed implicitly by Scalar.

For an API update, replace the snapshot with the reviewed DCS OpenAPI document
used for that release, record its source revision here, run
`npm run generate:commands`, and review the generated commands and `api.md`.
Unknown operation IDs stop generation until their CLI names are explicitly mapped.
Commit the input and generated outputs together. `npm run generate:check` and
command coverage tests reject stale or incomplete output.
