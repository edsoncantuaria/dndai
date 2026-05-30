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

### Pós‑P5 — Hardening operacional ✅

| ID | Tarefa | Status |
|----|--------|--------|
| P5.x.1 | Retry/backoff no BullMQ por criticidade (`criticality`) | ✅ |
| P5.x.2 | Heal de `playerRollRequest` no reconnect (WS `syncPendingRoll`) | ✅ |
| P5.x.3 | Remediação determinística quando prosa contradiz motor | ✅ |

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

### F.2 Gameplay Shell v3 ✅ (maio/2026)

| Entrega | Onde |
|---------|------|
| HeroVitalsStrip no top bar (PV, CA, atributos) | `HeroVitalsStrip.tsx`, `GameplayTopBar.tsx` |
| Desktop 3 tabs: Mapa · Campanha · Bolsa | `GameplaySidePanel.tsx` |
| Mobile 4 tabs: Narração · Mapa · Bolsa · Mais | `GameplayShell.tsx` |
| Registro WS removido da UX jogador | `isDebugWsEnabled()` · `GameplaySidePanelContent` |
| Equipar/desequipar UUID PENAI + UI explícita | `inventoryMotor.ts`, `ItemCard.tsx`, `newUseGameState` |
| Docs | `DESIGN_FRONTEND.md` §6–§9 |

---

## PENAI — GameMaster greenfield (2026)

| Fase | Status | Comando |
|------|--------|---------|
| 0 Fastify + Postgres + Temporal | ✅ código | `npm run dev:penai` · `docker compose -f docker-compose.penai.yml --profile penai up` |
| 1 Mundo + locale PT-BR | ✅ | `docs/PENAI.md` |
| 2 Temporal narração | ✅ | `npm run worker:temporal` |
| 3 UI modelos Gemini | ✅ | `GAMEPLAY_MODELS` só Gemini |
| 4 PENAI 100% gameplay (A–F) | ✅ | Inventário, loja, descanso, loot, combate P0.4 FSM, lobby v2 |
| 5 Wipe legado + auth/homebrew/v2 | ✅ | Fastify único · cofre `world_entities` · JWT WS |
| 6 Visão completa PENAI | ✅ | apply-level-up, spell SRD, world pulse, facções, clone, canon |
| **P6 GameMaster 9/10** | ✅ | adapters, memory split, rename domínio, simulation engine, GOAP, lifecycle, homebrew compat |

Testes PENAI: `npm run test --prefix backend` (39+) · `npm run penai:smoke --prefix backend`

### P6 — GameMaster 9/10 ✅

| ID | Entrega | Onde |
|----|---------|------|
| P6.1 | Camada `adapters/` (Gemini + Qdrant + contracts) | `GameMaster/adapters/` |
| P6.2 | Rename domínio (sem sufixo Penai em combat/world/character/memory/npc) | `git mv` + `GAME_MOTOR` |
| P6.3 | Memória 3 camadas | `memory/globalMemory`, `sessionMemory`, `narrativeMemory` |
| P6.4 | Pipeline enxuto + event registry | `engine/turnPipeline.ts`, `events/types.ts` |
| P6.5 | Entity lifecycle | `world/entityLifecycle.ts` |
| P6.6 | Simulation engine | `world/simulation/engine.ts` + ticks |
| P6.7 | GOAP NPCs | `npc/goap/` |
| P6.8 | Homebrew compat | `homebrew/compatibilityMatrix.ts` |
| P6.9 | Canon + facções autônomas | `canonApprovalWorkflow`, `factionTick`, rumor graph |

---

## P7 — Survival Systems (RPG por campanha) ✅

> **Não é MMO.** Economia, reputação, quests e region state são **por `game_sessions`**. Multiplayer = **P8 futuro**.

