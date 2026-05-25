# TODO — Migração total para OSS-120B + orquestração OpenRouter

**Objetivo:** abandonar Gemini no gameplay, extrair o máximo de `openai/gpt-oss-120b:free`, reduzir JSON inválido, suportar N chaves OpenRouter com métricas e rotação.

**Documentos relacionados:** [docs/OPENROUTER_VIABILITY.md](docs/OPENROUTER_VIABILITY.md) · [docs/AI_OPENROUTER.md](docs/AI_OPENROUTER.md) · [docs/AI_PIPELINE.md](docs/AI_PIPELINE.md)

**Modelo alvo:** `openai/gpt-oss-120b:free` (primário) — failover opcional só entre outros `:free` se OSS em 429 upstream.

**Status geral:** 🟢 Fase 4 concluída (embeddings Nemotron, JSON repair, dynamic prompts, auto-temp); PR-E frontend opcional

---

## Filosofia nova

### Não fazer mais

- Parsing frágil sem camada de repair
- Prompt monolítico (regras + lore + schema + estado num bloco só)
- Schema universal gigante (`GameMasterResponse` completo em toda chamada)
- Compatibilidade Gemini-first no caminho quente do turno
- IA controlar HP/inventário/combate sem motor de regras
- Classificador LLM extra por turno (`DM_LLM_CLASSIFY`) em produção free

### Fazer

- Respostas modulares (narration → combat → effects em chamadas separadas quando necessário)
- Contexto priorizado e comprimido
- Repair pass antes de regenerar tudo
- Multi-key OpenRouter com cooldown, health score e contagem de req
- Telemetria: JSON failure rate, repair rate, latência por key

---

## Mapa do código atual (legacy vs novo)

| Área | Legacy (descontinuar no gameplay) | Novo (`backend/src/ai-oss/`) |
|------|-----------------------------------|------------------------------|
| Geração turno | `services/aiService.ts` → `getGameUpdate` | `orchestration/narrationPipeline.ts` |
| Fachada | `ai/gameUpdate.ts` | `ai-oss/index.ts` |
| Provider | `ai/providerFactory.ts` (Gemini tail) | `providers/OpenRouterManager.ts` |
| Adapter HTTP | `ai/providers/openRouterAdapter.ts` | `providers/openRouterClient.ts` |
| Parser | `ai/responseParser.ts` + `services/aiRepairUtils.ts` | `parser/jsonRecovery.ts` |
| Schema Zod | `schemas/gameSchemas.ts` (completo) | `schemas/narration.schema.ts` (+ combat, effects…) |
| Prompts | `game/prompts/*`, `ai/promptAssembler.ts` | `prompts/system/*`, `prompts/runtime/*`, `promptComposer.ts` |
| Fases | `narration/phaseOrchestrator.ts` | `orchestration/phaseRunner.ts` |
| Entrada WS | `websocket/webSocketServer.ts` | (mantém; chama pipeline OSS) |
| Classificador | `dm/freeActionLlmClassifier.ts` | heurística PT só / OSS opcional |
| Resumo história | `services/storyService.ts` (Gemini) | `memory/summaryGenerator.ts` (OSS) |
| Imagem | `services/imageGenerationService.ts` | descontinuado temporariamente |
| TTS | cliente + Gemini TTS | Piper / descontinuado Gemini TTS |
| Embeddings | `services/embeddingService.ts` | adiar ou OR embedding |
| Homebrew IA | `services/aiCreationService.ts` | `narrative/homebrewAssist.ts` |
| Região | `services/regionAiService.ts` | `context/regionContext.ts` |
| Scripts teste | `scripts/testStructured*.ts` | `scripts/oss120bBenchmark.ts` |
| Frontend modelo | `SettingsContext.tsx` (lista Gemini) | só OpenRouter + OSS default |

---

## Estrutura alvo `backend/src/ai-oss/`

