---
name: dndai-minimal-llm-json
description: >-
  Reduz contrato JSON do LLM no pipeline OSS do dndai: narração mínima,
  actionOptions do registry no backend. Use for TODO-ARQUITETURA P0.3,
  ai-oss schemas, prompts, ou fragilidade de parse/retry.
---

# JSON minimalista do LLM

## Objetivo

O modelo retorna pouco; o backend monta o resto.

### Schema alvo (mínimo)

```json
{
  "narration": "string",
  "tone": "dark|tense|hopeful|neutral",
  "newFacts": [{ "fact": "...", "importance": "low|medium|high" }]
}
```

**Não** pedir ao modelo: `actionOptions`, `logEntries` (opcional unificar em `narration`), `state_changes`, campos de motor.

## Onde mudar

| Peça | Arquivo |
|------|---------|
| Schema Zod | `backend/src/ai-oss/schemas/minimalNarration.schema.ts` (criar) |
| Prompt system | `backend/src/ai-oss/prompts/system/format.ts` — variante minimal |
| Pipeline | `backend/src/ai-oss/orchestration/narrationPipeline.ts` |
| Opções | `backend/src/ai-oss/actions/registry.ts` — sempre pós-parse |
| Schema | `OssMinimalNarrationSchema` (sempre ativo) |

## Fluxo pós-parse

1. Validar `OssMinimalNarrationSchema`.
2. `mapMinimalToGameMasterShape(narration)` → `logEntries: [{ type: 'narration', content }]`.
3. `normalizeActionOptionsFromRegistry(domain)` — combat / exploration / social.
4. `validateByPhaseFocus` narrativa legada.

## Métricas de sucesso

- Queda de `jsonRepairRate` e `OSS_MAX_API_ATTEMPTS` > 1.
- Latência média por turno ↓.

## Anti-padrões

- Aumentar schema “para o modelo ajudar” — faz o oposto.
- Remover `localFieldRepair` antes de medir minimal schema.
