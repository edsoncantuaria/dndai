#!/usr/bin/env bash
# Servidor (typecheck + testes) e cliente Godot (scripts, geometria dos dados, telas de 48 personagens, inclusive subida de nível pelo formulário).
set -euo pipefail
cd "$(dirname "$0")/.."
GODOT="${GODOT:-/home/edson/Game/Godot/Godot_v4.7.2-stable_linux.x86_64}"

echo "== servidor =="
(cd server && npx tsc --noEmit && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)|magias:|ações de")

echo "== cliente Godot =="
"$GODOT" --headless --path game --import >/dev/null 2>&1 || true
"$GODOT" --headless --path game res://tests/load_all.tscn 2>&1 | grep -E "falhas|ERROR|FALHA" || true
"$GODOT" --headless --path game res://tests/test_dice_geom.tscn 2>&1 | grep -E "dados:|FALHA"

echo "== telas e subida de nível (servidor temporário) =="
TMP="$(mktemp -d)"; PORT=18791
trap 'kill "$SRV" 2>/dev/null || true; rm -rf "$TMP"' EXIT
(cd server && DNDAI_HOME="$TMP" node --no-warnings scripts/seed-test.ts)
(cd server && DNDAI_HOME="$TMP" DNDAI_FAKE_MESTRE=1 node --no-warnings src/main.ts serve --port "$PORT" --connector-port 18795 >"$TMP/server.log" 2>&1) &
SRV=$!
for _ in $(seq 1 40); do curl -sf "localhost:$PORT/api/health" >/dev/null && break; sleep 0.25; done
fail=0
for dir in "$TMP"/*/; do
  slug="$(basename "$dir")"
  out="$(DNDAI_URL="http://127.0.0.1:$PORT" timeout 60 "$GODOT" --headless --path game -- --slug="$slug" --drawers=all --levelup-auto 2>&1 || true)"
  if echo "$out" | grep -qE "SCRIPT ERROR|ERROR:|Invalid|Nonexistent|\[levelup\] erro" || ! echo "$out" | grep -qE "\[drawers\] ok|\[levelup\] ok"; then
    echo "FALHA em $slug"; echo "$out" | grep -E "ERROR|Invalid|Nonexistent|drawers" | head -5; fail=1
  fi
done
[ "$fail" = 0 ] && echo "telas ok: $(ls -d "$TMP"/*/ | wc -l) personagens"
exit "$fail"
