---
name: dndai-mom-context
description: >-
  Recall e distill de contexto em mom/context para agentes Cursor.
  Use no início/fim de sessões, após bugs sistêmicos, decisões de dev ou
  quando o usuário pedir manter contexto no MOM.
---

# MOM — contexto de desenvolvimento

## Quando usar

- **Início** de tarefa não trivial (WS, IA, fila, auth, dev stack).
- **Fim** de tarefa com decisão, fix raiz ou convenção nova.
- Usuário pede "manter no MOM" / "contexto persistente".

## Recall (ler)

1. `mom/context/INDEX.md`
2. Arquivos `mom/context/*.md` com `Status: active` e tags da área
3. MCP `mom_recall` se configurado em `.cursor/mcp.json`
4. Trecho canônico em `docs/ECOSSISTEMA.md` ou `DESIGN_FRONTEND.md`

## Distill (escrever)

Arquivo: `mom/context/<area>-<slug>.md`

Campos: título, status, data, doc link, por quê, o quê, armadilhas, comandos.

Atualizar `mom/context/INDEX.md`.

## Não fazer

- Secrets, `.env`, tokens
- Copiar ECOSSISTEMA inteiro
- MOM no hot path do jogo (servidor de partida)

## Prompts prontos

`.cursor/prompts/mom-maintain-context.md`

## Rule

`.cursor/rules/dndai-mom-context.mdc`
