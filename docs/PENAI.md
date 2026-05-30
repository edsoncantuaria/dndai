# PENAI — Persistent Narrative Engine (GameMaster)

> **Documento canônico e vivo** do motor greenfield do Crônicas de Aventuras (maio/2026).  
> Atualize **sempre aqui** quando entregar código PENAI — não espalhar ARQUITETURA_* paralelos.  
> Complemento de ecossistema legado: [ECOSSISTEMA.md](./ECOSSISTEMA.md) (seção PENAI no topo).

**Produto:** 100% PT-BR · **Stack:** Fastify, PostgreSQL, Temporal, Redis, Qdrant (opcional), Gemini.

---

## 1. Visão

O PENAI **não** é um chatbot com prompt central.

| Camada | Papel |
|--------|--------|
| **PostgreSQL + eventos** | Fonte da verdade (sessão, mundo, viagem, entidades) |
| **PENAI_MOTOR** | Viagem, combate + rolagem 3D, lock BG3, rejeição antes da IA |
| **Memória** | SQL + Qdrant (recall) + resumos (`narrative_summaries`) |
| **Temporal** | Narração assíncrona, compactação, pulso do mundo |
| **Gemini** | Só narra/resume dentro de contrato pequeno (`NarrativeContextPack`) |

Invariante: a IA **não** altera HP, inventário nem geografia canônica.

---

## 2. O que já foi feito (resumo por fase)

### Fase 0 — Fundação (greenfield)

| Item | Status | Onde |
|------|--------|------|
| Servidor Fastify PENAI | ✅ | `backend/src/penaiServer.ts` |
| Rotas `/api/v2/*` | ✅ | `backend/src/app/routes/v2/` |
| PostgreSQL TypeORM | ✅ | `GameMaster/database/` |
| Redis pub/sub WS multi-réplica | ✅ | `GameMaster/transport/wsPubSub.ts` |
| Compose dedicado | ✅ | `docker-compose.penai.yml` |
| Env exemplo | ✅ | `backend/.env.penai.example`, `config/penaiEnv.ts` |
| `npm run dev` → `dev:penai` | ✅ | `backend/package.json` |
| Legado isolado | ⚠️ Removido do gameplay — entidades MySQL só histórico |

### Fase 1 — Mundo + locale PT-BR

| Item | Status | Onde |
|------|--------|------|
| Regiões e POIs canônicos (seed) | ✅ | `seed/seedWorldPtBr.ts` |
| `world_entities` (herói/NPC global) | ✅ | `entities/WorldEntity.ts` |
| Overlay por sessão | ✅ | `entities/SessionEntityState.ts` |
| Event log append-only | ✅ | `events/store.ts` |
| Guard narração PT-BR | ✅ | `locale/narrationGuard.ts` |
| Gemini structured narration | ✅ | `ai/geminiClient.ts` |
| Embeddings Gemini | ✅ | `ai/geminiEmbeddings.ts` |
| Homebrew por sessão (`srd-ptbr-core`) | ✅ | `SessionInstalledModule`, `sessionService.ts` |
| POI governance (teto NPCs) | ✅ | `world/poiGovernance.ts` |
| Action options PT-BR | ✅ | `world/actionOptions.ts` |

### Fase 2 — Temporal (substitui BullMQ no PENAI)

| Item | Status | Onde |
|------|--------|------|
| `narrationWorkflow` | ✅ | `temporal/workflows/narrationWorkflow.ts` |
| Activity `runTurnPipeline` | ✅ | `temporal/activities/runTurnPipeline.ts` |
| Fallback síncrono sem Temporal | ✅ | `temporal/client.ts` |
| `healthWorkflow` | ✅ | smoke |
| `worldPulseWorkflow` | ✅ | rumores/eventos → WS |
| `memoryCompactionWorkflow` | ✅ | resume → `narrative_summaries` |
| Worker | ✅ | `npm run worker:temporal` |

