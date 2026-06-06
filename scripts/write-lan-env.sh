#!/usr/bin/env sh
# Gera .env.local (Next) e apps/mobile/.env com o IP da LAN.
# Uso: sh scripts/write-lan-env.sh [IP]
set -e
cd "$(dirname "$0")/.."

LAN_IP="${1:-}"
if [ -z "$LAN_IP" ]; then
  LAN_IP=$(sh scripts/resolve-lan-ip.sh)
fi

API_URL="http://${LAN_IP}:8071/api"
WS_URL="ws://${LAN_IP}:8071/"
WEB_URL="http://${LAN_IP}:9002"

cat > .env.local <<EOF
# Gerado por scripts/write-lan-env.sh — dev LAN / Expo Go
NEXT_PUBLIC_API_URL=${API_URL}
NEXT_PUBLIC_WS_URL=${WS_URL}
NEXT_PUBLIC_PENAI_UI=true
EOF

mkdir -p apps/mobile
cat > apps/mobile/.env <<EOF
# Gerado por scripts/write-lan-env.sh
EXPO_PUBLIC_WEB_APP_URL=${WEB_URL}
EXPO_PUBLIC_API_URL=${API_URL}
EOF

echo "  ✓ .env.local (Next)"
echo "  ✓ apps/mobile/.env (Expo)"
echo ""
echo "  Web:  ${WEB_URL}"
echo "  API:  ${API_URL}"
echo "  WS:   ${WS_URL}"
