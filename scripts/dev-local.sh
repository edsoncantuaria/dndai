#!/usr/bin/env sh
# Modo dev local: infra no Docker, backend + frontend na máquina (hot reload).
# Uso: npm run dev:local
set -e
cd "$(dirname "$0")/.."

echo "▶ Modo dev local — parando containers de produção (profile full)…"
for svc in backend frontend narration-worker backend-dev frontend-dev narration-worker-dev; do
  if docker compose ps -q "$svc" 2>/dev/null | grep -q .; then
    docker compose stop "$svc" >/dev/null 2>&1 || true
    docker compose rm -f "$svc" >/dev/null 2>&1 || true
    echo "  ✓ $svc parado"
  fi
done

echo ""
echo "▶ Subindo infraestrutura (MySQL, Redis, SRD, MinIO, Piper, Qdrant)…"
docker compose up -d mysql redis srd-db srd-cache srd-api minio piper qdrant

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  DEV LOCAL — hot reload (sem rebuild Docker a cada save)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Abra mais 2 terminais na raiz do projeto:"
echo ""
echo "    Terminal 2:  npm run dev:backend"
echo "                 → API + WS + worker BullMQ  http://localhost:8071"
echo ""
echo "    Terminal 3:  npm run dev"
echo "                 → Next.js (HMR)             http://localhost:9002"
echo ""
echo "  Env esperado:"
echo "    backend/.env     DB_HOST=localhost  REDIS_URL=redis://localhost:6379"
echo "    .env.local       NEXT_PUBLIC_API_URL=http://localhost:8071/api"
echo "                     NEXT_PUBLIC_WS_URL=ws://localhost:8071/"
echo ""
echo "  NÃO use compose:app / docker:up no dia a dia — são build de produção."
echo "  Alternativa tudo-Docker com watch: npm run dev:docker"
echo ""
echo "  MinIO:  http://localhost:${MINIO_PORT:-9000}  ·  Qdrant: http://localhost:6333/dashboard"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
