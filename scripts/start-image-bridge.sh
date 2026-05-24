#!/usr/bin/env bash
set -euo pipefail

INSTALL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export IMAGE_BRIDGE_INSTALL="${IMAGE_BRIDGE_INSTALL:-$INSTALL_ROOT}"

# shellcheck source=scripts/lib-image-bridge-env.sh
source "$INSTALL_ROOT/scripts/lib-image-bridge-env.sh"
load_image_bridge_env

export IMAGE_BRIDGE_PORT="${IMAGE_BRIDGE_PORT:-8881}"
export IMAGE_BRIDGE_PUBLIC_URL="${IMAGE_BRIDGE_PUBLIC_URL:-https://wbhk.cloudive.com.br}"

exec node "$IMAGE_BRIDGE_INSTALL/services/image-bridge/server.mjs"