### P1 — Viagem e distância canônica ✅

**Requisito:** entre sessões, A→B tem **mesmos km** e **baseDurationHours**; modos (a pé, cavalo, dragão) alteram só o **tempo**.

| Item | Detalhe |
|------|---------|
| `canonical_region_links` | `distanceKm`, `baseDurationHours`, `terrainModifier`, `isLocked` |
| `travel_mode_catalog` | walk (1×), horse (2×), wagon (1.5×), dragon (8×) |
| Serviço | `GameMaster/world/travelCanon.ts` — `resolveTravelDuration`, `validateTravelIntentPenai`, `applyTravelToSession` |
| Eventos | `TRAVEL_STARTED`, `TRAVEL_COMPLETED` |
| Seed | Cidadela do Aço-Luz ↔ Vales do Norte — **200 km**, **48 h** base |
| API preview | `GET /api/v2/world/travel/preview?from=&to=&mode=` |

Exemplo canônico (48 h base, terreno 1):

| Modo | `durationHours` |
|------|-----------------|
| A pé (`walk`) | 48 |
| Cavalo (`horse`) | 24 |
| Dragão (`dragon`) | 6 |

### P2 — PENAI_MOTOR + hot path ✅

| Item | Detalhe |
|------|---------|
| `GameMaster/motor/` | `PENAI_MOTOR.validateAndApply`, `resolveRoll`, `isTurnLocked` |
| `actionIngress.ts` | Reexport legado → use `motor/` |
| WS `processAction` | Motor **antes** da narração; lock BG3 (`actionSequence > actionCursor`) |
| WS `submitRollResult` | Resolve rolagem → enfileira narração com `rollSummary` |
| Viagem | `travelCanon` + eventos `TRAVEL_*` |
| Combate | `rulesBridge` + snapshot herói Postgres; `playerRollRequest` no WS |
| `narrationComplete` | Libera turno (`actionCursor`) |

**Parcial:** FSM combate completa / inventário MySQL — bridge SRD quando `structuredIntent` + `weaponIndex`.

### P3 — Memória e reutilização ✅

| Item | Detalhe |
|------|---------|
| `memory/recall.ts` | Canon + sessão; Qdrant se `QDRANT_ENABLED=true` |
| `memory/store.ts` | Persiste `session_memories` + upsert Qdrant |
| `memory/qdrantPenai.ts` | Coleções `penai_session_memories`, `penai_world_memories`, `penai_npc_profiles` |
| `narrative_summaries` | Compactação via Temporal (a cada ~8 turnos no pipeline) |
| `findEntityCandidatesByEmbedding` | Busca NPC por similaridade |
| `findOrReuseNpcEntity` | Evita duplicar NPC com mesmo nome |
| Pack narrativo | `narrativePack.ts` usa recall + embedding |

### P4 — Entidades e mundo rico ✅ (esqueleto operacional)

| Item | Detalhe |
|------|---------|
| `factions` | Tabela + entity |
| `rumors` | Tabela + projeção de eventos |
| `world_entity_relations` | Tabela + projector |
| `events/projector.ts` | `RUMOR_SPREAD`, `RELATION_CHANGED` → estado materializado |
| NPC goals | `schemas/npcPersonality.ts` (Zod) |

**Ainda não:** simulação de mundo offline (facções ativas sem jogador), FSM de NPC, `canonApproval` em Postgres + workflow.

### P5 — UI story-feed ✅ (opt-in)

| Item | Detalhe |
|------|---------|
| `usePenaiTurnPipeline.ts` | WS `?token=<JWT>` — `storyFeed`, `worldPulse`, `gameStateUpdate`, `levelUpState` |
| `PenaiStoryFeed.tsx` | Crônica com `[HH:mm]` |
| `MundoVivoPanel.tsx` | Pulso + timeline REST de eventos |
| `penaiApi.ts` | Cliente `/v2/world/*` |
| Integração | `GameplayStoryPanel` se `NEXT_PUBLIC_PENAI_UI=true` |
| WS backend | Emite `storyFeed` no fim do `turnPipeline` |

