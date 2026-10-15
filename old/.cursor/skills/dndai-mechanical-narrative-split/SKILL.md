---
name: dndai-mechanical-narrative-split
description: >-
  Desacopla turno mecânico (motor) da narração LLM no Crônicas de Aventuras.
  Use for TODO-ARQUITETURA P0.2, WebSocket mechanicalStateUpdate, filas de
  narração, flags MECHANICAL_NARRATIVE_SPLIT, ou quando o jogo não deve
  bloquear na IA.
---

# Desacoplamento mecânico × narrativo

## Invariantes (não negociar)

- Motor (`rules/`, `stateDeltaService`, `resolveStructuredRoll`) é autoritativo para HP, combate, inventário, rolagens.
- IA só narra (`narration_only`); nunca bloquear aplicação de delta.
- `stateVersion` incrementa após mudança mecânica, antes da narração.

## Arquivos principais

| Área | Caminho |
|------|---------|
| WS | `backend/src/websocket/webSocketServer.ts` |
| Helper | `backend/src/websocket/mechanicalUpdate.ts` |
| DM | `backend/src/services/dm/dmTurnOrchestrator.ts` |
| Cliente WS | `src/hooks/game/useGameWebSocket.ts` |
| Config | `backend/src/config/mechanicalNarrativeSplit.ts` |

## Contrato WS (alvo)

1. **`mechanicalStateUpdate`** — payload igual subset de `gameStateUpdate`: `stateVersion`, `updatedCharacter`, `combatState`, `playerRollRequest`, `lootOffer`, **sem** `logEntries` obrigatórios.
2. **`gameStateUpdate`** / **`narrationStream`** — só prosa e `actionOptions` depois.

## Ordem de implementação

1. Sempre ativo: `mechanicalStateUpdate` + fila BullMQ (sem flag).
2. Após `resolveStructuredRoll` / `applyResultingStateDelta`, emitir `mechanicalStateUpdate`.
3. Cliente: aplicar mecânico em `handleGameStateUpdate` ou handler dedicado; manter `isLoading` se narração pendente.
4. (P0.2.5) Job assíncrono: enfileirar `processPlayerTurn`; WS retorna `narrationJobId`.

## Testes

- `backend/src/__tests__/wsActionPipeline.integration.spec.ts`
- Cenário manual: rolagem → HP atualiza antes do texto aparecer (flag on).

## Anti-padrões

- Esperar `processPlayerTurn` para liberar UI após roll.
- Unificar tudo num único `gameStateUpdate` quando a flag estiver ativa.
