# P5 — Resiliência em produção (pós-P4)

> Complementa `ARQUITETURA_JOGO_COMPLETA.md`, `ARQUITETURA_IA_COMPLETA.md` e `ARQUITETURA_P4_DISTRIBUIDO.md`.  
> **Status:** implementado em código (maio 2026) — ver `TODO-ARQUITETURA.md`.

Com P0–P4 concluídos, o gargalo deixa de ser “LLM no hot path” e passa a ser **corrida mecânica × worker**, **custo/latência de modelos**, **consistência narrativa** e **escala de processos**.

---

## Contexto (o que P4 já resolve)

| Risco | P4 |
|-------|-----|
| Narração fora de ordem no cliente | `actionSequence` + discard |
| Retry BullMQ duplica logs | `narration_completions` |
| Fila cheia de jobs mortos | `narrationQueueCancel` |
| Debug distribuído | `pipelineTrace` + event log |

## O que P5 ataca

| Risco | Por quê ainda existe |
|-------|----------------------|
| Combate/recompensas escritos por job obsoleto | Worker ainda pode `saveCombatEncounterState` / `runMotorCombatPipeline` com snapshot do job |
| OOM / WS cai com fila | `startNarrationWorkers()` no mesmo processo que Express+WS |
| Latência/custo `:free` | OpenRouter free + `jsonOnlyRepair` sob carga |
| Lore drift | Sem validador pós-LLM |
| Snapshot Redis CPU | `JSON.parse` monolítico (mitigado por caps, não por design) |

## O que já está mitigado (não repetir trabalho)

Em **`narration_only`** (`motorOwnsState`):

- `stripMotorOwnedFields` + **sem** `mergeCharacterUpdates` da IA na ficha.
- Patch de inventário/XP no `gameStateUpdate` lê **MySQL no commit**, não snapshot do início do turno.

O cenário clássico “Job #1 sobrescreve HP da Ação #2 via `safeMerge`” **não é o caminho padrão atual** — P5 foca em **combate**, **pós-roll no worker** e **processos**.

---

## Invariantes implementadas (P5)

| ID | Invariante | Código |
|----|------------|--------|
| P5.2 | Worker não persiste combate (`saveCombatEncounterState` skip) | `workerPersistencePolicy.ts`, `persistence.ts` |
| P5.2 | Worker não roda `runMotorCombatPipeline` com snapshot do job | `narrarService.ts` + `executionSource: 'worker'` |
| P5.2 | Revalidação `actionSequence` antes de persistir | `isStaleBeforePersist` |
| P5.2 | Roll job sem `applyMotorPostRollEffects` duplicado | `narrationJobProcessor.ts` |
| P5.1 | `SKIP_NARRATION_WORKERS` + `narrationWorkerMain.ts` | `server.ts`, Docker |
| P5.3 | Alerta `json_repair_failure_rate` | `pipelineLatency.ts` + admin metrics |
| P5.4 | Heurística consistência + `NarrationConsistencyRejected` | `narrativeConsistencyValidator.ts` |
| P5.5 | Snapshot gzip + cache `region_graph:{slug}` | `narrativeSnapshotService.ts` |

---

## Ordem de execução recomendada

```
P5.2 (isolamento worker)  →  P5.1 (Docker split)  →  P5.3 (ops LLM)
        ↓
P5.4 (consistency)        →  P5.5 (snapshot)      →  P5.6 (lock opcional)
```

**PRs:** uma frente por subseção (P5.2.1, P5.2.2, …), nunca P5 inteiro num único merge.

---

## Referência rápida de arquivos

| Área | Arquivos |
|------|----------|
| Worker | `queue/narrationJobProcessor.ts`, `queue/narrationWorker.ts` |
| Persistência | `narration/persistence.ts`, `services/narrarService.ts` |
| Combate no worker | `services/combatMotorService.ts`, `services/motorPostRollService.ts` |
| Bootstrap | `server.ts`, `docker-compose.yml` |
| Snapshot | `services/narrativeSnapshotService.ts` |
| LLM | `ai-oss/orchestration/narrationPipeline.ts`, `OpenRouterManager` |

---

## Fora do P5 (permanece P3 / futuro)

- Session Actor / mailbox por sessão
- Homebrew capability graph completo
- Chaos com crash real Redis/worker (além de `chaos:smoke` unitário)
- Kafka / MMO
