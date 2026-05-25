# Qdrant — viabilidade, limites e benchmark

Script: `cd backend && npm run ai:qdrant-benchmark`

## Qdrant ≠ embedding NVIDIA (usamos os dois)

| Papel | Tecnologia | O que faz |
|-------|------------|-----------|
| **Embedding** | OpenRouter `nvidia/llama-nemotron-embed-vl-1b-v2:free` | Transforma texto em vetor (2048 números) |
| **Vector DB** | Qdrant no Docker (`QDRANT_URL`) | Guarda vetores e faz busca por similaridade |
| **Reserva** | MySQL `vector_memory_backlog` | Se Qdrant ou embed falhar, o turno não quebra |

Fluxo no jogo (`vectorMemoryService.ts`):

1. **Antes do turno** — `buildNarrationContext` → `recallSimilarMemories('session_memories', …)` → trecho `Recall vetorial` no prompt OSS
2. **Depois do turno** — `persistNarrationTurn` → `storeMemory('session_memories', …)` com resumo jogador+mestre

Chave de embedding: `OPENROUTER_KEY_EMBEDDING` (cota separada da narrativa `gpt-oss-120b`).

### Política de cota (`.env`)

| Variável | Padrão | Efeito |
|----------|--------|--------|
| `OSS_EMBED_RECALL_EVERY_TURNS` | 2 | Recall vetorial só em turnos pares |
| `OSS_EMBED_STORE_EVERY_TURNS` | 2 | Upsert do par jogador/mestre em turnos pares |
| `OSS_EMBED_SKIP_RECALL_IF_FACTS_GE` | 8 | Sem embed de recall se já há fatos SQL suficientes |
| Journal novo | sempre | Indexação de objetivos do `journal` quando aparecem |

Turnos ímpares ainda gravam **backlog MySQL**; quando o embed volta, o recall drena a fila.

## Importante: qual “free”?

Neste projeto o Qdrant roda **self-hosted no Docker** (`qdrant/qdrant` na porta 6333), **não** Qdrant Cloud.

| Componente | Plano “free” relevante |
|------------|-------------------------|
| **Qdrant (Docker local)** | Sem cota de cloud; limites = CPU/RAM/disco do seu PC/servidor |
| **Embeddings** | OpenRouter `nvidia/llama-nemotron-embed-vl-1b-v2:free` — **50 req/dia por conta**, ~20 req/min |
| **Narração** | `gpt-oss-120b:free` — outra cota (ver [OPENROUTER_VIABILITY.md](./OPENROUTER_VIABILITY.md)) |

Ou seja: **falhar por “plano free do Qdrant”** só se migrar para Qdrant Cloud. Hoje o risco real é **container parado** ou **embedding 429**, não quota do Qdrant em si.

## Comportamento do jogo se o Qdrant falhar

`vectorMemoryService.ts` já é **fail-soft**:

- `storeMemory` → grava no backlog MySQL; upsert no Qdrant se estiver up
- `recallSimilarMemories` → se Qdrant down, devolve backlog pendente (sem busca semântica)

O turno **não quebra**; perde recall vetorial até o Qdrant voltar.

## Limites práticos (Docker local, 1 sessão / uso hobby)

| Métrica | Ordem de grandeza esperada |
|---------|----------------------------|
| Latência upsert (1 ponto) | &lt; 50 ms |
| Latência search top-5 | &lt; 30 ms |
| Pontos em `session_memories` | Milhares OK em laptop |
| Dimensão vetor | **2048** (Nemotron) — `QDRANT_VECTOR_SIZE=2048` |
| Concorrência | 1 backend-dev + benchmark leve: suficiente |

## O que o benchmark mede

1. **Saúde** — HTTP `/readyz` + cliente JS
2. **Somente Qdrant** (`--vectors-only`) — upsert/search com vetores aleatórios (isolado da API OR)
3. **Caminho completo** (`--with-embeddings`) — embed + store + recall (inclui limite OpenRouter)
4. **Taxa de acerto** — tokens únicos recuperados após store
5. **Relatório JSON** em `backend/logs/qdrant-benchmark-*.json`

## Uso recomendado

```bash
# 1) Subir Qdrant
docker compose up -d qdrant

# 2) Só infra vetorial (rápido, ~5s)
npm run ai:qdrant-benchmark -- --vectors-only --writes=30 --searches=15

# 3) Caminho real (usa OPENROUTER_KEY_EMBEDDING, mais lento)
npm run ai:qdrant-benchmark -- --with-embeddings --writes=10 --searches=10
```

## Critérios de “pode usar em produção hobby”

| Critério | Alvo |
|---------|------|
| Health OK | 100% |
| Search p95 (vectors-only) | &lt; 100 ms |
| Recall hit rate (vectors-only) | ≥ 90% |
| Com embeddings, writes OK | ≥ 80% sem 429 (depende da cota OR do dia) |

Se `--vectors-only` passar e `--with-embeddings` falhar por 429, o gargalo é **embedding**, não Qdrant.