```
ai-oss/
├── README.md
├── index.ts
├── constants.ts
├── core/
│   └── engineSwitch.ts          # AI_ENGINE=legacy|oss
├── providers/
│   ├── OpenRouterManager.ts     # ✅ Fase 1
│   └── openRouterClient.ts      # ✅ Fase 1
├── parser/
│   └── jsonRecovery.ts          # ✅ Fase 1 (wrap repair legado)
├── schemas/
│   ├── narration.schema.ts      # ✅ Fase 1
│   ├── combat.schema.ts         # Fase 2
│   ├── effects.schema.ts
│   └── memory.schema.ts
├── prompts/
│   ├── system/                  # behavior, format, safety
│   ├── runtime/                 # scene, player, combat
│   ├── output/                  # strict_json compact
│   └── promptComposer.ts        # ✅ Fase 1 stub
├── context/
│   ├── contextBuilder.ts        # Fase 1
│   └── contextPrioritizer.ts    # Fase 1
├── orchestration/
│   ├── narrationPipeline.ts     # Fase 1 → substitui getGameUpdate
│   └── phaseRunner.ts           # Fase 2
├── validators/
│   └── narrationValidator.ts    # Fase 1
├── telemetry/
│   └── requestMetrics.ts        # ✅ Fase 1
├── cache/
│   └── promptCache.ts           # Fase 3
├── narrative/
│   └── antiLoop.ts              # Fase 2
├── combat/
│   └── deterministicCombat.ts   # Fase 2
└── memory/
    └── compressor.ts            # Fase 2
```

---

## Configuração `.env` (referência)

```env
AI_ENGINE=oss
AI_PROVIDER=openrouter
AI_DEFAULT_MODEL=openai/gpt-oss-120b:free
AI_FAILOVER_CHAIN=openai/gpt-oss-120b:free
AI_OPENROUTER_ONLY=true
DM_LLM_CLASSIFY=false

# N chaves (contas distintas = mais cota diária free)
OPENROUTER_KEY1=
OPENROUTER_KEY2=
OPENROUTER_KEY3=
OPENROUTER_KEY4=
# ou lista: OPENROUTER_KEYS=sk-or-...,sk-or-...

# GEMINI_API_KEY=   # comentado — gameplay não usa
```

---

# FASE 1 — Fundação (prioridade máxima)

- [x] **TODO-OSS-120B.md** (este arquivo)
- [x] Pasta `backend/src/ai-oss/` + README
- [x] **OpenRouterManager** — round-robin, failover, cooldown 429, health score, contagem req
- [x] **openRouterClient** — HTTP com métricas e rotação de key
- [x] Integrar Manager em `openRouterAdapter.ts`
- [x] **jsonRecovery** — reexportar/estender `aiRepairUtils` + `responseParser`
- [x] **narration.schema.ts** — schema compacto narrativa
- [x] **promptComposer** — stub + prompts OSS (`system/format`, `output/compact`)
- [x] **contextPrioritizer** — stub (prioridades documentadas)
- [x] **requestMetrics** — snapshot JSON / log
- [x] **engineSwitch** — `AI_ENGINE=oss|legacy`
- [x] **narrationPipeline** — geração OSS compacta + repair + map para GameMasterResponse
- [x] Ligar `narrarService` / `phaseOrchestrator` → `AI_ENGINE=oss`
- [x] Default modelo usuário: `openai/gpt-oss-120b:free` (backend + frontend)
- [x] `AI_FAILOVER_CHAIN` só OSS quando `AI_OPENROUTER_ONLY=true`
- [x] API `GET /api/admin/ai-metrics` + `GET /metrics/openrouter`
- [x] Marcar `@deprecated` nos principais arquivos legacy (gameplay)
- [x] Atualizar `docker-compose.dev.yml` — `OPENROUTER_KEY4`, `AI_ENGINE=oss`, `AI_DEFAULT_MODEL`
- [x] Scripts `npm run ai:oss-metrics` · `npm run ai:oss-smoke`

