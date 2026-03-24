#!/usr/bin/env bash
set -euo pipefail

REPO="dedalus-labs/dedalus-cli"
BINARY="dedalus"
INSTALL_DIR="${DEDALUS_INSTALL_DIR:-$HOME/.local/bin}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

error()   { echo -e "${RED}[ERROR]${NC} $1" >&2; }
info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }

detect_platform() {
    local os arch

    case "$(uname -s)" in
        Linux)  os="linux" ;;
        Darwin) os="macos" ;;
        *)      error "Unsupported OS: $(uname -s)"; exit 1 ;;
    esac

    case "$(uname -m)" in
        x86_64|amd64)  arch="amd64" ;;
        aarch64|arm64) arch="arm64" ;;
        *)             error "Unsupported architecture: $(uname -m)"; exit 1 ;;
    esac

    PLATFORM="${os}"
    ARCH="${arch}"
    info "Detected ${PLATFORM}/${ARCH}"
}

get_latest_version() {
    if ! command -v curl &>/dev/null; then
        error "curl is required"
        exit 1
    fi

    VERSION=$(curl -sI "https://github.com/${REPO}/releases/latest" \
        | grep -i '^location:' \
        | sed 's|.*/tag/||' \
        | tr -d '\r\n')

    if [[ -z "$VERSION" ]]; then
        error "Could not determine latest version"
        exit 1
    fi

    info "Latest version: ${VERSION}"
}

download_and_install() {
    local version_num="${VERSION#v}"
    local archive_name="${BINARY}_${version_num}_${PLATFORM}_${ARCH}"
    local ext="tar.gz"

    if [[ "$PLATFORM" == "macos" ]]; then
        ext="zip"
    fi

    local url="https://github.com/${REPO}/releases/download/${VERSION}/${archive_name}.${ext}"
    local tmpdir
    tmpdir=$(mktemp -d)
    trap 'rm -rf "$tmpdir"' EXIT

    info "Downloading ${url}..."
    if ! curl -fsSL "$url" -o "${tmpdir}/archive.${ext}"; then
        error "Download failed. Check that a release exists for ${PLATFORM}/${ARCH}"
        exit 1
    fi

    info "Extracting..."
    if [[ "$ext" == "zip" ]]; then
        unzip -oq "${tmpdir}/archive.zip" -d "$tmpdir"
    else
        tar -xzf "${tmpdir}/archive.tar.gz" -C "$tmpdir"
    fi

    mkdir -p "$INSTALL_DIR"
    mv "${tmpdir}/${BINARY}" "${INSTALL_DIR}/${BINARY}"
    chmod +x "${INSTALL_DIR}/${BINARY}"
    success "Installed ${BINARY} to ${INSTALL_DIR}/${BINARY}"
}

main() {
    cat <<'ART'

                                                ..
                                                ..
                                               ...
                                              ....
                                             ....
                                            .....
                                           .....
                                         ......
                                      ........
                                    ........
                                 .........
                             ...........       ...
                         ............         ....
                     .............           ....
                 ..............            .....
             ..............              ......
         ..............                .......
      ............                   .......
    .........                     ........
  ........                     .........
 ......                   ...........
......               ............
.....                                      ..
....                                    ....
...                                    ....
..                                 .......
.                            ..........
.               ....................
.            ..................

  Dedalus CLI - dedaluslabs.ai

ART
    detect_platform
    get_latest_version
    download_and_install

    if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
        warning "${INSTALL_DIR} is not in your PATH"
        echo "  Add it to your shell profile:"
        echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
        echo
    fi

    if command -v "$BINARY" &>/dev/null; then
        success "Ready! Run:"
        echo "  dedalus --help"
        echo
    fi
}

main
