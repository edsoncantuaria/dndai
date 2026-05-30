#!/bin/sh
set -e

WORKER_MODE=false
for arg in "$@"; do
  case "$arg" in
    *temporalWorkerMain*) WORKER_MODE=true ;;
  esac
done

if [ "$WORKER_MODE" = "true" ]; then
  echo "[entrypoint] Modo temporal-worker — iniciando worker PENAI."
  exec "$@"
fi

if [ "${PENAI_SEED_ON_BOOT}" = "true" ]; then
  echo "[entrypoint] PENAI_SEED_ON_BOOT=true — seed mundo + bundle srd-ptbr-core via initPenaiDatabase."
fi

echo "[entrypoint] Iniciando servidor PENAI..."
if [ $# -gt 0 ]; then
  exec "$@"
fi
exec npx tsx src/penaiServer.ts
