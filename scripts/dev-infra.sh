#!/usr/bin/env sh
set -e
cd "$(dirname "$0")/.."

echo "▶ Subindo infraestrutura (MySQL, Redis, SRD)…"
docker compose up -d mysql redis srd-db srd-cache srd-api

echo ""
echo "✓ Infra no ar. Em terminais separados:"
echo "    npm run dev:backend   → http://localhost:8071"
echo "    npm run dev           → http://localhost:9002"
echo ""
echo "  backend/.env com DB_HOST=localhost (veja backend/.env.example)"
echo "  .env.local na raiz (veja .env.local.example)"
