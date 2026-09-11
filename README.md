# Dedalus CLI

The official CLI for the [Dedalus REST API](https://docs.dedaluslabs.ai).

It is generated with [Stainless](https://www.stainless.com/).

<!-- x-release-please-start-version -->

## Installation

### Installing with Homebrew

```sh
brew install dedalus-labs/tap/dedalus
```

### Installing with Go

To test or install the CLI locally, you need [Go](https://go.dev/doc/install) version 1.22 or later installed.

```sh
go install 'github.com/dedalus-labs/dedalus-cli/cmd/dedalus@latest'
```

Once you have run `go install`, the binary is placed in your Go bin directory:

- **Default location**: `$HOME/go/bin` (or `$GOPATH/bin` if GOPATH is set)
- **Check your path**: Run `go env GOPATH` to see the base directory

If commands aren't found after installation, add the Go bin directory to your PATH:

```sh
# Add to your shell profile (.zshrc, .bashrc, etc.)
export PATH="$PATH:$(go env GOPATH)/bin"
```

<!-- x-release-please-end -->

### Updating

```sh
dedalus update
```

To check the latest available release without installing it:

```sh
dedalus update --check
```

The updater respects how the CLI was installed. Homebrew installs delegate to
`brew upgrade`, macOS/Linux curl installs rerun the install script for the
current executable directory, and Windows installs print the PowerShell installer
command because Windows cannot replace the running `dedalus.exe` process.

### Running Locally

After cloning the git repository for this project, you can use the
`scripts/run` script to run the tool locally:

```sh
./scripts/run args...
```

## Usage

The CLI follows a resource-based command structure:

```sh
dedalus [resource] <command> [flags...]
```

```sh
dedalus machines create \
  --api-key 'My API Key' \
  --memory-mib 2048 \
  --storage-gib 10 \
  --vcpu 1
```

For details about specific commands, use the `--help` flag.

Machine API commands cover creation, listing, retrieval, updates, deletion,
sleep, and wake. Secure Shell (SSH) session and execution operations are nested
under `machines ssh` and `machines executions`.

The generated contract is defined by the [OpenAPI snapshot](https://storage.googleapis.com/stainless-sdk-openapi-specs/dedalus-labs/dedalus-c0e28b234478af75f61bcf42f5f32818d96ec93b1d8239fa0ff1c801c0e4b64f.yml).

### Running commands on a machine

`exec` is an alias for `executions`. Pass the executable and its arguments after
`--` to create an asynchronous execution:

```sh
dedalus machines exec --machine-id "$MACHINE_ID" -- echo "hello world"
```

`create` is optional in this form. The existing JSON form also works:

```sh
dedalus machines exec create --machine-id "$MACHINE_ID" --command '["echo", "hello world"]'
dedalus machines exec retrieve --machine-id "$MACHINE_ID" --execution-id "$EXECUTION_ID"
```

Put CLI options such as `--cwd`, `--env`, `--stdin`, and `--timeout-ms` before
`--`. Arguments after it are sent literally, including spaces, leading dashes,
and `@` prefixes. Use either those arguments or `--command` in one request.

To interpret shell operators remotely, invoke a shell and quote its script:

```sh
dedalus machines exec --machine-id "$MACHINE_ID" -- sh -c 'echo "hello world" && ls -la'
```

An unquoted `&&` is interpreted by your local shell before the CLI runs.
Creating an execution returns an execution ID. Use `retrieve` to check its
status and `output` to read its output. The `list`, `events`, and `delete`
subcommands also work under `exec`.

### Environment variables

| Environment variable | Description                                   | Required | Default value |
| -------------------- | --------------------------------------------- | -------- | ------------- |
| `DEDALUS_API_KEY`    | Dedalus API key sent as Authorization Bearer. | no       | `null`        |
| `DEDALUS_X_API_KEY`  | Dedalus API key sent as x-api-key header.     | no       | `null`        |
| `DEDALUS_ORG_ID`     | Organization ID header for all DCS requests.  | no       | `null`        |

### Global flags

- `--api-key` - Dedalus API key sent as Authorization Bearer. (can also be set with `DEDALUS_API_KEY` env var)
- `--x-api-key` - Dedalus API key sent as x-api-key header. (can also be set with `DEDALUS_X_API_KEY` env var)
- `--dedalus-org-id` - Organization ID header for all DCS requests. (can also be set with `DEDALUS_ORG_ID` env var)
- `--help` - Show command line usage
- `--debug` - Enable debug logging (includes HTTP request/response details)
- `--version`, `-v` - Show the CLI version
- `--base-url` - Use a custom API backend URL
- `--format` - Change the output format (`auto`, `explore`, `json`, `jsonl`, `pretty`, `raw`, `yaml`)
- `--format-error` - Change the output format for errors (`auto`, `explore`, `json`, `jsonl`, `pretty`, `raw`, `yaml`)
- `--transform` - Transform the data output using [GJSON syntax](https://github.com/tidwall/gjson/blob/master/SYNTAX.md)
- `--transform-error` - Transform the error output using [GJSON syntax](https://github.com/tidwall/gjson/blob/master/SYNTAX.md)

### Passing files as arguments

To pass files to your API, you can use the `@myfile.ext` syntax:

```bash
dedalus <command> --arg @abe.jpg
```

Files can also be passed inside JSON or YAML blobs:

```bash
dedalus <command> --arg '{image: "@abe.jpg"}'
# Equivalent:
dedalus <command> <<YAML
arg:
  image: "@abe.jpg"
YAML
```

If you need to pass a string literal that begins with an `@` sign, you can
escape the `@` sign to avoid accidentally passing a file.

```bash
dedalus <command> --username '\@abe'
```

#### Explicit encoding

For JSON endpoints, the CLI tool does filetype sniffing to determine whether the
file contents should be sent as a string literal (for plain text files) or as a
base64-encoded string literal (for binary files). If you need to explicitly send
the file as either plain text or base64-encoded data, you can use
`@file://myfile.txt` (for string encoding) or `@data://myfile.dat` (for
base64-encoding). Note that absolute paths will begin with `@file://` or
`@data://`, followed by a third `/` (for example, `@file:///tmp/file.txt`).

```bash
dedalus <command> --arg @data://file.txt
```

## Linking different Go SDK versions

You can link the CLI against a different version of the Dedalus Go SDK
for development purposes using the `./scripts/link` script.

To link to a specific version from a repository (version can be a branch,
git tag, or commit hash):

```bash
./scripts/link github.com/org/repo@version
```

To link to a local copy of the SDK:

```bash
./scripts/link ../path/to/dedalus-go
```

If you run the link script without any arguments, it will default to `../dedalus-go`.
