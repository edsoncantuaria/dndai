# TODO — Arquitetura produção (motor × IA × escala)

> **Prioridade atual** (maio 2026): sair do “god system” acoplado, desacoplar turno mecânico da narração LLM, reduzir JSON frágil, preparar combate FSM e event log.
>
> **Documentação de referência (mesmo repo):** `docs/ARQUITETURA_JOGO_COMPLETA.md`, `docs/ARQUITETURA_IA_COMPLETA.md`
>
> **Skills do projeto:** `.cursor/skills/` · **Roteamento de agentes:** `.cursor/AGENTS.md`

**Legenda:** ⬜️ pendente · 🔄 em progresso · ✅ feito · ⏸ adiado

---

## Como usar este arquivo

1. Escolha um item **P0** e marque 🔄.
2. Abra a **skill** indicada na coluna “Skill”.
3. Ao concluir: ✅, testes (`npm run test --prefix backend`), atualize este arquivo.
4. Não misturar P2/P3 com P0 na mesma PR — PRs pequenas e revisáveis.

---

## P0 — Invariantes e desacoplamento (4–6 semanas)

### P0.1 Event log append-only (fundação)

| ID | Tarefa | Skill | Status |
|----|--------|-------|--------|
| P0.1.1 | Tipos de evento (`GameEventType`) + `recordGameEvent()` reutilizando `action_logs` | `dndai-event-log` | ✅ |
| P0.1.2 | Instrumentar WS: `IntentReceived`, `RollResolved`, `DeltaApplied`, `NarrationRequested`, `NarrationCompleted` | `dndai-event-log` | ✅ |
| P0.1.3 | Migration opcional `session_game_events` (se `action_logs` ficar apertado) | `dndai-event-log` | ⏸ |
| P0.1.4 | Endpoint admin/debug: replay de eventos por `actionId` | `dndai-event-log` | ✅ |

### P0.2 Split mecânico × narrativo (transporte)

| ID | Tarefa | Skill | Status |
|----|--------|-------|--------|
| P0.2.1 | WS `mechanicalStateUpdate` (sempre ativo) | `dndai-mechanical-narrative-split` | ✅ |
| P0.2.2 | Backend: emitir após `resolveStructuredRoll` + intents com delta | `dndai-mechanical-narrative-split` | ✅ |
| P0.2.3 | Frontend: `useGameWebSocket` handler `mechanicalStateUpdate` | `dndai-mechanical-narrative-split` | ✅ |
| P0.2.4 | Sempre ativo (sem env); doc em `ARQUITETURA_*` | `dndai-mechanical-narrative-split` | ✅ |
| P0.2.5 | Fila Redis + worker inline + `ASYNC_NARRATION_SKIP_SYNC` | `dndai-mechanical-narrative-split` | ✅ |

### P0.3 JSON minimalista do LLM

| ID | Tarefa | Skill | Status |
|----|--------|-------|--------|
| P0.3.1 | `OssMinimalNarrationSchema` | `dndai-minimal-llm-json` | ✅ |
| P0.3.2 | `actionOptions` do registry | `dndai-minimal-llm-json` | ✅ |
| P0.3.3 | `OSS_MAX_API_ATTEMPTS=1` quando minimal | `dndai-minimal-llm-json` | ✅ |
| P0.3.4 | JSON minimal sempre ativo (sem env) | `dndai-minimal-llm-json` | ✅ |

### P0.4 Combate — state machine explícita

| ID | Tarefa | Skill | Status |
|----|--------|-------|--------|
| P0.4.1 | Enum `CombatPhase` + transições | `dndai-combat-fsm` | ✅ |
| P0.4.2 | Migration `phase` em `CombatEncounter` | `dndai-combat-fsm` | ✅ |
| P0.4.3 | FSM após roll + `isCombatNarrationPhase` | `dndai-combat-fsm` | ✅ |
| P0.4.4 | Testes chain attack → damage follow-up | `dndai-combat-fsm` | ✅ |

### P0.5 Extrair pipeline de ação (anti god-file)

