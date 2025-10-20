#!/usr/bin/env bash
# Wrapper to run node with local registry/lib loader if available

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REGISTRY_PATH="$ROOT_DIR/../socket-registry/registry/dist"
LIB_PATH="$ROOT_DIR/../socket-lib/dist"

if [ -d "$REGISTRY_PATH" ] || [ -d "$LIB_PATH" ]; then
  exec node --import "$SCRIPT_DIR/register-loader.mjs" "$@"
else
  exec node "$@"
fi
