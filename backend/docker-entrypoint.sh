#!/bin/sh
set -e

if [ "${DB_SYNC}" = "true" ]; then
  echo "[entrypoint] DB_SYNC=true — schema via TypeORM (sem migrações SQL)."
else
  echo "[entrypoint] Aplicando migrações TypeORM..."
  npx tsx src/database/run-migrations.ts
fi

echo "[entrypoint] Spawn pool (cidades iniciais do mapa)..."
if npx tsx src/scripts/ensureSpawnRegions.ts; then
  echo "[entrypoint] Spawn pool OK."
else
  echo "[entrypoint] Aviso: spawn pool não pronto; o servidor tentará importar o mapa padrão na subida."
fi

echo "[entrypoint] Iniciando servidor..."
if [ $# -gt 0 ]; then
  exec "$@"
fi
exec npx tsx src/server.ts
