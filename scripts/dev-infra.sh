#!/usr/bin/env sh
set -e
cd "$(dirname "$0")/.."

echo "▶ Subindo infraestrutura (MySQL, Redis, SRD, MinIO, Piper, Qdrant)…"
docker compose up -d mysql redis srd-db srd-cache srd-api minio piper qdrant

echo ""
echo "✓ Infra no ar. Em terminais separados:"
echo "    npm run dev:backend   → http://localhost:8071"
echo "    npm run dev           → http://localhost:9002"
echo ""
echo "  MinIO API:     http://localhost:${MINIO_PORT:-9000}"
echo "  MinIO Console: http://localhost:${MINIO_CONSOLE_PORT:-9001}"
echo "  Piper TTS:     http://localhost:${PIPER_HTTP_PORT:-5500}/health"
echo "  Qdrant:        http://localhost:6333/dashboard"
echo ""
echo "  Narração: BullMQ no Redis (worker sobe com npm run dev:backend)"
echo ""
echo "  backend/.env com DB_HOST=localhost + MinIO/Piper (veja backend/.env.example)"
echo "  .env.local na raiz (veja .env.local.example)"