**Ainda não:** mesa unificada 100% no WS PENAI (legado ainda usa JWT + Express).

### P6 — Verdade única + documentação ✅

| Item | Detalhe |
|------|---------|
| Regra operacional | Sessão PENAI = Postgres; **não** dual-write MySQL automático |
| `ECOSSISTEMA.md` | Seção PENAI no início |
| Este arquivo | Inventário vivo |

### Removido / fora do PENAI

- Pastas `ai-oss/`, `ai-gemini/` do backend (motor antigo)
- BullMQ no path PENAI (Temporal no lugar)
- `npm run dev:penai` ≠ `dev:legacy`

---

## 3. Estrutura de código

```
backend/src/
├── penaiServer.ts              # Bootstrap Fastify
├── config/penaiEnv.ts
├── app/
│   ├── server.ts
│   └── routes/v2/              # health, sessions, world, admin
├── GameMaster/
│   ├── database/entities/      # 17+ entities Postgres
│   ├── database/seed/          # Mapa PT-BR + rotas
│   ├── engine/
│   │   ├── turnPipeline.ts     # Turno narrativo (Gemini)
│   │   └── actionIngress.ts    # Motor no WS
│   ├── world/
│   │   ├── travelCanon.ts
│   │   ├── entityRegistry.ts
│   │   ├── mapCatalog.ts
│   │   └── poiGovernance.ts
│   ├── memory/                 # recall, store, qdrantPenai, narrativePack
│   ├── events/                 # store, projector
│   ├── transport/              # wsHandlers, wsPubSub
│   ├── ai/                     # geminiClient, geminiEmbeddings
│   ├── locale/                 # narrationGuard
│   └── sessions/sessionService.ts
└── temporal/                   # workflows + activities

src/  (frontend)
├── hooks/usePenaiSocket.ts
├── services/penaiApi.ts
└── features/gameplay/
    ├── story/PenaiStoryFeed.tsx
    └── world/MundoVivoPanel.tsx
```

---

## 4. Modelo de dados (PostgreSQL)

```mermaid
erDiagram
    game_sessions ||--o{ session_memories : has
    game_sessions ||--o{ world_events : emits
    game_sessions ||--o{ session_entity_state : tracks
    canonical_regions ||--o{ canonical_pois : contains
    canonical_regions ||--o{ canonical_region_links : links
    world_entities ||--o{ session_entity_state : appears_in
    travel_mode_catalog {
        string slug PK
        float speedMultiplier
    }
    canonical_region_links {
        uuid fromRegionId
        uuid toRegionId
        float distanceKm
        float baseDurationHours
    }
```

### Tabelas principais

| Tabela | Função |
|--------|--------|
| `game_sessions` | Sessão, `stateVersion`, `currentRegionSlug`, herói |
| `world_entities` | Identidade global (herói, NPC, facção…) |
| `session_entity_state` | Morto/apareceu **por sessão** |
| `world_events` | Event sourcing append-only |
| `world_memories` / `session_memories` | Memória canon / sessão |
| `narrative_summaries` | Camada comprimida para IA |
| `canonical_regions` / `canonical_pois` | Mapa compartilhado |
| `canonical_region_links` | Grafo de viagem (km, horas base) |
| `travel_mode_catalog` | Modos de transporte |
| `factions` / `rumors` / `world_entity_relations` | Mundo rico |
| `session_installed_modules` | Homebrew por tenant |
| `narration_completions` | Idempotência Temporal |
| `penai_users` | Usuário mínimo PENAI |

---

## 5. Fluxo de um turno (implementado)

