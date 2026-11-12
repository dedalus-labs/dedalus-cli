#!/usr/bin/env bash
# Compatibility entry point embedded in the released Go CLI. Keep this URL stable.
set -euo pipefail

main() (
    local repo='https://github.com/dedalus-labs/dedalus-cli'
    local install_dir="${DEDALUS_INSTALL_DIR:-$HOME/.local/bin}"
    local version="${DEDALUS_VERSION:-}" os arch stage probe watchdog actual

    case "$(uname -s)" in
        Darwin) os=darwin ;;
        Linux) os=linux ;;
        *) echo 'Unsupported OS; this installer supports macOS and Linux.' >&2; exit 1 ;;
    esac
    case "$(uname -m)" in
        x86_64|amd64) arch=x64 ;;
        arm64|aarch64) arch=arm64 ;;
        *) echo 'Unsupported architecture; expected x64 or arm64.' >&2; exit 1 ;;
    esac

    if [[ -z "$version" ]]; then
        version=$(curl -fsSL --connect-timeout 10 --max-time 30 -o /dev/null \
            -w '%{url_effective}' "$repo/releases/latest")
        version=${version##*/}
    fi
    if [[ ! "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
        echo "Invalid release tag: $version" >&2
        exit 1
    fi

    mkdir -p "$install_dir"
    install_dir=$(cd "$install_dir" && pwd -P)
    if [[ -L "$install_dir/dedalus" || -d "$install_dir/dedalus" ]]; then
        echo 'Refusing to replace a symlink or directory; use the original package manager.' >&2
        exit 1
    fi
    # Stage beside the destination so the final rename stays on one filesystem.
    stage=$(mktemp -d "$install_dir/.dedalus-install.XXXXXX")
    trap 'rm -rf "$stage"' EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    local asset="dedalus-${os}-${arch}.tar.gz"
    echo "Downloading $version ($os/$arch)..."
    curl -fsSL --connect-timeout 10 --max-time 300 \
        "$repo/releases/download/$version/$asset" -o "$stage/archive.tar.gz"
    tar -xzf "$stage/archive.tar.gz" -C "$stage" dedalus
    if [[ ! -f "$stage/dedalus" || -L "$stage/dedalus" ]]; then
        echo "$asset did not contain a regular dedalus executable." >&2
        exit 1
    fi
    chmod 755 "$stage/dedalus"

    # Verify both compatibility and version before replacing the working CLI.
    "$stage/dedalus" --version > "$stage/version" &
    probe=$!
    (sleep 10; kill -KILL "$probe" 2>/dev/null || true) >/dev/null 2>&1 &
    watchdog=$!
    if ! wait "$probe"; then
        kill "$watchdog" 2>/dev/null || true
        echo 'Downloaded CLI failed its version check; existing CLI left unchanged.' >&2
        exit 1
    fi
    kill "$watchdog" 2>/dev/null || true
    actual=$(cat "$stage/version")
    if [[ "$actual" != "${version#v}" ]]; then
        echo "Expected ${version#v}, received $actual; existing CLI left unchanged." >&2
        exit 1
    fi
    mv -f "$stage/dedalus" "$install_dir/dedalus"
    echo "Installed dedalus $version to $install_dir/dedalus"
    echo 'For future updates, run: dedalus upgrade'
)

# Read the entire script before doing work when invoked by the legacy curl | bash.
main "$@"
