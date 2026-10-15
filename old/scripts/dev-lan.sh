#!/usr/bin/env sh
# Next.js na LAN (0.0.0.0) + .env.local com IP detectado.
# Backend/worker: rode em outro terminal ou use npm run dev:mobile:lan
set -e
cd "$(dirname "$0")/.."

LAN_IP=$(sh scripts/resolve-lan-ip.sh)
echo "▶ Configurando URLs LAN (${LAN_IP})…"
sh scripts/write-lan-env.sh "$LAN_IP"

echo ""
echo "▶ Next.js em http://${LAN_IP}:9002 (e http://localhost:9002)"
echo "  Certifique-se de que a API está em http://${LAN_IP}:8071"
echo ""

export NEXT_PUBLIC_API_URL="http://${LAN_IP}:8071/api"
export NEXT_PUBLIC_WS_URL="ws://${LAN_IP}:8071/"
export NEXT_PUBLIC_PENAI_UI=true

exec npm run dev
