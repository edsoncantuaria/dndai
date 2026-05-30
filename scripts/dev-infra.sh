#!/usr/bin/env sh
set -e
cd "$(dirname "$0")/.."

echo "▶ Subindo infraestrutura PENAI (Postgres, Redis, Temporal, Temporal UI, Qdrant)…"
docker compose -f docker-compose.penai.yml --profile penai up -d postgres redis temporal temporal-ui qdrant
docker compose up -d srd-db srd-cache srd-api minio piper 2>/dev/null || \
  docker compose up -d redis qdrant minio piper 2>/dev/null || true

echo "▶ Garantindo namespace Temporal 'penai'…"
if docker compose -f docker-compose.penai.yml --profile penai ps -q temporal 2>/dev/null | grep -q .; then
  docker compose -f docker-compose.penai.yml --profile penai exec -T temporal \
    temporal operator namespace describe --address temporal:7233 --namespace penai >/dev/null 2>&1 \
    || docker compose -f docker-compose.penai.yml --profile penai exec -T temporal \
      temporal operator namespace create --address temporal:7233 --namespace penai \
        --description "PENAI game workflows" \
    || echo "  ⚠ Não foi possível criar namespace penai (Temporal ainda iniciando?)"
fi

echo ""
echo "✓ Infra no ar. Stack completo (recomendado):"
echo "    npm run dev:all         → :9002 + :8071 + worker Temporal (Docker, hot reload)"
echo ""
echo "  Ou só API/frontend na máquina (após dev:infra):"
echo "    npm run dev:penai --prefix backend   → http://localhost:8071"
echo "    npm run worker:temporal --prefix backend"
echo "    npm run dev                          → http://localhost:9002"
echo ""
echo "  Postgres:      localhost:5433"
echo "  Temporal UI:   http://localhost:8233"
echo "  Qdrant:        http://localhost:6335/dashboard"
echo "  MinIO Console: http://localhost:${MINIO_CONSOLE_PORT:-9001}"
echo ""
echo "  backend/.env — DATABASE_URL=postgres://penai:penai_secret@localhost:5433/penai"
echo "  .env.local na raiz (veja .env.local.example)"
echo ""
echo "▶ Migrações + seed mundo (primeira vez ou após pull):"
echo "    npm run penai:db:prepare"
