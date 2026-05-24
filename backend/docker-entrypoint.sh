#!/bin/sh
set -e
echo "[entrypoint] Aplicando migrações TypeORM..."
node dist/database/run-migrations.js
echo "[entrypoint] Iniciando servidor..."
exec node dist/server.js
