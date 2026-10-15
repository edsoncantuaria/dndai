---
name: dndai-event-log
description: >-
  Append-only game event log no dndai para auditoria, replay e debug. Use for
  TODO-ARQUITETURA P0.1, ActionLog, telemetria, ou regenerar narração.
---

# Event log append-only

## Tipos (`GameEventType`)

Definidos em `backend/src/events/types.ts`:

- `IntentReceived`, `IntentValidated`, `RollIssued`, `RollResolved`
- `DeltaApplied`, `NarrationRequested`, `NarrationCompleted`, `NarrationFailed`
- `MechanicalUpdateEmitted`, `StateVersionBumped`

## API

- `recordGameEvent({ sessionId, actionId, type, stateVersion, payload })`
- Implementação atual: delega a `recordActionLog` com `actionType: game_event:<Type>`.

## Onde instrumentar (prioridade)

1. `webSocketServer` — `processAction` received/ack.
2. `submitRollResult` — após `resolveStructuredRoll`.
3. `narrarService` — antes/depois `runNarrationAiPhases`.
4. `emitMechanicalStateUpdate` — `MechanicalUpdateEmitted`.

## Projeções

- MySQL continua fonte de UI (`Character`, `CombatEncounter`).
- Event log é **auditoria**; não substituir `SessionLog` narrativo ainda.

## Futuro (P1)

- Tabela dedicada `session_game_events` se JSON em `action_logs` ficar grande.
- Replay: ordenar por `id` + `actionId`.

## Anti-padrões

- Mutar eventos passados.
- Logar prompt completo em produção sem redação (usar `ossPromptLog` dev-only).
