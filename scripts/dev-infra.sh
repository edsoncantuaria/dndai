#!/usr/bin/env sh
set -e
cd "$(dirname "$0")/.."

echo "▶ Subindo infraestrutura PENAI (Postgres, Redis, Temporal, Qdrant, SRD, MinIO, Piper)…"
docker compose -f docker-compose.penai.yml --profile penai up -d postgres redis temporal qdrant
docker compose up -d srd-db srd-cache srd-api minio piper 2>/dev/null || \
  docker compose up -d redis qdrant minio piper 2>/dev/null || true

echo ""
echo "✓ Infra no ar. Em terminais separados:"
echo "    npm run dev:penai       → http://localhost:8071 (Fastify PENAI)"
echo "    npm run worker:temporal → narração Temporal"
echo "    npm run dev             → http://localhost:9002"
echo ""
echo "  Postgres:      localhost:5433"
echo "  Temporal UI:   http://localhost:8233"
echo "  Qdrant:        http://localhost:6335/dashboard"
echo "  MinIO Console: http://localhost:${MINIO_CONSOLE_PORT:-9001}"
echo ""
echo "  backend/.env — DATABASE_URL=postgres://penai:penai_secret@localhost:5433/penai"
echo "  .env.local na raiz (veja .env.local.example)"