### Arquivos legacy — marcar descontinuados (gameplay)

- [x] `backend/src/services/aiService.ts`
- [x] `backend/src/ai/gameUpdate.ts`
- [x] `backend/src/ai/client.ts`
- [ ] `backend/src/ai/genkit.ts`
- [x] `backend/src/ai/providerFactory.ts` (Gemini bloqueado se OR-only)
- [x] `backend/src/services/dm/freeActionLlmClassifier.ts` — desligado via env
- [x] `backend/src/services/storyService.ts` — resumo/recap via `generateOssPlainText` quando OR-only
- [ ] `backend/src/services/imageGenerationService.ts` — bypass
- [x] `backend/src/services/embeddingService.ts` — OpenRouter Nemotron + `OPENROUTER_KEY_EMBEDDING`
- [ ] `backend/src/services/aiCreationService.ts` — bypass
- [ ] `backend/src/services/regionAiService.ts` — migrar

---

# FASE 2 — Qualidade (JSON + narrativa)

## 5. Redução extrema de JSON inválido

- [x] Geração por blocos: `{ narration, actions, state_changes }` mínimo (`narration.schema.ts`)
- [x] **Repair pass** — `quoteNormalizer` → `runOssRepairPass` → parse legado
- [x] **Local field repair** — `tryLocalOssFieldRepair` (sem nova API se só faltam campos)
- [x] `OSS_MAX_API_ATTEMPTS` default 2 (economiza cota)
- [x] Temperatura por domínio (`configs/narrative.ts` / `configs/combat.ts`)
- [x] `response_format: json_object` no adapter
- [x] Benchmark: `npm run ai:oss-benchmark` (20 cenários; meta 90%)

## 6. Schemas menores

- [x] `combat.schema.ts` — só combate (Fase 2b)
- [x] `effects.schema.ts` — patch de efeitos
- [x] `memory.schema.ts` — newFacts / memoryContext
- [x] Mapper compact → `GameMasterResponse` (`mapOssNarrationToGameMasterShape`)

## 7. Contexto inteligente

- [x] **contextBuilder** — cena + memória priorizada
- [x] **contextPrioritizer** — ordem de prioridade
- [x] **memory/compressor** — `compressGameLogForOss`

## 11. Narrativa OSS-120B

- [x] `OSS_SCHEMA_REF` no system (sem schema gigante repetido)
- [x] Lore via `buildOssSceneContext` (priorizado)
- [x] **antiLoop** — `detectNarrationLoop` + retry com hint

## 12. Combate determinístico

- [x] `OSS_COMBAT_CONFIG` — temp baixa, menos tokens (via `pickDomainConfig`)
- [x] `deterministicCombat.ts` — prompt combate + validação + strip dano/HP

## 15. Actions registry

- [x] `actions/registry.ts` — IDs estáveis + `normalizeActionOptionsFromRegistry`

---

# FASE 3 — Escala e observabilidade

## 8. OpenRouter (completar)

- [x] Persistir métricas em Redis (`oss:metrics:latest` + RPM por minuto/key)
- [x] API enriquecida com `currentMinuteRpm` por key
- [x] Circuit breaker por key (já em OpenRouterManager — cooldown 60s)
- [x] TPM estimado (chars/4 + usage OR) por key/minuto no Redis

## 9. Streaming

- [x] WS `narrationStream` — preview de `narration` antes do JSON completo (`OSS_STREAM_NARRATION=true`)
- [x] Eventos `preview` | `structured` | `done`

## 10. Prompt DSL

- [x] `composePrompt({ scene, player, combat, memory, outputSchema })` — `prompts/promptDsl.ts`
- [x] Testes snapshot — `ossPhase3.spec.ts`

## 16. Observabilidade

- [x] Métricas: latency p50/p95, JSON failure %, first-pass %, repair rate, TPM/key
- [x] Correlação `actionId` / `traceId` (`OSS_TRACE_LOG=true`)

