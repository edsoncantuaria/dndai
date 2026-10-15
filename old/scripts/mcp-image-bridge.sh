#!/usr/bin/env bash
set -euo pipefail

INSTALL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Permite instalar o código em outro path via env
export IMAGE_BRIDGE_INSTALL="${IMAGE_BRIDGE_INSTALL:-$INSTALL_ROOT}"

# shellcheck source=scripts/lib-image-bridge-env.sh
source "$INSTALL_ROOT/scripts/lib-image-bridge-env.sh"
load_image_bridge_env

export IMAGE_BRIDGE_URL="${IMAGE_BRIDGE_URL:-https://wbhk.cloudive.com.br}"
export IMAGE_BRIDGE_SECRET="${IMAGE_BRIDGE_SECRET:-}"

MCP_DIR="$IMAGE_BRIDGE_INSTALL/packages/image-bridge-mcp"
if [[ ! -d "$MCP_DIR/node_modules/@modelcontextprotocol/sdk" ]]; then
  npm install --prefix "$MCP_DIR" --no-fund --no-audit
fi

exec node "$MCP_DIR/index.mjs"
