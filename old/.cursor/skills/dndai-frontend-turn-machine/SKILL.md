---
name: dndai-frontend-turn-machine
description: >-
  State machine do turno no frontend dndai (idle, rolling, mechanical,
  narrating). Use for TODO-ARQUITETURA F.1/F.2, useNewGameState refactor,
  ou race conditions de loading.
---

# Frontend — turn state machine

## Estados

```
idle → enqueuing → waiting_ack → rolling → mechanical_done → narrating → idle
```

Paralelo: `error`, `desync` (reload session).

## Problema atual

`useNewGameState` + `pendingActionsRef` + `playerRollRequest` + `isLoading` — lógica espalhada.

## Abordagem recomendada

1. **Zustand slice** `useTurnPipelineStore` ou **XState** `turnMachine` em `src/hooks/game/turnMachine.ts`.
2. `useGameWebSocket` despacha eventos: `WS_ACTION_ACK`, `MECHANICAL_UPDATE`, `NARRATION_COMPLETE`.
3. `useGameActions` só envia WS; não gerencia loading diretamente.

## Integração P0.2

- Handler `mechanicalStateUpdate` → evento `MECHANICAL_APPLIED`.
- `narrationComplete` → `NARRATION_DONE` só libera se mechanical já aplicado (flag on).

## Arquivos

- `src/hooks/game/useGameWebSocket.ts`
- `src/hooks/game/useGameActions.ts`
- `src/hooks/newUseGameState.ts` (afinar até sumir)

## Anti-padrões

- Duplicar `setIsLoading` em 5 hooks.
- Ignorar `actionId` — sempre correlacionar.
