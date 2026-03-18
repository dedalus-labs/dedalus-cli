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
dedalus workspaces create \
  --api-key 'My API Key' \
  --memory-mib 2048 \
  --storage-gib 10 \
  --vcpu 1
```

For details about specific commands, use the `--help` flag.

### Environment variables

| Environment variable | Description                                          | Required | Default value |
| -------------------- | ---------------------------------------------------- | -------- | ------------- |
| `DEDALUS_API_KEY`    | Dedalus API key sent as Authorization: Bearer <key>. | no       | `null`        |
| `DEDALUS_X_API_KEY`  | Dedalus API key sent as x-api-key.                   | no       | `null`        |
| `DEDALUS_ORG_ID`     | Organization ID header applied to all DCS requests.  | no       | `null`        |

### Global flags

- `--api-key` - Dedalus API key sent as Authorization: Bearer <key>. (can also be set with `DEDALUS_API_KEY` env var)
- `--x-api-key` - Dedalus API key sent as x-api-key. (can also be set with `DEDALUS_X_API_KEY` env var)
- `--dedalus-org-id` - Organization ID header applied to all DCS requests. (can also be set with `DEDALUS_ORG_ID` env var)
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
