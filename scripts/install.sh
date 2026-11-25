#!/usr/bin/env bash
# Compatibility entry point embedded in the released Go CLI. Keep this URL stable.
set -euo pipefail

main() (
    local version="${DEDALUS_VERSION:-}" spec='dedalus-cli@latest'
    local install_dir="${DEDALUS_INSTALL_DIR:-}" global_bin actual stage

    if ! command -v node >/dev/null || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)'; then
        echo 'Node.js 20 or newer is required. Install it from https://nodejs.org/ and retry.' >&2
        exit 1
    fi
    if ! command -v pnpm >/dev/null; then
        echo 'pnpm is required. Install it from https://pnpm.io/installation and retry.' >&2
        exit 1
    fi
    if [[ -n "$version" ]]; then
        if [[ ! "$version" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
            echo "Invalid package version: $version" >&2
            exit 1
        fi
        spec="dedalus-cli@${version#v}"
    fi
    if [[ -n "$install_dir" && ( -L "$install_dir/dedalus" || -d "$install_dir/dedalus" ) ]]; then
        echo 'Refusing to replace a symlink or directory; use the original package manager.' >&2
        exit 1
    fi
    if ! global_bin=$(pnpm bin --global) || [[ -z "$global_bin" ]]; then
        echo 'Configure pnpm global installs with pnpm setup, then retry in a new shell.' >&2
        exit 1
    fi

    pnpm add --global --ignore-scripts "$spec"
    actual=$("$global_bin/dedalus" --version)
    if [[ -n "$version" && "$actual" != "${version#v}" ]]; then
        echo "Expected ${version#v}, received $actual." >&2
        exit 1
    fi
    # Older Go updaters request their original executable's directory.
    if [[ -n "$install_dir" ]]; then
        mkdir -p "$install_dir"
        install_dir=$(cd "$install_dir" && pwd -P)
        global_bin=$(cd "$global_bin" && pwd -P)
        if [[ "$install_dir" != "$global_bin" ]]; then
            stage=$(mktemp -d "$install_dir/.dedalus-install.XXXXXX")
            trap 'rm -rf "$stage"' EXIT
            printf '#!/usr/bin/env bash\nexec %q "$@"\n' "$global_bin/dedalus" > "$stage/dedalus"
            chmod 755 "$stage/dedalus"
            mv -f "$stage/dedalus" "$install_dir/dedalus"
        fi
    fi
    echo "Installed dedalus $actual with pnpm ($global_bin/dedalus)."
    echo 'For future updates, run: pnpm add --global dedalus-cli@latest'
)

# Read the entire script before doing work when invoked by curl | bash.
main "$@"