## 17. Cache

- [x] Cache system prompt por sessão/região/combate (`OSS_PROMPT_CACHE`)
- [x] Invalidação por `stateVersion` na chave de cache

## 18. Testes automatizados

- [x] Suite unitária Fase 3: DSL, cache, stream extract, latência, combate, exploração
- [ ] Suite E2E 50 cenários (benchmark `ai:oss-benchmark`) — meta 90%

---

# FASE 4 — Refinamento

- [x] Auto-tuning temperatura — `ai:oss-apply-temp-profile` + `OSS_TEMP_PROFILE_PATH`
- [x] Dynamic prompting — `phaseTemplates.ts` (exploration | combat | social)
- [x] Repair mini-call JSON — `jsonOnlyRepair.ts` (`OSS_JSON_ONLY_REPAIR`)
- [x] Embeddings OR — `nvidia/llama-nemotron-embed-vl-1b-v2:free` + Qdrant 2048 dims
- [x] Multi-provider — `providerRegistry.ts` (OpenRouter + Gemini legado)
- [x] Ficha narrativa compacta (`narrativeCharacterCard.ts` → `FICHA=` no prompt OSS)
- [x] Doc padrões MOM → `docs/OSS_MEMORY_AND_MOM.md`
- [x] Benchmark Qdrant — `npm run ai:qdrant-benchmark` + `docs/QDRANT_VIABILITY.md`
- [x] `newFacts` no schema/prompt OSS + persistência SQL
- [x] Política de embedding (recall/store a cada N turnos, skip recall se facts ≥ N)
- [x] Indexação `journal` → Qdrant (`journalMemoryIndexer.ts`)
- [x] Frontend sem passo de API key (chaves só no servidor)

---

# Fluxo alvo (pipeline OSS)

```
Player Input
    ↓
Context Builder (priorizado)
    ↓
Memory Compressor (facts)
    ↓
Prompt Composer (compact + OSS format)
    ↓
OpenRouterManager.pickKey()
    ↓
OSS-120B Generation
    ↓
jsonRecovery.extract + repair
    ↓
narration.schema (Zod)
    ↓
[fail] Repair Pass → partial regen
    ↓
Map → GameMasterResponse
    ↓
Game State Engine (motor regras — inalterado)
    ↓
WebSocket (gameStateUpdate + narrationComplete)
```

---

# Métricas de sucesso (aceite)

| Métrica | Alvo |
|---------|------|
| JSON válido 1ª tentativa | ≥ 70% |
| JSON válido após repair | ≥ 95% |
| Latência p95 narrativa | &lt; 25s (free tier) |
| Turnos/dia (4 contas × 50 req, ~1.4 req/turno) | ~140 turnos |
| Falhas 429 evitáveis | &lt; 5% com cooldown + 1 modelo fixo |
| Zero chamadas Gemini no `processAction` | 100% |

---

# Prioridade imediata (próximos PRs)

1. **PR-A:** OpenRouterManager + métricas + env 4 keys + adapter integrado ✅ (base)
2. **PR-B:** `AI_ENGINE=oss` + `narrationPipeline` + schema compacto no hot path
3. **PR-C:** Prompt composer v1 + context prioritizer v1
4. **PR-D:** Repair pass refinado + testes 50 cenários
5. **PR-E:** Frontend — default OSS, remover Gemini da lista principal

---

# Notas de viabilidade (4 keys, OSS only)

- **RPM:** ~20/min **por conta** no `:free`; latência ~16s → ~3–4 turnos/min reais.
- **Dia:** ~50 req/conta sem créditos → **~200 req/dia** com 4 contas → **~140 turnos/dia** se ~1,4 req/turno (JSON + retry).
- **JSON ruim:** cada retry extra consome cota — Fase 2 é crítica para “maximizar jogo”.

---

*Última atualização: 2026-05-25 — Fase 3 implementada.*
