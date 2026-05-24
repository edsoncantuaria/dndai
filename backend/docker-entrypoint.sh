#!/bin/sh
set -e

if [ "${DB_SYNC}" = "true" ]; then
  echo "[entrypoint] DB_SYNC=true — schema via TypeORM (sem migrações SQL)."
else
  echo "[entrypoint] Aplicando migrações TypeORM..."
  npx tsx src/database/run-migrations.ts
fi

echo "[entrypoint] Iniciando servidor..."
exec npx tsx src/server.ts
