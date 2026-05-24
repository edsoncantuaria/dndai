# OpenRouter — limites, JSON/Zod e viabilidade da mesa

Benchmark local: `cd backend && npm run ai:openrouter-benchmark`

## Limites oficiais (OpenRouter, modelos `:free`)

Fonte: [API Rate Limits](https://openrouter.ai/docs/api/reference/limits)

| Limite | Sem créditos ($10+) | Com ≥ $10 em créditos |
|--------|---------------------|------------------------|
| **Por minuto** | **20 req/min** (todos os `:free` somados na conta) | 20 req/min |
| **Por dia** | **50 req/dia** | **1000 req/dia** |

Notas importantes:

- **Várias API keys na mesma conta OpenRouter não aumentam RPM** (capacidade global).
- **Trocar de modelo** na cadeia de failover usa **limites do provedor upstream** (por isso Llama pode aparecer como **8/min** nos logs enquanto o teto da plataforma é 20/min).
- Três chaves em **contas diferentes** podem ajudar na **cota diária** (50+50+50), não no RPM global da plataforma para o mesmo modelo.

## Medição em 24/05/2026 (ambiente deste repo)

### Contas das chaves `OPENROUTER_KEY1..3`

| Chave | `creator_user_id` (conta) |
|-------|---------------------------|
| KEY1 | `user_3C0LYhHyws0VEXjdIdzZFfmhqzY` |
| KEY2 | `user_3EBxGR67ANAOrTAbsWwO3cmkmos` |
| KEY3 | `user_3EBxLKQSzr4KEdVwuB1g1PDUn5i` |

KEY2 e KEY3 são **a mesma conta**; KEY1 é **outra conta**.

### Por modelo (teste narrativo + JSON + Zod `NarrativePhaseResponseSchema`)

| Modelo | RPM observado | JSON parse | Zod narrativa | Latência típica |
|--------|---------------|------------|---------------|-----------------|
| `meta-llama/llama-3.3-70b-instruct:free` | 429 upstream (indisponível no momento) | — | — | ~400ms erro |
| `qwen/qwen3-next-80b-a3b-instruct:free` | 429 upstream | — | — | ~400ms erro |
| `openai/gpt-oss-120b:free` | **22 reqs OK** a cada ~2,8s (~20/min) sem 429 | às vezes JSON malformado | **passou** no 1º teste; falhou no 2º (aspas quebradas) | **~16s** |

### Viabilidade para a mesa (1 turno ≈ 1 narração + opcional classificador)

| Config | Chamadas/turno | Viável em free? |
|--------|----------------|-----------------|
| Só narração, 1 modelo | 1–3 (retries Zod) | **Marginal**: ~6–20 turnos/min no melhor caso; **50/dia** sem créditos |
| + `DM_LLM_CLASSIFY=true` | +1 no mesmo ou outro modelo | **Ruim**: estoura RPM e dia rápido |
| Failover 3 modelos no mesmo minuto | até 3× consumo | Rotacionar **modelo** ajuda; **não** repetir o mesmo `:free` em retry |

Recomendações:

1. `DM_LLM_CLASSIFY=false` — classificação só heurística PT.
2. `AI_FAILOVER_CHAIN` só OpenRouter (sem Gemini).
3. Modelo principal estável quando Llama/Qwen estiverem em 429 upstream (ex.: `openai/gpt-oss-120b:free`).
4. Para sessão longa: **≥ $10 créditos** no OpenRouter (1000 req/dia) ou modelo pago.
5. Chaves no `.env` para o **servidor**; no Docker passar `OPENROUTER_KEY1..3` (ver `docker-compose.dev.yml`).

## Rotação: modelo vs chave

| Estratégia | O que faz no retry 429 | Eficácia |
|------------|------------------------|----------|
| **Modelo** (`AI_FAILOVER_CHAIN=a,b,c`) | Próximo modelo na fila | **Alta** |
| **Chave** (`OPENROUTER_KEY1..3`) | Só ajuda se for **outra conta** ou após cooldown | **Baixa** no mesmo modelo/conta |

O código já faz failover de **modelo** em `aiService.ts`. Rotação de **chave** no adapter é complementar (contas distintas).

## Gemini

Para gameplay 100% OpenRouter: deixe `GEMINI_API_KEY` vazio, use `AI_PROVIDER=openrouter` e cadeia sem `gemini-*`. TTS/imagem/homebrew ainda podem usar Google até migrarem.
