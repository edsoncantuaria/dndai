# Agentes e skills — Crônicas de Aventuras

Roteamento para implementar `TODO-ARQUITETURA.md` com Cursor (Agent, subagentes, skills).

## Regra geral

1. Leia `TODO-ARQUITETURA.md` e escolha **um** ID (ex.: P0.2.2).
2. Carregue a **skill** da coluna “Skill” (pasta `.cursor/skills/<nome>/SKILL.md`).
3. Leia `docs/ARQUITETURA_JOGO_COMPLETA.md` ou `docs/ARQUITETURA_IA_COMPLETA.md` só se a skill mandar.
4. PR pequena; `npm run test --prefix backend` antes de marcar ✅.

## Subagentes recomendados

| Tarefa | `subagent_type` | `description` exemplo |
|--------|-----------------|------------------------|
| Explorar WS/motor/combate | `explore` | "Mapear submitRollResult e resolveStructuredRoll" |
| Refator extrair pipeline | `generalPurpose` | "Extrair processAction para action-pipeline/" |
| Rodar testes / simulator | `shell` | "Rodar backend tests e session-simulator" |
| Revisar após P0 | `code-reviewer` | "Review mechanical split vs TODO P0.2" |

## Dispatch por área (copiar como prompt)

### Desacoplamento mecânico × narrativo

```
Implementar item TODO-ARQUITETURA P0.2.x.
Use a skill dndai-mechanical-narrative-split.
Invariantes: motor autoritativo; narration_only; não quebrar contractVersion WS.
Entregar: backend + frontend mínimo + env flag.
```

### JSON minimalista LLM

```
Implementar item TODO-ARQUITETURA P0.3.x.
Use a skill dndai-minimal-llm-json.
Schema minimalista OSS é o padrão; não reintroduzir flags de ativação.
```

### Combate FSM

```
Implementar item TODO-ARQUITETURA P0.4.x.
Use a skill dndai-combat-fsm.
Não deixar IA alterar HP; FSM guia roll chain.
```

### Event log

```
Implementar item TODO-ARQUITETURA P0.1.x.
Use a skill dndai-event-log.
Append-only; correlacionar actionId + stateVersion.
```

### Refator pipeline WS

```
Implementar item TODO-ARQUITETURA P0.5.x.
Use a skill dndai-action-pipeline-refactor.
Comportamento idêntico; só mover código; testes WS verdes.
```

### Simulador de sessão

```
Implementar item TODO-ARQUITETURA P1.1.
Use a skill dndai-session-simulator.
Script Node que dispara processAction/submitRollResult em loop.
```

## Paralelismo seguro

Podem rodar **em paralelo** (branches diferentes):

- P0.3 (minimal JSON) — pasta `ai-oss/`
- P0.4 (combat FSM) — pasta `rules/` + `combatMotorService`
- P0.1 (event log) — pasta `events/`
- F.1 (frontend FSM) — `src/hooks/`

Evitar paralelo na **mesma** PR:

- `webSocketServer.ts` + `useGameWebSocket.ts` (coordenar P0.2)

## Modelos

- Implementação: agente padrão ou `composer-2.5-fast` para diffs grandes.
- Revisão: `code-reviewer` após cada bloco P0 completo.
