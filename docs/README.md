# Documentação — Crônicas de Aventuras

Pasta **enxuta** — quatro documentos vivos + screenshots. Tudo o resto foi arquivado em `archive/` (não editar, não usar em PR).

---

## Para revisão sênior (enviar estes)

| Documento | Linhas ~ | Conteúdo |
|-----------|----------|----------|
| **[VALIDACAO_SENIOR.md](./VALIDACAO_SENIOR.md)** | índice | Checklist, diagrama de contexto, como dar feedback |
| **[ECOSSISTEMA.md](./ECOSSISTEMA.md)** | extenso | Motor, DM, IA/OSS, WS, MySQL, Redis, Qdrant, RAG, P0–P5, schemas, diagramas mermaid |
| **[DESIGN_FRONTEND.md](./DESIGN_FRONTEND.md)** | extenso | WotC-adjacent, tokens, GameplayShell, turn pipeline, homebrew UI |
| **[MOM_DESENVOLVIMENTO.md](./MOM_DESENVOLVIMENTO.md)** | curto | MOM só para dev/docs — não runtime da partida |

Roadmap tático: **`../TODO-ARQUITETURA.md`**

Agentes Cursor: **`.cursor/rules/dndai-documentation-hub.mdc`**

---

## Manutenção

1. Mudou backend/IA/dados → **ECOSSISTEMA.md**
2. Mudou UI/UX → **DESIGN_FRONTEND.md**
3. Decisão arquitetural para agentes → **MOM** + linha no doc vivo
4. Skill: `dndai-documentation`

---

## Arquivo

`archive/` — documentação antiga (ARQUITETURA_*, AI_*, rules/, etc.) substituída em maio/2026.

`ui-screenshots/` — capturas para PRs de UI.