| ID | Tarefa | Skill | Status |
|----|--------|-------|--------|
| P0.5.1 | `action-pipeline/` context + types | `dndai-action-pipeline-refactor` | ✅ |
| P0.5.2 | `processAction` + `submitRollResult` extraídos; WS ~130 linhas | `dndai-action-pipeline-refactor` | ✅ |
| P0.5.3 | Testes integração WS (`wsActionPipeline.integration.spec.ts`) | `dndai-action-pipeline-refactor` | ✅ |

---

## P1 — Observabilidade e simulação (2–3 semanas)

| ID | Tarefa | Skill | Status |
|----|--------|-------|--------|
| P1.1 | Script `session:smoke` | `dndai-session-simulator` | ✅ |
| P1.2 | CI: smoke no PR (`.github/workflows/session-smoke.yml` + passo em `ci.yml`) | `dndai-session-simulator` | ✅ |
| P1.3 | Métricas latência + `json_repair_rate` wired | `dndai-event-log` | ✅ |
| P1.4 | Dashboard `/api/admin/ai-metrics` + `pipeline` snapshot | `dndai-event-log` | ✅ |

---

## P2 — Escala e custo (quando houver tráfego)

| ID | Tarefa | Skill | Status |
|----|--------|-------|--------|
| P2.1 | BullMQ (`NARRATION_QUEUE_DRIVER=bullmq`) + worker script | `dndai-mechanical-narrative-split` | ✅ |
| P2.2 | `NarrativeLevel` + hint no `narrarService` | `dndai-minimal-llm-json` | ✅ |
| P2.3 | `SessionFact.tier` + expire por TTL | `dndai-event-log` | ✅ |
| P2.4 | `DM_LLM_CLASSIFY` default on; `false` desliga | `dndai-minimal-llm-json` | ✅ |

---

## P4 — Sistema distribuído (ordem, idempotência, observabilidade)

> Detalhe: `docs/ARQUITETURA_P4_DISTRIBUIDO.md`

| ID | Tarefa | Status |
|----|--------|--------|
| P4.1 | `actionSequence` monotônico + stale no worker + discard no frontend | ✅ |
| P4.2 | `narration_completions` + claim em `persistNarrationTurn` | ✅ |
| P4.3 | Cancelamento / invalidação de jobs obsoletos na fila | ✅ |
| P4.4 | Trace E2E consolidado (`pipelineTrace.ts` + event log) | ✅ |
| P4.5 | `narrativeSnapshotService` (Redis, refresh a cada N turnos) | ✅ |
| P4.6 | `streamPolicy.ts` + stream não-canônico / off com fila | ✅ |
| P4.7 | `npm run chaos:smoke` — invariantes P4 | ✅ |
| P4.8 | REST `actionService` + `processFreeActionWithDmFlow` na fila | ✅ |

---

## P3 — Explícito “não agora”

| Item | Motivo |
|------|--------|
| Mundo persistente MMO | Outro produto |
| Homebrew capability system completo | Depois P0.3 |
| Reescrita total `domains/` big-bang | Por fatias (P0.5 feito) |
| Kafka | Redis/BullMQ basta |

---

## Frontend — débito paralelo

| ID | Tarefa | Skill | Status |
|----|--------|-------|--------|
| F.1 | `turnPipelineStore` + `useTurnPipeline` + fases WS | `dndai-frontend-turn-machine` | ✅ |
| F.2 | Slices: `useGameSessionSlice`, `useGameNarrationSlice`, `useGameCombatSlice` | `dndai-frontend-turn-machine` | ✅ |

---

## Comandos úteis

```bash
npm run test --prefix backend
npm run session:smoke --prefix backend
npm run chaos:smoke --prefix backend
DB_SYNC=false npm run migration:run --prefix backend   # com MySQL up
npm run dev:infra && npm run dev:backend   # Redis + worker BullMQ no mesmo processo
```

**Arquitetura P0/P2:** sempre ativa (sem flags). Ver `.cursor/rules/dndai-architecture-and-skills.mdc`.
