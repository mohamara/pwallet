#!/usr/bin/env bash
set -euo pipefail

SNIPPET_NAME="pwall.dfmstock.com.caddy"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="${SCRIPT_DIR}/${SNIPPET_NAME}"
TARGET_DIR="${CADDY_SNIPPETS_DIR:-/etc/caddy/Caddyfile.d}"
TARGET="${TARGET_DIR}/${SNIPPET_NAME}"

if [[ ! -f "$SOURCE" ]]; then
  echo "Snippet not found: $SOURCE" >&2
  exit 1
fi

if [[ "$EUID" -ne 0 ]]; then
  echo "Run as root or with sudo:" >&2
  echo "  sudo CADDY_SNIPPETS_DIR=${TARGET_DIR} $0" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
cp "$SOURCE" "$TARGET"
chmod 644 "$TARGET"

echo "Installed: $TARGET"
echo ""
echo "Ensure your main Caddyfile imports snippets, e.g.:"
echo "  import ${TARGET_DIR}/*.caddy"
echo ""
echo "Then validate and reload (do NOT start a second Caddy):"
echo "  caddy validate --config /etc/caddy/Caddyfile"
echo "  systemctl reload caddy"
