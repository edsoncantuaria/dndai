#!/usr/bin/env sh
set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "⚠ Crie .env (ex.: cp .env.cloudive.example .env) e ajuste JWT_SECRET / GEMINI_API_KEY."
  exit 1
fi

echo "▶ Build e subida — perfil full + Cloudive (9011 API, 9012 app)…"
docker compose -f docker-compose.yml -f docker-compose.cloudive.yml --profile full up -d --build

echo ""
echo "✓ Stack no ar (origem para o tunnel):"
echo "    API:  http://127.0.0.1:9011/api/health"
echo "    App:  http://127.0.0.1:9012"
echo ""
echo "  Cloudflare:"
echo "    api-rpg.cloudive.com.br → http://localhost:9011"
echo "    dnd.cloudive.com.br     → http://localhost:9012"
echo ""
docker compose -f docker-compose.yml -f docker-compose.cloudive.yml --profile full ps
