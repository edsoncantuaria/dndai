#!/usr/bin/env sh
# Sincroniza contexto dev (MOM + docs agentes) entre PCs via git.
#
#   npm run context:sync -- pull          # no PC de destino
#   npm run context:sync -- push          # envia commits já feitos
#   npm run context:sync -- push --commit # commita mom/context (+ docs) e envia tudo
#   npm run context:sync -- status        # o que falta commitar/pushar
#
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOM="$ROOT/mom"
REMOTE="${CONTEXT_SYNC_REMOTE:-origin}"

die() { echo "✗ $*" >&2; exit 1; }
info() { echo "▶ $*"; }
ok() { echo "  ✓ $*"; }

require_git() {
  command -v git >/dev/null 2>&1 || die "git não encontrado"
  [ -d "$ROOT/.git" ] || die "Execute na raiz do repo dndai"
  [ -d "$MOM/.git" ] || die "Pasta mom/ não é um clone git — rode: git clone ... && cd mom"
}

mom_branch() {
  git -C "$MOM" branch --show-current 2>/dev/null || echo main
}

root_branch() {
  git -C "$ROOT" branch --show-current 2>/dev/null || echo main
}

has_remote() {
  git -C "$1" remote get-url "$REMOTE" >/dev/null 2>&1
}

context_dirty_in_mom() {
  git -C "$MOM" status --porcelain -- context/ README.md 2>/dev/null | grep -q .
}

context_dirty_in_root() {
  git -C "$ROOT" status --porcelain -- \
    mom docs/ Makefile package.json \
    scripts/context-sync.sh scripts/context-sync-commit-msg.mjs \
    .cursor/prompts/mom-maintain-context.md \
    .cursor/prompts/context-sync-commit-msg.md \
    .cursor/rules/dndai-mom-context.mdc \
    .cursor/rules/dndai-documentation-architect.mdc \
    .cursor/rules/dndai-documentation-hub.mdc \
    .cursor/skills/dndai-mom-context/ \
    .gitmodules 2>/dev/null | grep -q .
}

ahead_behind() {
  # stdout: "behind ahead" (upstream...HEAD)
  git -C "$1" rev-list --left-right --count "${2}...HEAD" 2>/dev/null | awk '{print $1, $2}' || echo "0 0"
}

cmd_status() {
  require_git
  info "MOM ($(mom_branch)) — $MOM"
  if context_dirty_in_mom; then
    echo "  ⚠ uncommitted: mom/context/ (ou README)"
    git -C "$MOM" status --short -- context/ README.md 2>/dev/null | sed 's/^/    /'
  else
    ok "mom/context limpo"
  fi
  MB="$(mom_branch)"
  if has_remote "$MOM"; then
    git -C "$MOM" fetch "$REMOTE" "$MB" --quiet 2>/dev/null || true
    AB="$(ahead_behind "$MOM" "$REMOTE/$MB")"
    echo "  vs $REMOTE/$MB: behind $(echo "$AB" | awk '{print $1}') · ahead $(echo "$AB" | awk '{print $2}')"
  fi

  echo ""
  info "dndai ($(root_branch)) — $ROOT"
  if context_dirty_in_root; then
    echo "  ⚠ uncommitted: docs / .cursor MOM / ponteiro mom"
    git -C "$ROOT" status --short -- mom docs/ .cursor/prompts/ .cursor/rules/dndai-mom-context.mdc \
      .cursor/rules/dndai-documentation-architect.mdc .cursor/skills/dndai-mom-context/ .gitmodules 2>/dev/null | sed 's/^/    /'
  else
    ok "docs/MOM cursor limpos"
  fi
  RB="$(root_branch)"
  if has_remote "$ROOT"; then
    git -C "$ROOT" fetch "$REMOTE" "$RB" --quiet 2>/dev/null || true
    AB="$(ahead_behind "$ROOT" "$REMOTE/$RB")"
    echo "  vs $REMOTE/$RB: behind $(echo "$AB" | awk '{print $1}') · ahead $(echo "$AB" | awk '{print $2}')"
  fi

  echo ""
  echo "  Sair do PC:  make sair-pc"
  echo "  Chegar PC:   make chegar-pc"
}

