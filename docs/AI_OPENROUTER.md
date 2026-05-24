# Motor de IA — OpenRouter (free) + Gemini fallback

## Visão geral

O gameplay usa **OpenRouter** por padrão (`AI_PROVIDER=openrouter`). O modo `narration_only` mantém o **motor de regras** como fonte da verdade; a IA narra e sugere opções.

| Papel | Provedor |
|--------|-----------|
| Narração / opções no turno | OpenRouter (modelos `:free`) |
| Failover | Outros modelos free → Gemini (se `GEMINI_API_KEY` no servidor) |
| TTS / homebrew no cliente | Google Gemini (chave separada, opcional) |

## Modelos free recomendados

1. **`meta-llama/llama-3.3-70b-instruct:free`** — padrão; bom equilíbrio narrativa + JSON em português.
2. **`qwen/qwen3-next-80b-a3b-instruct:free`** — backup forte em instruções longas.
3. **`openai/gpt-oss-120b:free`** — backup de capacidade.
4. **`nousresearch/hermes-3-llama-3.1-405b:free`** — alternativa criativa (pode ser mais lento).

Evite **Free Models Router** em produção: roteamento imprevisível quebra validação JSON.

## Configuração

### Usuário (obrigatório para jogar)

1. Conta em [openrouter.ai](https://openrouter.ai)
2. Chave em [openrouter.ai/keys](https://openrouter.ai/keys)
3. Colar em **Configurações → Chave OpenRouter**

### Servidor (`backend/.env`)

```bash
AI_PROVIDER=openrouter
AI_PIPELINE_MODE=narration_only
# Cadeia opcional (vírgulas):
# AI_FAILOVER_CHAIN=meta-llama/llama-3.3-70b-instruct:free,qwen/qwen3-next-80b-a3b-instruct:free
GEMINI_API_KEY=          # opcional: fallback Gemini no servidor
OPENROUTER_APP_NAME=DnDAI
OPENROUTER_APP_URL=https://seu-dominio
```

## Detecção de provedor

- Modelos com `/` e sufixo `:free` → OpenRouter
- Prefixo `or:` → OpenRouter
- Nomes `gemini-*` → Google

## Limitações dos modelos free

- Rate limits e filas nos horários de pico
- JSON ocasionalmente malformado → reparo automático + retries
- Sem schema nativo Gemini; usamos `response_format: json_object` + validador no servidor

## Arquivos

- `backend/src/ai/providers/openRouterAdapter.ts`
- `backend/src/ai/providerFactory.ts`
- `backend/src/services/aiService.ts` (orquestração)
- `docs/AI_PIPELINE.md` (modos de pipeline)
