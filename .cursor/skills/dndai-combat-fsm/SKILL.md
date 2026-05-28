---
name: dndai-combat-fsm
description: >-
  Implementa máquina de estados de combate determinística no dndai. Use for
  TODO-ARQUITETURA P0.4, combat phases, chain rolls, ou IA contradizendo HP.
---

# Combate — state machine

## Fases propostas

```
IDLE → ENCOUNTER_ACTIVE → ROUND_START → TURN_START
  → ACTION_DECLARED → ROLL_PENDING → RESOLVING_DAMAGE
  → AWAITING_NARRATION → TURN_END → (ROUND_START | ENCOUNTER_END)
```

## Regras

- Transições só via motor (`resolveStructuredRoll`, `combatMotorService`).
- IA **só** entra em `AWAITING_NARRATION`; recebe hints de outcome já resolvido.
- `nextRollRequest` (dano após hit) → volta a `ROLL_PENDING` **sem** narrar no meio.

## Arquivos

| Área | Caminho |
|------|---------|
| Motor combate | `backend/src/services/combatMotorService.ts` |
| Resolução roll | `backend/src/services/ruleResolutionService.ts` |
| Entidade | `backend/src/entities/CombatEncounter.ts` |
| Schema público | `backend/src/schemas/gameSchemas.ts` (`CombatState`) |
| WS roll | `backend/src/websocket/webSocketServer.ts` (`submitRollResult`) |

## Migration

- Coluna `phase` varchar ou enum em `combat_encounters`.
- Default `ENCOUNTER_ACTIVE` para encontros existentes.

## Testes obrigatórios

- Ataque hit → damage roll → sem `logEntries` entre eles.
- Miss → narrate once.
- `shouldNarrate: false` ainda avança FSM.

## Anti-padrões

- IA emitir morte/HP; usar `motorHints` apenas.