commit_context() {
  MSG="$1"
  if [ -z "$MSG" ]; then
    info "Gerando mensagem de commit (agente) …"
    if ! MSG="$(node "$ROOT/scripts/context-sync-commit-msg.mjs" 2>/dev/null)"; then
      MSG=""
    fi
    if [ -z "$MSG" ]; then
      MSG="distill: contexto MOM $(date -u +%Y-%m-%dT%H:%MZ)"
    fi
    echo "  → $MSG"
  fi

  if context_dirty_in_mom; then
    info "Commit em mom/ …"
    git -C "$MOM" add context/ README.md
    git -C "$MOM" commit -m "$MSG"
    ok "mom commit"
  fi

  if context_dirty_in_root; then
    info "Commit em dndai (docs + ponteiro mom) …"
    git -C "$ROOT" add mom docs/ Makefile package.json \
      scripts/context-sync.sh scripts/context-sync-commit-msg.mjs \
      .cursor/prompts/mom-maintain-context.md \
      .cursor/prompts/context-sync-commit-msg.md \
      .cursor/rules/dndai-mom-context.mdc \
      .cursor/rules/dndai-documentation-architect.mdc \
      .cursor/rules/dndai-documentation-hub.mdc \
      .cursor/skills/dndai-mom-context/ \
      .gitmodules 2>/dev/null || true
    git -C "$ROOT" commit -m "$MSG"
    ok "dndai commit"
  fi

  if ! context_dirty_in_mom && ! context_dirty_in_root; then
    ok "Nada para commitar (contexto já limpo)"
  fi
}

cmd_push() {
  DO_COMMIT=0
  COMMIT_MSG=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --commit)
        DO_COMMIT=1
        if [ -n "${2:-}" ] && [ "${2#-}" = "$2" ]; then
          COMMIT_MSG="$2"
          shift
        fi
        ;;
      *) die "Opção desconhecida: $1" ;;
    esac
    shift
  done

  require_git
  has_remote "$MOM" || die "Remote $REMOTE não configurado em mom/"
  has_remote "$ROOT" || die "Remote $REMOTE não configurado em dndai"

  if [ "$DO_COMMIT" = 1 ]; then
    commit_context "$COMMIT_MSG"
  elif context_dirty_in_mom || context_dirty_in_root; then
    die "Há alterações locais. Use: npm run context:sync -- push --commit \"distill: …\""
  fi

  MB="$(mom_branch)"
  info "Push mom → $REMOTE/$MB"
  git -C "$MOM" push "$REMOTE" "$MB"
  ok "mom pushed"

  RB="$(root_branch)"
  info "Push dndai → $REMOTE/$RB"
  git -C "$ROOT" push "$REMOTE" "$RB"
  ok "dndai pushed"

  echo ""
  ok "Contexto no remoto. No outro PC: npm run context:sync -- pull"
}

cmd_pull() {
  require_git
  has_remote "$MOM" || die "Remote $REMOTE não configurado em mom/"
  has_remote "$ROOT" || die "Remote $REMOTE não configurado em dndai"

  RB="$(root_branch)"
  info "Pull dndai ← $REMOTE/$RB"
  git -C "$ROOT" pull "$REMOTE" "$RB" --rebase
  ok "dndai pulled"

  if [ -f "$ROOT/.gitmodules" ]; then
    info "Atualizar submodule mom …"
    git -C "$ROOT" submodule sync --recursive 2>/dev/null || true
    git -C "$ROOT" submodule update --init --recursive mom
    ok "submodule mom"
  fi

  MB="$(mom_branch)"
  info "Pull mom ← $REMOTE/$MB"
  git -C "$MOM" pull "$REMOTE" "$MB" --rebase
  ok "mom pulled"

  echo ""
  ok "Contexto local atualizado. Recall: mom/context/INDEX.md"
}

usage() {
  cat <<'EOF'
Uso: npm run context:sync -- <comando> [opções]

Comandos:
  pull              Baixa dndai + mom do remoto (outro PC → este)
  push              Envia commits já feitos (este PC → remoto)
  push --commit     Commita mom/context (+ docs) e envia (mensagem via agente se omitida)
  push --commit "msg"  Commita com mensagem explícita
  status            Mostra dirty / ahead / behind

Variável: CONTEXT_SYNC_REMOTE=origin (default)

Fluxo habitual:
  PC A (saindo):   make sair-pc   (ou: npm run context:sync -- push --commit)
  PC B (chegando): make chegar-pc
EOF
}

CMD="${1:-}"
shift || true

case "$CMD" in
  pull) cmd_pull "$@" ;;
  push) cmd_push "$@" ;;
  status) cmd_status "$@" ;;
  ""|-h|--help|help) usage ;;
  *) die "Comando inválido: $CMD (use --help)" ;;
esac
