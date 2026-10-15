#!/usr/bin/env bash
# Servidor (typecheck + testes) e cliente Godot (scripts carregam, geometria dos dados).
set -euo pipefail
cd "$(dirname "$0")/.."
GODOT="${GODOT:-/home/edson/Game/Godot/Godot_v4.7.2-stable_linux.x86_64}"

echo "== servidor =="
(cd server && npx tsc --noEmit && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)")

echo "== cliente Godot =="
"$GODOT" --headless --path game --import >/dev/null 2>&1 || true
"$GODOT" --headless --path game res://tests/load_all.tscn 2>&1 | grep -E "falhas|ERROR|FALHA" || true
"$GODOT" --headless --path game res://tests/test_dice_geom.tscn 2>&1 | grep -E "dados:|FALHA"
