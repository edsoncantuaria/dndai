#!/usr/bin/env sh
# Limpa Postgres PENAI, Redis e coleções Qdrant do stack local.
set -e
cd "$(dirname "$0")/.."

PG_CONTAINER="${PENAI_PG_CONTAINER:-dndai-penai-postgres-1}"
REDIS_CONTAINER="${PENAI_REDIS_CONTAINER:-dndai-penai-redis-1}"
QDRANT_URL="${QDRANT_URL:-http://localhost:6335}"

echo "▶ Postgres ($PG_CONTAINER): DROP SCHEMA public…"
docker exec "$PG_CONTAINER" psql -U penai -d penai -v ON_ERROR_STOP=1 -c "
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO penai;
GRANT ALL ON SCHEMA public TO public;
"

echo "▶ Redis ($REDIS_CONTAINER): FLUSHALL…"
docker exec "$REDIS_CONTAINER" redis-cli FLUSHALL

echo "▶ Qdrant ($QDRANT_URL): coleções PENAI…"
for c in penai_session_memories penai_world_memories penai_npc_profiles; do
  curl -s -X DELETE "$QDRANT_URL/collections/$c" >/dev/null || true
done

echo "✓ Bancos limpos. Rode: npm run penai:db:prepare"
