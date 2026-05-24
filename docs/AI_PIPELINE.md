# Pipeline de IA (narrativa)

O backend separa **motor de regras** (autoritativo) e **IA narrativa** (OpenRouter por padrão; Gemini opcional). O modo de operação é controlado por `AI_PIPELINE_MODE`.

Ver também: [AI_OPENROUTER.md](./AI_OPENROUTER.md), [AI_CONTRACT.md](./AI_CONTRACT.md) (entrada/saída, schemas, quem manda em cada regra).

## Modo (`AI_PIPELINE_MODE`)

Somente **`narration_only`** é suportado. `full` e `dual` no `.env` são ignorados (aviso no log do backend).

| Comportamento |
|---------------|
| A IA devolve prosa, `logEntries`, `actionOptions` e `memoryContext`. HP, inventário, combate, XP, loot e loja vêm do **motor** + persistência. Campos de estado da IA são descartados (`motorStateBridge`, `narrativeContract`). |

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
  → runNarrationAiPhases (OpenRouter / Gemini)
  → validador / combate / XP
  → persistNarrationTurn (MySQL + Redis)
```

## Cliente de IA (`backend/src/ai/`)

- `instructions.ts` — system instruction
- `gameUpdate.ts` — fachada `getGameUpdate`
- `promptAssembler.ts` — `createPrompt` (montagem do prompt enviado ao Gemini)
- `promptSections.ts` — blocos reutilizáveis do prompt
- `responseValidator.ts` — validação por fase

Métricas opcionais: `ai/metrics.ts` (`recordAiPipelineMetric`).

## Roll guard

A IA **não** deve emitir `playerRollRequest`; apenas o motor cria rolagens pendentes. Solicitações espúrias da IA são descartadas e contabilizadas em `rollMetricsService`.
