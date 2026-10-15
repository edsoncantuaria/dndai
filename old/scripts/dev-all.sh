#!/usr/bin/env sh
# Sobe stack PENAI completo: infra + API + frontend + worker Temporal (hot reload).
# Uso: npm run dev:all   |   npm run dev:all -- --detach   (só sobe, sem seguir logs)
set -e
cd "$(dirname "$0")/.."

COMPOSE="docker compose -p dndai-penai -f docker-compose.penai.yml -f docker-compose.dev.yml"
DETACH=false
for arg in "$@"; do
  case "$arg" in
    --detach|-d) DETACH=true ;;
  esac
done

# Evita que variáveis de produção no shell/.env afetem o frontend-dev (NEXT_PUBLIC_*).
export NEXT_PUBLIC_API_URL=http://localhost:8071/api
export NEXT_PUBLIC_WS_URL=ws://localhost:8071/
export NEXT_PUBLIC_PENAI_UI=true

echo "▶ Parando serviços PENAI sem hot reload (evita fila/porta duplicada)…"
$COMPOSE --profile penai stop penai-api penai-temporal-worker 2>/dev/null || true

echo "▶ Subindo infra + backend-dev + frontend-dev + temporal-worker-dev…"
$COMPOSE --profile penai --profile dev up -d \
  postgres redis temporal temporal-ui qdrant \
  backend-dev temporal-worker-dev frontend-dev

echo "▶ Namespace Temporal 'penai'…"
if $COMPOSE --profile penai ps -q temporal 2>/dev/null | grep -q .; then
  $COMPOSE --profile penai exec -T temporal \
    temporal operator namespace describe --address temporal:7233 --namespace penai >/dev/null 2>&1 \
    || $COMPOSE --profile penai exec -T temporal \
      temporal operator namespace create --address temporal:7233 --namespace penai \
        --description "PENAI game workflows" \
    || echo "  ⚠ Namespace penai (Temporal ainda iniciando?)"
fi

wait_port() {
  host=$1
  port=$2
  label=$3
  i=0
  while [ "$i" -lt 90 ]; do
    if wget -q -O /dev/null "http://${host}:${port}/" 2>/dev/null \
      || wget -q -O /dev/null "http://${host}:${port}/api/v2/health" 2>/dev/null; then
      echo "  ✓ $label (${host}:${port})"
      return 0
    fi
    i=$((i + 1))
    sleep 2
  done
  echo "  ⚠ $label ainda não respondeu em ${host}:${port} — veja: npm run dev:all:logs"
  return 1
}

echo "▶ Aguardando app…"
wait_port 127.0.0.1 8071 "API PENAI" || true
wait_port 127.0.0.1 9002 "Frontend Next.js" || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Stack PENAI no ar"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  App:          http://localhost:9002"
echo "  API / WS:     http://localhost:8071  ·  ws://localhost:8071/"
echo "  Temporal UI:  http://localhost:8233"
echo "  Postgres:     localhost:5433"
echo "  Redis:        localhost:6381"
echo "  Qdrant:       http://localhost:6335/dashboard"
echo ""
echo "  .env.local (raiz): NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL, NEXT_PUBLIC_PENAI_UI=true"
echo "  Parar: npm run dev:all:down"
echo "  Logs:  npm run dev:all:logs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$DETACH" = true ]; then
  exit 0
fi

echo ""
echo "▶ Seguindo logs (Ctrl+C não derruba os containers)…"
exec $COMPOSE --profile penai --profile dev logs -f backend-dev frontend-dev temporal-worker-dev
