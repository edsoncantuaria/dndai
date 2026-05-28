# TODO — Arquitetura produção (motor × IA × escala)

> **Prioridade atual** (maio 2026): **P5** concluído em código — validar em staging (split Docker + ações rápidas).
>
> **Documentação viva:** `docs/ECOSSISTEMA.md` · `docs/DESIGN_FRONTEND.md` · histórico em `docs/archive/`
>
> **Skills:** `.cursor/skills/` · **Agentes:** `.cursor/AGENTS.md`

**Legenda:** ⬜️ pendente · 🔄 em progresso · ✅ feito · ⏸ adiado

---

## Como usar este arquivo

1. Escolha um item pendente e marque 🔄.
2. Abra a **skill** ou `docs/ECOSSISTEMA.md`.
3. Ao concluir: ✅, `npm run test --prefix backend`, atualize este arquivo.
4. **Uma subseção por PR** quando possível.

---

## P5 — Resiliência em produção ✅

> Detalhe: `docs/ECOSSISTEMA.md` (seções P4/P5)

### P5.2 Isolamento do worker

| ID | Tarefa | Status |
|----|--------|--------|
| P5.2.1 | Revalidar `actionSequence` antes de `persistNarrationTurn` / combate | ✅ |
| P5.2.2 | `motorOwnsState` + worker: skip `saveCombatEncounterState` | ✅ |
| P5.2.3 | Worker: leitura combate DB, sem `runMotorCombatPipeline` persist | ✅ |
| P5.2.4 | Roll job: sem `applyMotorPostRollEffects` duplicado no worker | ✅ |
| P5.2.5 | Testes policy + chaos smoke P5 | ✅ |
| P5.2.6 | Doc + regra Cursor (`workerPersistencePolicy`, append-only) | ✅ |

### P5.1 Separação API × worker

| ID | Tarefa | Status |
|----|--------|--------|
| P5.1.1 | `SKIP_NARRATION_WORKERS` no `server.ts` | ✅ |
| P5.1.2 | `src/narrationWorkerMain.ts` | ✅ |
| P5.1.3 | `npm run worker:narration` | ✅ |
| P5.1.4 | `docker-compose.yml` serviço `narration-worker` | ✅ |
| P5.1.5 | `docker-compose.dev.yml` + `SKIP` no `backend-dev` | ✅ |

### P5.3 LLM em produção

| ID | Tarefa | Status |
|----|--------|--------|
| P5.3.1 | `.env.example` sem `:free` por padrão | ✅ |
| P5.3.2 | `responseMimeType: application/json` OSS (já wired) | ✅ |
| P5.3.3 | Métrica `json_repair_failure_rate` + alerta admin | ✅ |
| P5.3.4 | `JSON_REPAIR_ALERT_THRESHOLD` em `/api/admin/ai-metrics` | ✅ |

### P5.4 Consistência narrativa

| ID | Tarefa | Status |
|----|--------|--------|
| P5.4.1 | `narrativeConsistencyValidator.ts` (heurística) | ✅ |
| P5.4.2 | Integrado em `processPlayerTurn` pré-persist | ✅ |
| P5.4.3 | Retry LLM automático na fila | ⏸ (nota no log + evento; retry custa 2× LLM) |
| P5.4.4 | Evento `NarrationConsistencyRejected` | ✅ |

### P5.5 Snapshot Redis

| ID | Tarefa | Status |
|----|--------|--------|
| P5.5.1 | Compressão `gzip` (`gz1:`) em snapshot | ✅ |
| P5.5.2 | Cache `region_graph:{slug}` | ✅ |
| P5.5.3 | Teste round-trip compressão | ✅ |

### P5.6 Concorrência mecânica (opcional)

| ID | Tarefa | Status |
|----|--------|--------|
| P5.6.1 | Lock Redis no hot path mecânico | ⏸ |
| P5.6.2 | BullMQ group por `sessionId` | ⏸ |

---

## P4 — Sistema distribuído ✅

> `docs/ECOSSISTEMA.md` (seção P4)

| ID | Tarefa | Status |
|----|--------|--------|
| P4.1 – P4.8 | actionSequence, idempotency, cancel, trace, snapshot, stream, chaos, REST | ✅ |

---

## P0 — Invariantes e desacoplamento ✅

<details>
<summary>P0.1 – P0.5</summary>

| Bloco | Status |
|-------|--------|
| P0.1 Event log (P0.1.3 migration ⏸) | ✅ |
| P0.2 Split mecânico × narrativo | ✅ |
| P0.3 JSON minimalista OSS | ✅ |
| P0.4 Combate FSM | ✅ |
| P0.5 action-pipeline | ✅ |

</details>

---

## P1 — Observabilidade ✅ · P2 — Escala ✅ · Frontend F. ✅

---

## P3 — Explícito “não agora”

| Item | Motivo |
|------|--------|
| MMO, Kafka, Session Actor | Outro produto / pós-P5 |
| P5.4.3 retry LLM automático | Custo; heurística + evento por ora |
| P5.6 lock / BullMQ group | Só se P5.2 insuficiente em staging |
| Chaos crash Redis/worker | Após validar P5.1 em prod |

---

## Comandos úteis

```bash
npm run test --prefix backend
npm run session:smoke --prefix backend
npm run chaos:smoke --prefix backend
DB_SYNC=false npm run migration:run --prefix backend

# Dev local (API + worker no mesmo processo)
npm run dev:infra && npm run dev:backend

# P5.1 — processos separados
npm run dev:infra
SKIP_NARRATION_WORKERS=true npm run dev:backend --prefix backend
npm run worker:narration --prefix backend

# Docker produção (profile full)
docker compose --profile full up -d --build
```

**Arquitetura P0/P4/P5 worker:** ver `.cursor/rules/dndai-architecture-and-skills.mdc`.
