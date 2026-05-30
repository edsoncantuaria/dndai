#!/usr/bin/env sh
# Seed canônico: 20 NPCs por região, uma região por vez (respeita cota Gemini).
set -e
cd "$(dirname "$0")/.."

export DATABASE_URL="${DATABASE_URL:-postgres://penai:penai_secret@localhost:5433/penai}"
export QDRANT_URL="${QDRANT_URL:-http://localhost:6335}"
export QDRANT_ENABLED="${QDRANT_ENABLED:-true}"
export PENAI_SEED_REGION_DELAY_MS="${PENAI_SEED_REGION_DELAY_MS:-8000}"

COUNT="${1:-20}"
LOG_DIR="logs"
mkdir -p "$LOG_DIR"
MASTER_LOG="$LOG_DIR/penai-seed-all-regions-$(date +%Y%m%d-%H%M%S).log"

REGIONS=$(npm run penai:seed:canon-npcs -- --list-regions 2>/dev/null | node -e "
let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{
  const j=JSON.parse(s); console.log((j.regions||[]).join('\n'));
});")

echo "▶ Seed $COUNT NPCs/região — log: $MASTER_LOG" | tee -a "$MASTER_LOG"
n=0
total=$(echo "$REGIONS" | wc -l)
for slug in $REGIONS; do
  n=$((n + 1))
  echo "" | tee -a "$MASTER_LOG"
  echo "━━━━━━━━ [$n/$total] $slug ━━━━━━━━" | tee -a "$MASTER_LOG"
  if npm run penai:seed:canon-npcs -- --region "$slug" --count "$COUNT" 2>&1 | tee -a "$MASTER_LOG"; then
    echo "✓ $slug OK" | tee -a "$MASTER_LOG"
  else
    echo "✖ $slug falhou — veja log" | tee -a "$MASTER_LOG"
  fi
  if [ "$n" -lt "$total" ]; then
    echo "⏳ ${PENAI_SEED_REGION_DELAY_MS}ms…" | tee -a "$MASTER_LOG"
    sleep "$(echo "$PENAI_SEED_REGION_DELAY_MS / 1000" | bc 2>/dev/null || echo 8)"
  fi
done
echo "▶ Concluído. Log: $MASTER_LOG"
