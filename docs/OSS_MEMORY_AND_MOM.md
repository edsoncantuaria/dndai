# Memória OSS e ideias replicáveis do MOM

O [MOM](https://github.com/momhq/mom) (pasta `/mom` neste repo) é memória para **agentes de desenvolvimento**. O runtime do jogo usa **Qdrant + facts SQL + card narrativo** — mesmos princípios, outro domínio.

## O que vale replicar (mapeamento)

| Ideia MOM | Já no DnDAI | Próximo passo opcional |
|-----------|-------------|------------------------|
| **Recall progressivo** (restrito → mais amplo) | `queryRelevantFacts` por região/NPC/quest; recall vetorial por `sessionId` | Escalar: sessão → mundo (`world_memories`) se recall vazio |
| **Conteúdo pesa mais que tags** | Embedding no texto completo (Nemotron), não só labels | Manter; evitar indexar só metadados |
| **Curated antes de draft** | Facts `isActive` + narração persistida após validação | Flag `promoted` em facts raros |
| **Substância imutável** | `SessionFact` append-only; `stateVersion` invalida cache | Supersede por novo fact (sem editar o antigo) |
| **Resumo curto + corpo longo** | **Ficha narrativa** (~120 tokens) + Qdrant para trechos | Chunks de `journal` / `storySoFar` indexados |
| **Escopo de projeto** | `.mom-project` (dev) vs `sessionId` + `characterId` (jogo) | Coleção Qdrant com filtro `characterId` |
| **Landmark / centralidade** | Prioridade em `contextPrioritizer` (quests, memória) | +score em facts de quest ativa |
| **Uma ferramenta de recall** | Um pipeline: `buildNarrationContext` → OSS | — |

## O que não replicar no hot path

- FTS5 local do MOM (jogo já tem Qdrant + MySQL).
- MCP `mom_recall` no servidor de partida (MOM fica no Cursor para código/docs).
- Embedding da ficha mecânica inteira (HP/inventário = motor).

## Ficha narrativa (implementado)

Módulo: `backend/src/ai-oss/context/narrativeCharacterCard.ts`

Linha no prompt OSS: `FICHA=...` (~80–150 tokens), recalculada **a cada turno** no servidor a partir do snapshot do personagem — sem chamada extra de embedding.