```mermaid
sequenceDiagram
    participant C as Cliente WS
    participant WS as wsHandlers
    participant I as actionIngress
    participant T as travelCanon
    participant TW as Temporal
    participant P as turnPipeline
    participant G as Gemini

    C->>WS: processAction
    WS->>I: processActionIngress
    alt viagem
        I->>T: validate + applyTravel
        T-->>I: accepted / rejected
    end
    I-->>WS: mechanicalStateUpdate
    alt rejected
        WS-->>C: actionRejected
    else accepted
        WS->>TW: narrationWorkflow
        TW->>P: runTurnPipeline
        P->>P: recallMemory + entities
        P->>G: renderNarrationPtBr
        P-->>C: storyFeed + gameStateUpdate
    end
```

### Tipos WS (contract v2)

| Tipo | Direção | Conteúdo |
|------|---------|----------|
| `connected` | → cliente | `contractVersion: 2`, `locale: pt-BR` |
| `ping` / `pong` | ↔ | keepalive |
| `processAction` | ← cliente | `sessionId`, `payload.playerAction`, `intent`, `targetRegionSlug`… |
| `mechanicalStateUpdate` | → cliente | `ruleCheck`, `mechanical`, `currentRegionSlug` |
| `actionRejected` | → cliente | Motor bloqueou (ex.: rota inexistente) |
| `narrationQueued` | → cliente | `workflowId` |
| `storyFeed` | → cliente | `entries[]` com `timestamp`, `content`, `consequences` |
| `gameStateUpdate` | → cliente | `logEntries`, `actionOptions` |
| `worldPulse` | → cliente | Rumores + snapshot região |

---

## 6. API REST v2

Base: `http://localhost:8071/api` (prefixo `/api` + rotas abaixo).

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/v2/health` | Saúde API |
| GET | `/v2/admin/health` | Postgres, Redis, Temporal, Qdrant |
| POST | `/v2/sessions` | Nova sessão (`nome`, `heroName?`) + módulo `srd-ptbr-core` |
| GET | `/v2/sessions` | Lista sessões do `userId` (Postgres) |
| GET | `/v2/sessions/:id` | Detalhe da sessão |
| GET | `/v2/sessions/:id/mechanical` | Pack mecânico (character HP, combate, loja, loot) |
| GET | `/v2/world/regions` | Lista regiões canônicas |
| GET | `/v2/world/entities/search` | Candidatos NPC/entidade |
| GET | `/v2/world/travel/preview` | `?from=&to=&mode=` — km fixos, horas por modo |
| GET | `/v2/world/travel/modes` | Catálogo de transporte |
| GET | `/v2/world/sessions/:id/events` | Timeline `world_events` |

### Exemplo — preview de viagem

```bash
curl "http://localhost:8071/api/v2/world/travel/preview?from=cidadela-do-acoluz&to=vales-do-norte&mode=horse"
```

### Exemplo — ação de viagem no WS

```json
{
  "type": "processAction",
  "sessionId": 1,
  "payload": {
    "intent": "travel",
    "targetRegionSlug": "vales-do-norte",
    "travelMode": "horse",
    "playerAction": "Cavalgamos rumo aos Vales do Norte."
  }
}
```

---

## 7. Bootstrap local

```bash
# Infra (Postgres 5433, Redis 6381, Temporal, Qdrant 6335)
docker compose -f docker-compose.penai.yml --profile penai up -d

cd backend
cp .env.penai.example .env   # ajuste GEMINI_API_KEY
export PENAI_DB_SYNC=true
export PENAI_SEED_ON_BOOT=true
npm run dev:penai

# Worker Temporal (outro terminal)
npm run worker:temporal
```

### Variáveis importantes

| Variável | Default | Uso |
|----------|---------|-----|
| `DATABASE_URL` | `postgres://penai:...@localhost:5433/penai` | Postgres |
| `REDIS_URL` | `redis://localhost:6381` | Pub/sub WS |
| `TEMPORAL_ADDRESS` | `localhost:7233` | Filas |
| `TEMPORAL_DISABLED` | `false` | Se true, narração síncrona no handler |
| `SKIP_TEMPORAL_WORKER` | `false` no dev local | `true` na API em compose (worker separado) |
| `PENAI_DB_SYNC` | — | `true` cria tabelas (dev) |
| `PENAI_SEED_ON_BOOT` | — | Seed mapa + rotas + modos |
| `QDRANT_ENABLED` | `false` | Liga recall vetorial |
| `GEMINI_API_KEY` | — | Narração + embeddings |

