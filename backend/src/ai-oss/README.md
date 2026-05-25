# ai-oss — motor de IA para OpenAI gpt-oss-120b (OpenRouter)

Pipeline novo, independente do legado Gemini (`services/aiService.ts`).

## Ativar

```env
AI_ENGINE=oss
AI_DEFAULT_MODEL=openai/gpt-oss-120b:free
OPENROUTER_KEY1=...
# OPENROUTER_KEY2..N ou OPENROUTER_KEYS=k1,k2,...
```

## Fase atual (1 concluída)

- **OpenRouterManager** — rotação, cooldown, métricas (`npm run ai:oss-metrics`)
- **narrationPipeline** — prompt compacto, JSON repair, Zod OSS → GameMasterResponse
- **phaseOrchestrator** + **narrarService** — `AI_ENGINE=oss` (default no Docker)
- **Chaves servidor** — `OPENROUTER_PREFER_SERVER_KEYS=true` + `OPENROUTER_KEY1..N`
- Smoke: `npm run ai:oss-smoke`
- Métricas HTTP: `GET /api/admin/ai-metrics`

`AI_ENGINE=legacy` volta ao `aiService` antigo.

## Fase 2

- Repair: `parser/repairPass.ts`, `localFieldRepair.ts`
- Anti-loop: `narrative/antiLoop.ts`
- Combate determinístico + `actions/registry.ts`
- Benchmark: `npm run ai:oss-benchmark`
- `OSS_MAX_API_ATTEMPTS=2` no `.env`

## Fase 3

- **TPM** — tokens/min por key no Redis (`estimatedTokensMinute` em `/api/admin/ai-metrics`)
- **Observabilidade** — p50/p95 latência, `firstPassJsonRate`, `jsonRepairRate`
- **Cache** — system prompt por `sessionId` + `region` + `stateVersion` (`OSS_PROMPT_CACHE`)
- **DSL** — `composePrompt()` em `prompts/promptDsl.ts`
- **Streaming** — `OSS_STREAM_NARRATION=true` → eventos WS `narrationStream` (preview da narração)
- **Testes** — `npm test` inclui `ossPhase3.spec.ts`

```env
OSS_STREAM_NARRATION=false
OSS_PROMPT_CACHE=true
OSS_TRACE_LOG=false
```

## Fase 4

- **Embeddings:** `OPENROUTER_KEY_EMBEDDING` + `nvidia/llama-nemotron-embed-vl-1b-v2:free` → Qdrant (`QDRANT_VECTOR_SIZE=2048`)
- Smoke embeddings: `npm run ai:oss-embedding-smoke`
- **JSON-only repair:** mini-call OSS antes de regerar turno (`OSS_JSON_ONLY_REPAIR`)
- **Dynamic prompts:** exploration / combat / social
- **Temperatura:** `npm run ai:oss-apply-temp-profile` após benchmark

```env
AI_EMBEDDING_PROVIDER=openrouter
OPENROUTER_KEY_EMBEDDING=sk-or-...
OPENROUTER_EMBEDDING_MODEL=nvidia/llama-nemotron-embed-vl-1b-v2:free
QDRANT_ENABLED=true
QDRANT_VECTOR_SIZE=2048
```

Ver [TODO-OSS-120B.md](../../../TODO-OSS-120B.md) na raiz do repo.
