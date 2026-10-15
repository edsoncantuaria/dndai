---
name: dndai-action-pipeline-refactor
description: >-
  Extrai webSocketServer.ts em módulo action-pipeline sem mudar comportamento.
  Use for TODO-ARQUITETURA P0.5, god file WS, ou handlers processAction.
---

# Refator — action pipeline

## Meta

Reduzir `webSocketServer.ts` (>900 linhas) para:

```
backend/src/action-pipeline/
  index.ts
  processActionHandler.ts
  submitRollResultHandler.ts
  types.ts
  context.ts          # sessionId, userId, ws, bumpVersion helpers
```

`webSocketServer.ts` fica: auth, switch `message.type`, heartbeat.

## Regras

- **Zero** mudança de comportamento na primeira PR.
- Copiar/colar com testes verdes: `wsActionPipeline.integration.spec.ts`, `actionFlow.e2e.spec.ts`.
- Não misturar com P0.2 (mechanical split) na mesma PR — ou sequenciar: refactor depois split.

## Passos

1. Extrair funções puras (sanitize, recordPhase) para `context.ts`.
2. Mover `handleStructuredIntent` para `structuredIntentHandler.ts`.
3. Mover `submitRollResult` case para `submitRollResultHandler.ts`.
4. `processAction` case → `processActionHandler.ts`.

## Verificação

```bash
npm run test --prefix backend
```

## Anti-padrões

- Reescrever lógica “mais limpa” durante o move.
- Import circular `narrarService` ↔ pipeline — usar dynamic import como hoje.