### Frontend (UI PENAI opt-in)

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8071/api
NEXT_PUBLIC_PENAI_UI=true
# opcional: NEXT_PUBLIC_PENAI_WS_URL=ws://localhost:8071/ws
```

---

## 8. Temporal

| Workflow | Task queue | `workflowId` / notas |
|----------|------------|----------------------|
| `narrationWorkflow` | `penai-narration` | `narration:{sessionId}:{actionSequence}` |
| `memoryCompactionWorkflow` | `penai-narration` | `memory:{sessionId}:{toActionSequence}` |
| `worldPulseWorkflow` | `penai-narration` | por sessão |
| `canonApprovalWorkflow` | `penai-narration` | `canon:{proposalId}` |
| `healthWorkflow` | `penai-narration` | smoke |

Produção pode usar fork [github.com/edsoncantuaria/temporal](https://github.com/edsoncantuaria/temporal). Dev: `temporalio/auto-setup` no compose.

---

## 9. Testes e smoke

```bash
cd backend
REDIS_URL=mock npm run test          # 8 testes: locale, travel, ingress, NPC schema
npm run penai:smoke                  # narrationGuard + actionOptions
npm run temporal:smoke               # se Temporal up
```

Arquivos de teste:

- `__tests__/penai.spec.ts` — guard PT-BR, action options
- `__tests__/penaiTravel.spec.ts` — duração canônica por modo
- `__tests__/penaiIngress.spec.ts` — classificação de intent
- `__tests__/npcPersonality.spec.ts` — schema goals

---

## 10. Mapa canônico (seed atual)

| Região | Slug | POIs (ex.) |
|--------|------|------------|
| Cidadela do Aço-Luz | `cidadela-do-acoluz` | Ponte Sul, Taverna Lua Rubra |
| Vales do Norte | `vales-do-norte` | Posto da Muralha |

**Rota:** Cidadela ↔ Vales — 200 km, 48 h base (bidirecional na tabela de links).

Sessão nova inicia em `cidadela-do-acoluz` com módulo `srd-ptbr-core` instalado.

---

## 11. PENAI_MOTOR (API)

Pacote: [`backend/src/GameMaster/motor/`](backend/src/GameMaster/motor/)

### Validação “a ação faz sentido?” (`actionSense`)

**Antes** de viagem/combate/narração, `validateActionSense` rejeita ações inválidas:

| Camada | O que bloqueia |
|--------|----------------|
| Estrutural | Texto vazio, “ok/sim”, meta-chat, OOC, impossibilidades óbvias |
| Contexto | Viagem para região inexistente, já na região, combate sem herói, social sem alvo |
| Coerência | `payload.intent` não combina com o texto |
| Perícia | Texto livre com verbo de teste → refinado para `skill-check` + rolagem |
| Gemini (opcional) | Ações `free`/`social` — julgamento curto de plausibilidade na cena |

Rejeição → WS `actionRejected` com `reason` + `hint` (PT-BR). **A IA não narra** ações rejeitadas.

```ts
import { PENAI_MOTOR } from './GameMaster/motor/index.js';

