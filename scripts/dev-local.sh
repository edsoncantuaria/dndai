#!/usr/bin/env sh
# Modo dev local PENAI: infra no Docker, backend + frontend na máquina (hot reload).
# Uso: npm run dev:local  (equivalente a npm run dev:infra + instruções abaixo)
set -e
cd "$(dirname "$0")/.."

echo "▶ Modo dev local PENAI — parando containers de produção (profile full)…"
for svc in backend frontend narration-worker backend-dev frontend-dev narration-worker-dev; do
  if docker compose ps -q "$svc" 2>/dev/null | grep -q .; then
    docker compose stop "$svc" >/dev/null 2>&1 || true
    docker compose rm -f "$svc" >/dev/null 2>&1 || true
    echo "  ✓ $svc parado"
  fi
done

echo ""
echo "▶ Subindo infraestrutura PENAI + SRD + MinIO + Piper…"
docker compose -f docker-compose.penai.yml --profile penai up -d postgres redis temporal qdrant
docker compose up -d srd-db srd-cache srd-api minio piper 2>/dev/null || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  DEV LOCAL PENAI — hot reload (sem rebuild Docker a cada save)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  1. cp backend/.env.penai.example backend/.env"
echo "     (GEMINI_API_KEY no servidor é opcional — jogador informa BYOK na UI)"
echo ""
echo "  2. npm run penai:import:foundry-bundle --prefix backend   # primeira vez"
echo ""
echo "  Abra mais 2 terminais na raiz:"
echo ""
echo "    Terminal 2:  cd backend && npm run dev:penai"
echo "                 → API + WS  http://localhost:8071"
echo ""
echo "    Terminal 3:  cd backend && npm run worker:temporal   # obrigatório para narração/pulso"
echo "                 (só testes: TEMPORAL_DISABLED=true no .env)"
echo ""
echo "    Terminal 4:  npm run dev"
echo "                 → Next.js  http://localhost:9002"
echo ""
echo "  .env.local na raiz:"
echo "    NEXT_PUBLIC_API_URL=http://localhost:8071/api"
echo "    NEXT_PUBLIC_WS_URL=ws://localhost:8071/"
echo "    NEXT_PUBLIC_PENAI_UI=true"
echo ""
echo "  Postgres:5433 · Redis:6381 · Qdrant:6335 · Temporal UI:8233"
echo "  Alternativa tudo-Docker com watch: npm run dev:docker"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
