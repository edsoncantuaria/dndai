# P4 — Invariantes do sistema distribuído

> Complementa `ARQUITETURA_JOGO_COMPLETA.md` e `ARQUITETURA_IA_COMPLETA.md`. **Status:** P4.1–P4.8 ✅ (`TODO-ARQUITETURA.md`).

O produto deixou de ser “LLM no hot path” e passou a ser **motor determinístico + renderização narrativa assíncrona** (BullMQ). Os riscos principais agora são **ordem**, **idempotência**, **cancelamento** e **observabilidade**.

---

## Invariantes (obrigatórias)

| ID | Invariante | Implementação |
|----|------------|---------------|
| P4.1 | Narração obsoleta não entrega ao cliente | `actionSequence` monotônico por sessão + discard no worker e no frontend |
| P4.2 | Retry BullMQ não duplica persistência | `narration_completions` unique `(sessionId, actionId)` antes de `persistNarrationTurn` |
| P4.3 | Jobs obsoletos removidos da fila + abort no worker | `cancelStaleNarrationJobsForSession` + `narrationCancelled` WS |
| P4.4 | Trace E2E por ação | `logPipelineTrace` (`[PipelineTrace]` JSON) + ActionFlow + event log |
| P4.5 | Snapshot narrativo | Redis `session:{id}:narrative_snapshot` + `NARRATIVE_SNAPSHOT_EVERY_N_TURNS` |
| P4.6 | Stream não canônico | `streamPolicy.ts`; preview só UI; off se fila assíncrona |
| P4.8 | REST na fila | `restNarrationEnqueue.ts` + `status: narration_queued` |

---

## `actionSequence` (P4.1)

- Coluna **`sessoes_ia.actionSequence`** — contador **servidor**, incrementado ao enfileirar narração.
- Distinto de **`actionCursor`** (cursor **cliente** anti-replay de submit).
- Propagado em: `narrationQueued`, `gameStateUpdate`, `narrationComplete`.
- Worker: se `job.actionSequence < getLatestActionSequence(sessionId)` → abort (stale).
- Cliente: descarta `gameStateUpdate` com `actionSequence` menor que o último visto.

## Cancelamento de fila (P4.3)

Ao `allocateActionSequence` (nova narração):

1. `cancelStaleNarrationJobsForSession` — remove jobs BullMQ `waiting`/`delayed` com `actionSequence` menor.
2. `notifyNarrationJobsCancelled` — WS `narrationCancelled` + `stopLoading` por `actionId` supersedido.
3. Jobs **em execução** não são removidos da fila; o worker revalida em `pre_run`, `pre_llm_*` e `pre_deliver_*`.

## Idempotência (P4.2)

- Tabela **`narration_completions`** (`sessionId`, `actionId` unique).
- `tryClaimNarrationPersistence` no início da transação de `persistNarrationTurn`.
- Segunda execução: não regrava logs/fatos/XP; worker pode reemitir WS (cliente filtra por sequence).

---

## Diagrama

```
processAction → motor → dispatchNarrationToQueue
                              │
                    allocateActionSequence (+1)
                              │
                         BullMQ job { actionSequence }
                              │
                    worker: stale? → abort
                              │
                    processPlayerTurn → claim persist → MySQL
                              │
                    WS { actionSequence, gameStateUpdate }
```

---

## Snapshot narrativo (P4.5)

- `narrativeSnapshotService.ts` — grava resumo/timeline/fatos/região no Redis após `persistNarrationTurn`.
- `buildNarrationContext` reutiliza snapshot e só busca recall vetorial + fatos dinâmicos quando necessário.
- Env: `NARRATIVE_SNAPSHOT_EVERY_N_TURNS` (default 3), `NARRATIVE_SNAPSHOT_TTL_SEC` (default 3600).

## REST assíncrono (P4.8)

- `POST /api/sessions/:id/actions` enfileira como o WS quando Redis disponível.
- Resposta: `status: narration_queued` + `actionSequence`; cliente deve ouvir WS ou polling.

## Chaos smoke (P4.7)

```bash
npm run chaos:smoke --prefix backend
```

## Próximo passo: P5

Roadmap ativo: **`TODO-ARQUITETURA.md` seção P5** · detalhe em **`ARQUITETURA_P5_RESILIENCIA.md`**

Prioridade: isolamento do worker (P5.2) → split API/worker Docker (P5.1) → LLM produção (P5.3) → validador narrativo (P5.4).

## Fora do P4/P5 imediato

- Session Actor / mailbox (P3 / pós-P5.6)
- Homebrew capability graph
- Provider abstraction completa
- Chaos tests com crash real de Redis/worker (após P5.1)