await PENAI_MOTOR.validateActionSense({ sessionId, userId, playerAction, payload });
await PENAI_MOTOR.isTurnLocked(sessionId);
await PENAI_MOTOR.validateAndApply({ sessionId, userId, playerAction, actionId, actionSequence, payload });
await PENAI_MOTOR.resolveRoll({ sessionId, userId, requestId, rolls });
await PENAI_MOTOR.completeNarration(sessionId, actionSequence);
```

| vs Legado | PENAI_MOTOR | Express `actionIntentService` |
|-----------|-------------|-------------------------------|
| Banco | PostgreSQL | MySQL |
| Viagem | `travelCanon` | `rules/travel` + `regionService` |
| WS | `/ws?userId=` | JWT `webSocketServer` |

---

## 12. Fluxo BG3-like + rolagem 3D

Alinhado a [`DESIGN_FRONTEND.md`](./DESIGN_FRONTEND.md) §7.

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> rolling: playerRollRequest
    rolling --> mechanical: submitRollResult
    idle --> mechanical: acao sem rolagem
    mechanical --> narrating: narrationQueued
    narrating --> idle: narrationComplete
```

### Eventos WS v2 (mesa)

| Tipo | Quando |
|------|--------|
| `mechanicalStateUpdate` | Motor aplicou (incl. `playerRollRequest`) |
| `playerRollRequest` | Abre `DiceRollModal` + dice-box |
| `submitRollResult` | Cliente → servidor após animação 3D |
| `narrationQueued` | Fase `narrating` / InputGate `LOCKED_NARRATING` |
| `narrationComplete` | Libera dock (`actionCursor` atualizado) |
| `actionRejected` | Viagem inválida ou turno bloqueado (`TURN_LOCKED`) |

### Frontend

| Env | Uso |
|-----|-----|
| `NEXT_PUBLIC_PENAI_WS=true` | Mesa usa `usePenaiTurnPipeline` + um único WS |
| `NEXT_PUBLIC_PENAI_UI=true` | Painéis Mundo Vivo + story feed (opcional extra) |

Hooks: `usePenaiTurnPipeline`, `usePenaiGameSession`, `PenaiGameplayContext`, `lib/penaiEngine.ts` (`markSessionAsPenai`), `lib/penaiCharacterAdapter.ts` (load v2 sem MySQL).

**Lobby v2:** com `NEXT_PUBLIC_PENAI_WS !== 'false'`, criar/continuar sessão usa só `POST/GET /api/v2/sessions` + `/mechanical` — zero `GET /api/sessoes` ou `/api/characters` no load.

---

## 13. O que ainda falta (gaps honestos)

| Área | Situação |
|------|----------|
| Sessões MySQL antigas | **Sem migração automática** — ver [`PENAI_MIGRATION.md`](./PENAI_MIGRATION.md) |
| Wipe MySQL `entities/` + `services/` legado | Marcado como arquivo morto; remoção física em fase posterior |
| Replay mecânico completo | MVP `GET /v2/sessions/:id/replay/mechanical` — não rebuild total |
| Migração homebrew MySQL→Postgres | Sem script one-click |

### Visão completa — implementado (maio/2026)

| Área | Onde |
|------|------|
| Docker dev Postgres | `docker-compose.dev.yml` + `docker-compose.penai.yml` |
| Level-up apply | `apply-level-up` em `structuredApply.ts` + `applyLevelUpPenai.ts` |
| Magias SRD | `validateSpellAttack` via `rulesBridge.ts` + `spellSlotSeedPenai.ts` |
| actionOptions contextuais | `contextualActionOptions.ts` |
| World pulse agendado | Viagem (`TRAVEL_COMPLETED`) e descanso longo — **não** a cada turno |
| Facções persistidas | `SessionFactionState` + projector `FACTION_*` |
| NPC FSM goals | `npcFsmPenai.ts` + `sessionOverlay` |
| Qdrant default-on | `penaiEnv.ts` + `storeWorldMemory` |
| Clone rico | `clonePenaiSession` (módulos, elenco, inventário) |
| Canon jogador | `POST /v2/sessions/:id/canon/proposals` + reject admin |
| Express órfãos removidos | `controllers/`, `middlewares/`, `routes/` |

### Implementado (gaps anteriores — maio/2026)

