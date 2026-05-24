# Pipeline de IA (narrativa)

O backend separa **motor de regras** (autoritativo) e **IA narrativa** (Gemini). O modo de operação é controlado por `AI_PIPELINE_MODE`.

## Modos (`AI_PIPELINE_MODE`)

| Modo | Comportamento |
|------|----------------|
| `narration_only` | **Padrão.** A IA devolve prosa, `logEntries`, `actionOptions` e metadados leves. HP, inventário, combate, XP e mapa vêm do motor + persistência. Campos de estado são removidos da resposta antes de chegar ao cliente (`motorStateBridge`). |
| `dual` | Duas chamadas Gemini: fase **narrative** (texto) e fase **state** (patch de estado). O motor ainda reconcilia combate/inventário quando aplicável. |
| `full` | Uma resposta JSON completa no schema legado `GameMasterResponse` (modo transição / testes). |

Defina no `backend/.env`:

```bash
AI_PIPELINE_MODE=narration_only
```

## Módulos (`backend/src/narration/`)

| Arquivo | Responsabilidade |
|---------|------------------|
| `contextBuilder.ts` | Monta contexto de prompt (memória, região, combate). |
| `turnProcessor.ts` | Orquestra fases Gemini (`runNarrationAiPhases`). |
| `phaseOrchestrator.ts` | Implementação das fases + validação por foco. |
| `persistence.ts` | Transação: logs, homebrew, merge de personagem, memória vetorial. |
| `regionMapValidation.ts` | Valida transições de região/POI vindas da IA. |
| `motorStateBridge.ts` | Remove campos que o motor já possui em `narration_only`. |

Entrada principal: `processPlayerTurn` em `services/narrarService.ts` (carrega sessão → contexto → IA → persistência).

## Fluxo resumido

```
processAction (WS) → motor de intents → processPlayerTurn
  → buildNarrationContext
  → runNarrationAiPhases (Gemini)
  → validador / combate / XP
  → persistNarrationTurn (MySQL + Redis)
```

## Cliente Gemini (`backend/src/ai/`)

- `instructions.ts` — system instruction
- `gameUpdate.ts` — fachada `getGameUpdate`
- `promptAssembler.ts` — `createPrompt` (montagem do prompt enviado ao Gemini)
- `promptSections.ts` — blocos reutilizáveis do prompt
- `responseValidator.ts` — validação por fase

Métricas opcionais: `ai/metrics.ts` (`recordAiPipelineMetric`).

## Roll guard

A IA **não** deve emitir `playerRollRequest`; apenas o motor cria rolagens pendentes. Solicitações espúrias da IA são descartadas e contabilizadas em `rollMetricsService`.
