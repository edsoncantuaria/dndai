#!/usr/bin/env sh
# Dev completo para celular/Expo Go na mesma Wi‑Fi: infra (opcional), API, worker, Next LAN, Expo --lan.
# Uso: npm run dev:mobile:lan
#      npm run dev:mobile:lan -- --expo-only   (só Expo; API/Next já rodando)
#      npm run dev:mobile:lan -- --no-worker
set -e
cd "$(dirname "$0")/.."

EXPO_ONLY=false
NO_WORKER=false
SKIP_INFRA=false
for arg in "$@"; do
  case "$arg" in
    --expo-only) EXPO_ONLY=true ;;
    --no-worker) NO_WORKER=true ;;
    --skip-infra) SKIP_INFRA=true ;;
  esac
done

LAN_IP=$(sh scripts/resolve-lan-ip.sh)
echo "▶ IP LAN: ${LAN_IP}"
sh scripts/write-lan-env.sh "$LAN_IP"

export NEXT_PUBLIC_API_URL="http://${LAN_IP}:8071/api"
export NEXT_PUBLIC_WS_URL="ws://${LAN_IP}:8071/"
export NEXT_PUBLIC_PENAI_UI=true
export EXPO_PUBLIC_WEB_APP_URL="http://${LAN_IP}:9002"
export EXPO_PUBLIC_API_URL="http://${LAN_IP}:8071/api"

port_open() {
  _port=$1
  if command -v ss >/dev/null 2>&1; then
    ss -tln 2>/dev/null | grep -q ":${_port} "
    return $?
  fi
  wget -q -O /dev/null "http://127.0.0.1:${_port}/" 2>/dev/null \
    || wget -q -O /dev/null "http://127.0.0.1:${_port}/api/v2/health" 2>/dev/null
}

PIDS=""
cleanup() {
  if [ -n "$PIDS" ]; then
    echo ""
    echo "▶ Encerrando processos do dev:mobile:lan…"
    for pid in $PIDS; do
      kill "$pid" 2>/dev/null || true
    done
  fi
}
trap cleanup EXIT INT TERM

if [ "$EXPO_ONLY" = false ]; then
  if [ "$SKIP_INFRA" = false ] && ! port_open 8071; then
    if ! port_open 5433; then
      echo "▶ Infra PENAI (Postgres/Redis/…) — primeira vez pode demorar…"
      docker compose -f docker-compose.penai.yml --profile penai up -d postgres redis temporal qdrant 2>/dev/null \
        || echo "  ⚠ Docker indisponível — suba a infra manualmente: npm run dev:infra"
    fi
  fi

  if ! port_open 8071; then
    echo "▶ Backend PENAI (tsx watch)…"
    (cd backend && npm run dev:penai) &
    PIDS="$PIDS $!"
    sleep 2
  else
    echo "  ✓ API já em :8071"
  fi

  if [ "$NO_WORKER" = false ] && ! pgrep -f "temporalWorkerMain" >/dev/null 2>&1; then
    echo "▶ Worker Temporal (narração/pulso)…"
    (cd backend && npm run worker:temporal) &
    PIDS="$PIDS $!"
  elif [ "$NO_WORKER" = true ]; then
    echo "  ⚠ Worker omitido (--no-worker) — narração assíncrona pode não rodar"
  else
    echo "  ✓ Worker Temporal já ativo"
  fi

  if ! port_open 9002; then
    echo "▶ Next.js (0.0.0.0:9002)…"
    (NEXT_DIST_DIR=.next-dev npx next dev -H 0.0.0.0 -p 9002) &
    PIDS="$PIDS $!"
    _i=0
    while [ "$_i" -lt 45 ]; do
      if port_open 9002; then break; fi
      _i=$((_i + 1))
      sleep 2
    done
  else
    echo "  ✓ Next já em :9002 (reinicie com dev:lan se NEXT_PUBLIC_* ainda apontam para localhost)"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MOBILE LAN — WebView = mesmo jogo da web"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Browser / WebView:  http://${LAN_IP}:9002"
echo "  API / WebSocket:    http://${LAN_IP}:8071"
echo "  Expo Go: escaneie o QR (--lan) na mesma rede Wi‑Fi"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd apps/mobile
exec npx expo start --lan