| Área | Onde |
|------|------|
| Auth JWT no WS | `/ws?token=` em `wsHandlers.ts` |
| Billing + licenças PenaiUser | `penaiAiBillingService.ts`, `/api/v2/licenses` |
| Level-up WS | `levelUpState` em `gameStateUpdate` + `heroXpPenai.ts` |
| Magia estruturada | `spell-attack` em `rulesBridge.ts` + `validateAndApply.ts` |
| Homebrew no motor | `moduleResolver.assertResourceAllowedForSession` |
| Cofre SRD → ficha | `loadPenaiCharacterSnapshot` lê `stats.srdBuild` |
| Journal UI | `PenaiJournalPanel`, `GET /v2/sessions/:id/journal` |
| Cast PATCH | `PATCH /v2/sessions/:id/cast/:memberId` |
| Premium-map sessões | `fetchPenaiSessions()` |
| Mundo offline + NPC FSM | `worldOfflinePenai.ts`, `npcFsmPenai.ts`, `worldPulseActivity` |
| TTS v2 | `/api/v2/tts/*` |
| Rotas Express órfãs | `backend/src/routes/` removido |

### Implementado (PENAI 100% + P0.4 combate)

| Área | Onde |
|------|------|
| Calendário / relógio narrativo | `game_sessions.gameClock` + avanço em viagem/descanso |
| Lobby v2 | `GET/POST /api/v2/sessions`, `usePenaiGameSession`, frontend PENAI-only |
| Mapa / resumo sessão | `GET /api/v2/sessions/:id/world-map`, `/summary` |
| Inventário Postgres | `hero_inventory_items`, `GameMaster/character/` |
| Descanso / loot / equip | `motor/structuredApply.ts` + `rules/*` |
| Loja | `GameMaster/shop/shopPenai.ts` |
| Combate FSM P0.4 | `combatPhasePenai.ts`, `combatPenai.ts` (iniciativa d20, fases canônicas) |
| Roll chain attack→damage | `rules/rollResolutionCore.ts`, `penaiRollResolution.ts`, `rollPipeline.ts` (`deferNarration`) |
| HP herói fonte única | `sessionStatsSnapshot` ↔ `SessionCombatant` via `syncHeroHpPenai.ts` |
| Gate narração combate | `shouldAllowPenaiCombatNarration` em `turnPipeline.ts` |
| Intents turno | `next-turn`, `advance-npc-turn` em `structuredApply.ts` |
| Rolagem Redis | `penaiRollStore.ts` (fallback memória se `REDIS_URL=mock`) |
| WS `syncPendingRoll`, `gameStateUpdate` | `wsHandlers.ts` |
| API mechanical | `GET /api/v2/sessions/:id/mechanical` |
| Mesa default PENAI | `NEXT_PUBLIC_PENAI_WS=true` (`.env.example`) |
| Legado gameplay off | `PENAI_ONLY=true` no Express WS |

---

## 14. Comandos rápidos

---

| Comando | Função |
|---------|--------|
| `npm run dev:penai` | API Fastify (:8071) — **único stack de gameplay** |
| `npm run worker:temporal` | Worker fila `penai-narration` |
| `npm run test` | Testes PENAI (19+) |
| `npm run penai:smoke` | Smoke leve |

---

## 15. Referências cruzadas

| Documento | Conteúdo |
|-----------|----------|
| [ECOSSISTEMA.md](./ECOSSISTEMA.md) | Stack legado + tabela PENAI vs Express |
| [DESIGN_FRONTEND.md](./DESIGN_FRONTEND.md) | GameplayShell, turn machine UI |
| [TODO-ARQUITETURA.md](../TODO-ARQUITETURA.md) | Roadmap geral; bloco PENAI |
| `GameMaster/README.md` | Ponteiro para este arquivo |

---

*Última atualização: maio/2026 — PENAI_MOTOR, WS submitRollResult, BG3 InputGate, dice-box no path PENAI, canon Postgres + workflow.*