| ID | Entrega | Onde |
|----|---------|------|
| P7.0 | Docs Campanha vs Canon | `ECOSSISTEMA.md`, `PENAI.md`, `VALIDACAO_SENIOR.md` |
| P7.1 | `entityTier` + GC campanha | `WorldEntity`, `campaignGc.ts`, `campaignGcWorkflow` |
| P7.2 | Memory decay | `decayPolicy.ts`, `memoryCompactionWorkflow` |
| P7.3 | Camada sistêmica | `session_region_*`, ticks causais, `CREATURE_SLAIN` projector |
| P7.4 | Knowledge + quests + aggregate | `session_knowledge`, `session_quests`, `sessionAggregate.ts` |

Testes: `penaiCampaignSurvival.spec.ts` · `npm run test --prefix backend`

---

## P7.5 — UI Campanha + polish + prod ✅

| ID | Entrega | Onde |
|----|---------|------|
| P7.5.1 | `GET /api/v2/sessions/:id/campaign` | `sessionCampaignView.ts`, `penaiApi.ts` |
| P7.5.2 | GC por `gameClock` + rumor→knowledge | `campaignGc.ts`, `rumorTick.ts`, `lastSeenGameDay` |
| P7.5.3 | Migrations Postgres P7 | `penai:migration:run`, `database/migrations/` |
| P7.5.4 | CI Postgres integration | `.github/workflows/ci.yml` |
| P7.5.5 | Aba **Campanha** (mood, quests, reputação) | `CampanhaPanel`, `useSessionCampaign` |
| P7.5.6 | Hub onboarding PENAI | `PenaiEngineIntro`, `PenaiIntroModal` |

---

## P-AUTH / P-ROLL / P-HB / P-UI — Autoridade motor + PT-BR ✅ (maio/2026)

> Princípio: jogador **influencia** a cena; o **motor** altera estado. Ver `ECOSSISTEMA.md` §3.1 (itens 7–9).

| ID | Entrega | Onde |
|----|---------|------|
| P-UI.1/2 | Adapter PENAI: spells, raça, classe, atributos do `srdBuild` | `penaiCharacterAdapter.ts`, `formatMechanicalPack.ts` |
| P-UI.3 | Sub-raça obrigatória quando raça tem sub-raças | `stepCompleteness.ts` |
| P-UI.4 | Dock "Conjurar" fora de combate quando `knownSpells > 0` | `contextualDockActions.ts`, `GameplayActionDock.tsx` |
| P-ROLL.1 | Rolagem server-authoritative | `rollPipeline.ts`, `wsHandlers.ts`, `usePenaiTurnPipeline.ts` |
| P-AUTH.1 | Anti-claim texto livre (ouro/item/meta-roll) | `actionSense.ts` |
| P-AUTH.2 | Gemini fail-closed em produção | `adapters/gemini/actionSense.ts` |
| P-AUTH.3 | Narração não granta mecânica | `defaultLocale.ts`, `narrationGuard.ts`, `turnPipeline.ts` |
| P-AUTH.4 | WS ownership sessão | `wsHandlers.ts` (`processAction` + `submitRollResult`) |
| P-AUTH.5 | Copy ação livre na UI | `GameplayFreeActionSheet.tsx` |
| P-HB.1 | Seed bundle `srd-ptbr-core` | `seedSrdPtBrHomebrew.ts`, `npm run penai:seed:srd-ptbr` |
| P-HB.2 | Auto-install no registro/sessão/login | `penaiAuthService.ts`, `sessionService.ts` |
| P-HB.3 | `GET /api/v2/translations` | `app/routes/v2/translations.ts` |
| P-HB.4 | Frontend traduções default ON | `translationService.ts`, `translator.ts` |
| P-HB.5 | Raças/classes PT via PHB BE + overrides | `extractPhbPtBrOverrides.ts`, `buildSrdPtBrRaceClassForks.ts`, `data/srdPtBr/overrides/` |
| P-HB.6 | Traits raciais PT | `TranslatorTraits.ts`, `buildSrdPtBrTraitForks.ts` |
| P-DATA | Path único `/v2/data` + smoke ops | `docs/DATA_SRD.md`, `penai:smoke:srd-ptbr` |
| P-DATA.2 | MySQL seed deprecated + migrate script | `migrate-data.ts`, `penai:migrate:homebrew-mysql` |
| P-VAULT | Editar herói cofre (campanhas futuras) | FE `HeroVault` + `updateVaultCharacter`; BE `updateVaultHero` |

