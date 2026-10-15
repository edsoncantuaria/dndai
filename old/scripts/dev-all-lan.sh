#!/usr/bin/env sh
# Stack Docker dev (dev:all) com NEXT_PUBLIC_* na LAN para celular/Expo.
set -e
cd "$(dirname "$0")/.."

LAN_IP=$(sh scripts/resolve-lan-ip.sh)
sh scripts/write-lan-env.sh "$LAN_IP"

export NEXT_PUBLIC_API_URL="http://${LAN_IP}:8071/api"
export NEXT_PUBLIC_WS_URL="ws://${LAN_IP}:8071/"
export NEXT_PUBLIC_PENAI_UI=true

echo "▶ Docker compose dev com URLs LAN (${LAN_IP})…"
COMPOSE="docker compose -p dndai-penai -f docker-compose.penai.yml -f docker-compose.dev.yml"
$COMPOSE --profile penai stop penai-api penai-temporal-worker 2>/dev/null || true
$COMPOSE --profile penai --profile dev up -d \
  postgres redis temporal temporal-ui qdrant \
  backend-dev temporal-worker-dev frontend-dev

echo ""
echo "  App (LAN):  http://${LAN_IP}:9002"
echo "  API:        http://${LAN_IP}:8071"
echo "  Expo:       npm run dev:mobile:lan -- --expo-only"
echo ""
exec $COMPOSE --profile penai --profile dev logs -f backend-dev frontend-dev temporal-worker-dev
