# shellcheck shell=bash
# Config global do Image Bridge (Cursor), não do projeto aberto.
load_image_bridge_env() {
  local bridge_env="${HOME}/.cursor/image-bridge.env"
  if [[ -f "$bridge_env" ]]; then
    # shellcheck disable=SC1090
    set -a && source "$bridge_env" && set +a
  fi
}