Testes: `penaiRollExploit.spec.ts` · `penaiActionSense.spec.ts` · `penaiSeedSrdPtBr.spec.ts` · `penaiCharacterAdapter.spec.ts`

---

## P9 — Verdade consultável (mundo supremo — fase 1) ✅

| ID | Entrega | Onde |
|----|---------|------|
| P9.1 | NarrativeContextDTO no turno | `memory/narrativeContextDto.ts`, `narrativePack.ts`, `promptComposer.ts` |
| P9.2 | Micro-pulso pós-mecânico | `simulation/microPulse.ts`, `wsHandlers.ts` |
| P9.3 | Macro-pulso expandido | `pulseSchedule.ts`, `combat/engine.ts`, `gameClock.ts`, `sessionQuests.ts` |
| P9.4 | `FACT_RECORDED` + proveniência | `provenanceMemory.ts`, `sessionQuests.ts` |
| P9.5 | FACTION_TICK só via projector | `factionTick.ts` |
| P9.6 | Testes | `narrativeContextDto.spec.ts`, `factionTickProjector.spec.ts`, `pulseMemory.integration.spec.ts` |

Env: `MICRO_PULSE_ON_TURN` (default on). Macro-pulso **sem** LLM por turno.

---

## P10 — Event sourcing (fase 2) ✅

| ID | Entrega | Onde |
|----|---------|------|
| P10.1 | Command bus | `commands/commandBus.ts` |
| P10.2 | Projectors (region, economy, rumor fade, supply) | `events/projector.ts` |
| P10.3 | `TIME_ADVANCED` | `gameClock.ts` |
| P10.4 | Replay CLI | `replay/replayFromEvents.ts`, `npm run penai:replay-projectors` |
| P10.5 | Ticks event-only | `regionStateTick`, `economyTick`, `rumorTick`, `microPulse` |

---

## P11 — KG + Timeline + Agentes ✅

| ID | Entrega | Onde |
|----|---------|------|
| P11.1 | `kg_nodes`, `kg_edges` | migration `1748900000000`, entities |
| P11.2 | KG via projectors | `world/kgProjector.ts`, hook em `applyEventProjection` |
| P11.3 | `timeline_entries` | `memory/timelineIndex.ts`, hook em `events/store.ts` |
| P11.4 | Agent engine | `agents/agentEngine.ts` |
| P11.5 | Cadeia economia → rumor | `world/economyChain.ts`, `SUPPLY_SHORTAGE` |

---

## P12 — World shard ✅ (read models dedicados = P12.7 futuro)

| ID | Entrega | Onde |
|----|---------|------|
| P12.1 | `world_shards` + `game_sessions.shardId` | migration, `WorldShard.ts` |
| P12.2 | Resolver shard por região | `shardResolver.ts`, `sessionService`, `travelCanon` |
| P12.3 | Background tick Temporal | `shardBackgroundWorkflow`, `startShardBackgroundWorkflow` |
| P12.4 | `bumpShardVersion` + `payload.shardId` | `shardResolver.ts`, `events/store.ts` |
| P12.5 | API campanha + UI shard | `sessionCampaignView.ts`, `CampanhaPanel` / `SharedWorldShardCard` |
| P12.6 | Política emergente mínima | `politicsState.ts`, `POLITICS_STATE_CHANGED` |
| P12.7 | `shard_region_state` / `shard_market_prices` read models | **futuro** |

---

## P8 — Multiplayer (futuro)

| Item | Motivo |
|------|--------|
| `session_members` | Party 4–5 jogadores no WS |
| Shard / Session Actor | P12 ✅ shard por região; read models shard_* = P12.7 |

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
npm run penai:seed:srd-ptbr --prefix backend
npm run session:smoke --prefix backend
npm run chaos:smoke --prefix backend
npm run penai:replay-projectors --prefix backend -- <sessionId>
npm run penai:seed:canon-npcs --prefix backend -- --region <slug> --count 20
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
