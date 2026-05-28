---
name: dndai-session-simulator
description: >-
  Cria e mantém simulador de sessão/bots para dndai (WS processAction,
  reconnect, exploits). Use for TODO-ARQUITETURA P1.1, testes de carga,
  ou regressão silenciosa.
---

# Session simulator

## Objetivo

Script Node (sem browser) que:

1. Login → JWT.
2. Abre WebSocket.
3. Cria ou usa `sessionId` de teste.
4. Envia N × `processAction` (texto + intents sintéticos).
5. Responde `playerRollRequest` com rolls fake.
6. Opcional: desconecta/reconecta; força `STATE_DESYNC`.

## Local sugerido

`backend/src/scripts/sessionSimulator.ts`  
npm script: `"session:simulate": "tsx src/scripts/sessionSimulator.ts"`

## Cenários mínimos

| Cenário | Assert |
|---------|--------|
| 50 ações livres | sem timeout; stateVersion monotônico |
| 20 skill-check intents | roll queue serializada |
| Reconnect mid-narration | recovery ou erro claro |
| Prompt injection | sem `updatedCharacter` na resposta persistida |

## Env

- `SIM_BASE_URL`, `SIM_WS_URL`, `SIM_USER`, `SIM_PASS`
- `OPENROUTER_KEY1` ou mock `AI_ENGINE` test mode se existir

## CI (P1.2)

- Job opcional `continue-on-error` com 10 ações só se `CI_FULL_SIM=1`.

## Anti-padrões

- Depender de UI Playwright para teste de motor — mais lento e frágil.
