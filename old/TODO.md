# Crônicas de Aventuras — Plano de Refatoração

> **🔥 Prioridade atual (arquitetura produção):** ver **`TODO-ARQUITETURA.md`** — P0 desacoplamento motor×IA, event log, skills em `.cursor/skills/`, agentes em `.cursor/AGENTS.md`.

> **Objetivo:** Refazer o projeto do zero *em espírito*, reaproveitando o núcleo maduro. Integrar a [5e-srd-api](https://github.com/5e-bits/5e-srd-api) como fonte canônica de dados SRD, permitir homebrew derivado dela, e corrigir os problemas de IA, persistência e UX que impedem uma experiência fluida.

**Última validação:** 2026-05-23

---

## 🎨 REDESIGN UI/UX — INICIATIVA PARALELA (NOVO)

**Remodelação visual completa** do app (mobile + desktop), inspirada em [Dungeons & Dragons](https://www.dungeonsanddragons.com/) e na [Intro Experience](https://www.dungeonsanddragons.com/intro-experience/).

| Documento | Conteúdo |
|-----------|----------|
| **[`TODO-UI-REDESIGN.md`](TODO-UI-REDESIGN.md)** | Roadmap completo: design system, todas as telas, gameplay (4 opções + livre), dados 3D, mapas, inventário, homebrew, fases e prazos |

**Resumo:** novo visual “aventura fantástica”; **backend/motor/WS intactos**; **dado 3D real mantido** (`DiceRollModal`); telas a refazer: intro, auth, hub, wizard, jogo, painéis, homebrew.

**Status:** planejamento ✅ — implementação ⬜️ (começar por Design System + `GameplayShell` mock).

---

## 1. Validação do que temos hoje

### 1.1 O que está sólido e deve ser reaproveitado

| Área | Arquivos / módulos | Notas |
|------|-------------------|-------|
| **Motor de regras D&D 5e** | `backend/src/rules/*`, `actionIntentService`, `ruleResolutionService` | Intents (`weapon-attack`, `spell-attack`, `damage`, `healing`, `consume-item`, `skill-check`, descanso) com deltas aplicados *antes* da IA. Status ✅ em `docs/rules/status.md`. |
| **Contratos WS/REST** | `webSocketServer.ts`, `actionRoutes.ts`, `docs/rules/contracts.md` | Loop principal é **WebSocket `processAction`**, não REST `/narrar`. |
| **Entidades TypeORM (36)** | `backend/src/entities/*` | Modelo de domínio rico: personagem, inventário, combate, sessão, homebrew, regiões, memória. |
| **Criação de personagem** | `src/components/NewCreationCharacter/*`, `src/hooks/character-creation/*` | Wizard 8 passos funcional; consome `/api/data/:resource`. |
| **Dados unificados + homebrew** | `unifiedDataService`, `homebrewService`, `Homebrew/*` | Merge oficial + homebrew instalado por usuário/sessão. |
| **Mapa e POIs** | `regionService`, `WorldMapModal`, `premium-map/page.tsx` | Grafo de regiões, links, POIs, snapshots por sessão. |
| **Snapshots SRD offline** | `data/dnd5eapi/normalized/`, `scripts/sync-dnd5eapi.js` | Fallback quando API externa cai. |
| **UI de jogo** | `GameContainer`, `GameScreen`, `Inventory`, `Spellbook`, `NewCombatTracker`, `DiceRollModal` | Interface completa; precisa consolidar legado. |
| **Pipeline IA (base)** | `aiSanitizer`, `gmValidator`, `game/prompts/*`, `gameSchemas.ts` | Arquitetura correta (motor autoritativo + IA narrativa); implementação precisa simplificar. |
| **Memória narrativa** | `storyService`, `vectorMemoryService`, `storyDirector` | Qdrant opcional + resumos/timeline/facts. |
| **Multimídia** | `ttsService`, `imageGenerationService` | TTS e imagens via MinIO. |

### 1.2 O que está quebrado, inconsistente ou incompleto

| Problema | Evidência | Impacto |
|----------|-----------|---------|
| **IA narrando fora de ordem** | `docs/rules/audit.md` | Roll requests fantasmas, narrativa antes da rolagem, logs duplicados. |
| **Sessões clonadas em loop** | Audit §0.1 | Refresh cria personagem novo; progresso não persiste. |
| **Timeouts falsos (15s)** | Audit §2.1 | Cliente desiste antes da IA responder (>60s). Parcialmente corrigido. |
| **`stateVersion` não incrementa** | Audit | Deltas não refletidos; dessincronia frontend/backend. |
| **REST `/api/narrar` morto** | `narrarRoutes` não montado em `server.ts` | README e `gameService.processPlayerAction` desatualizados. |
| **Arquivos gigantes** | `aiService.ts` (~3100 linhas), `narrarService.ts` (~2100), `newUseGameState.ts` (~1200) | Difícil manter, testar e melhorar prompts. |
| **Duplicação de código** | `useCharacterCreator.ts` (raiz vs `character-creation/`), `CombatTracker` vs `NewCombatTracker` | Confusão e bugs silenciosos. |
| **URLs hardcoded** | `apiClient.ts`, `webSocketService.ts` → produção fixa | Dev local quebrado sem editar código. |
| **`synchronize: true` no TypeORM** | `data-source.ts` | Risco em produção; sem migrações formais. |
| **Delta inventário positivo** | `characterStateService` | Adicionar itens via delta não implementado. |
| **Docs desatualizados** | `README.md`, `docs/blueprint.md` | Descrevem fluxo REST/localStorage antigo. |
| **Testes por módulo** | `status.md` marca ⬜️ Jest | Existem testes `node --test` integrados, mas cobertura fina falta. |

### 1.3 Integração atual com D&D API

- **Hoje:** consome `https://www.dnd5eapi.co/api` — que é a instância pública do projeto [5e-bits/5e-srd-api](https://github.com/5e-bits/5e-srd-api).
- **Paths atuais:** `/api/races`, `/api/classes` (sem prefixo `/2014`).
- **Paths oficiais novos:** `/api/2014/races`, `/api/2014/classes`, etc.
- **Snapshots locais:** `data/dnd5eapi/normalized/` + Redis cache persistente.
- **Camada unificada:** `GET /api/data/:resource` merge API + homebrew.

> **Conclusão:** não é trocar de API — é **formalizar a dependência**, self-hostar quando possível, versionar (`/2014`), e construir homebrew *em cima* dos schemas SRD.

---

## 2. Visão alvo (essência preservada)

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                        │
│  Criação Personagem │ Game HUD │ Mapa │ Homebrew Studio         │
└────────────┬───────────────────────────────┬────────────────────┘
             │ REST                           │ WebSocket
             ▼                                ▼
┌──────────────────────────── BACKEND ────────────────────────────┐
│  Auth │ Sessões │ Personagens │ Dados │ Homebrew │ Regiões      │
├─────────────────────────────────────────────────────────────────┤
│  MOTOR DE REGRAS (autoritativo)                                  │
│  intents → validação → rolagem → deltas → persistência          │
├─────────────────────────────────────────────────────────────────┤
│  NARRADOR IA (Gemini)                                            │
│  contexto enxuto → JSON estruturado → só narra o que o motor    │
│  já decidiu; memória via facts + resumos + vetores              │
└────────────┬───────────────────────────────┬────────────────────┘
             │                                │
             ▼                                ▼
     ┌──────────────┐              ┌──────────────────┐
     │ MySQL        │              │ 5e-srd-api       │
     │ inventário,  │              │ (self-hosted ou  │
     │ sessão, mapa │              │  dnd5eapi.co)    │
     └──────────────┘              └──────────────────┘
             │
             ▼
     ┌──────────────┐
     │ Redis + Qdrant│
     │ cache + memória│
     └──────────────┘
```

### Princípios de redesign

1. **Motor manda, IA narra** — a IA nunca altera HP, inventário ou combate diretamente; só descreve deltas já aplicados.
2. **Uma fonte de dados SRD** — adapter único para 5e-srd-api com fallback offline.
3. **Homebrew = fork SRD** — criar raça/classe/magia derivando de um recurso oficial, com `sourceId` + overrides.
4. **Memória em camadas** — curto prazo (últimas N ações), médio (facts/journal/quests), longo (resumos + vetores).
5. **Onde estou importa** — região atual + POIs + snapshot de mapa entram no prompt de forma compacta.
6. **Código pequeno e testável** — quebrar god-files; cada módulo com testes.

---

## 3. Abordagens consideradas

| Abordagem | Prós | Contras | Veredicto |
|-----------|------|---------|-----------|
| **A. Refatoração incremental** | Reaproveita 80% do código; menor risco | Dívida técnica residual | ✅ **Recomendada** |
| **B. Rewrite total (monorepo novo)** | Arquitetura limpa | Perde meses de motor/UI; alto risco | ❌ |
| **C. Manter dnd5eapi.co sem self-host** | Zero infra extra | Sem controle; sem extensão local | ❌ para homebrew avançado |

---

## 4. Fases de implementação

### Fase 0 — Estabilização (urgente, ~1 semana)

Corrigir bugs que impedem jogar antes de refatorar features.

- [x] **0.1** Corrigir loop de clone de sessão/personagem ao reabrir jogo
  - `templateCharacterId` no clone + `findLatestSessionForTemplate` + matching no cofre
- [x] **0.2** Garantir persistência de `stateVersion` após cada turno de IA
  - `incrementStateVersion` após commit; WS reutiliza `response.stateVersion`
- [x] **0.3** Eliminar roll requests fantasmas da IA
  - Motor exclusivo para rolagens; sanitizer respeita `suppressRollRequest` em combate
- [x] **0.4** Alinhar timeouts cliente/servidor (120s)
  - Eventos `narrationLoading`/`narrationComplete` + `ACTION_TIMEOUT_MS=120000`
- [x] **0.5** Configurar URLs por ambiente
  - `.env.example` + defaults `localhost:8071`
- [x] **0.6** Alinhar README com WebSocket; remover REST `/narrar` do frontend

**Critério de done:** jogar 10 turnos seguidos, fechar browser, reabrir, estado intacto.

---

### Fase 1 — Camada de dados SRD (5e-srd-api) (~1–2 semanas)

- [x] **1.1** Docker Compose com fork local `./5e-srd-api` → `docker-compose.srd.yml`
- [x] **1.2** Adapter `backend/src/services/srdApiAdapter.ts` + `dndApiService` migrado
- [x] **1.3** Script `scripts/sync-srd-api.js` → `data/srd/2014/` (+ espelho legado)
- [x] **1.4** Paths de snapshot unificados (`srdSnapshotPaths.ts`, catalog, import)
- [x] **1.5** Health check `/api/health` inclui status da SRD API
- [x] **1.6** Testes offline em `backend/src/__tests__/srdApiAdapter.spec.ts`
- [ ] **1.7** Atualizar `openapi.yaml` com spec 2014 completa (opcional / incremental)

**Reaproveitar:** `unifiedDataService`, Redis cache, normalizadores existentes, traduções PT (`backend/data/Translator*.js`).

---

### Fase 2 — Homebrew derivado do SRD (~1–2 semanas) ✅

- [x] **2.1** Schema `HomebrewContent` com `sourceKind`, `sourceResource`, `sourceIndex`, `locale`
- [x] **2.2** UI no Homebrew Studio: original / tradução / fork + picker SRD (`SrdSourcePanel`)
- [x] **2.3** `unifiedDataService`: merge via `homebrewMergeService` (translation/fork/original)
- [x] **2.4** Validador + endpoints `/homebrew/srd/*` e `POST /homebrew/from-srd`
- [x] **2.5** Export/import de bundles (`GET /bundles/:id/export`, `POST /bundles/import`)
- [x] **2.6** AI creator: prompt com schema SRD oficial (original / tradução / fork)

**Reaproveitar:** `src/components/Homebrew/*`, `homebrewRoutes`, `create-homebrew` flow Genkit.

---

### Fase 3 — Refatoração do pipeline de IA (~2–3 semanas) ✅

Objetivo: respostas mais coerentes, rápidas e baratas.

- [x] **3.1** Módulos em `backend/src/ai/` (client, responseParser, promptSections, metrics, responseValidator)
- [x] **3.2** Orquestrador em `backend/src/narration/phaseOrchestrator.ts` (extraído de `narrarService`)
- [x] **3.3** Prompt enxuto por blocos (`buildCompactPromptSections` + budgets em `constants.ts`)
- [x] **3.4** Modo `AI_PIPELINE_MODE=narration_only` (só prosa + actionOptions; motor cuida do estado)
- [x] **3.5** Estado no motor por padrão (`narration_only` default; `motorStateBridge.ts`; IA não persiste `updatedCharacter`/`combatState`)
- [x] **3.6** Métricas: `GET /api/metrics/ai-pipeline` + registro de repair/latência
- [x] **3.7** Testes de contrato JSON (`aiPipeline.spec.ts`)

**Reaproveitar:** `game/prompts/*`, `aiSanitizer`, `gmValidator`, `scenarioPlaybooks`, schema Zod.

---

### Fase 4 — Memória e "onde estou" (~1–2 semanas) ✅

- [x] **4.1** Modelo de memória em camadas (`SessionFact` entity + `sessionFactService.ts`)
- [x] **4.2** `contextBuilder.ts` injeta memória por relevância (região, NPCs, quests, recall vetorial)
- [x] **4.3** IA retorna `newFacts[]` — backend valida e persiste (`NarrativePhaseResponseSchema`)
- [x] **4.4** "Onde estou" no HUD (`LocationHud.tsx` + `WorldMapModal`)
- [x] **4.5** Transição de região via intent `travel` + `regionTransitionService` (motor → IA narra)
- [x] **4.6** Daily recap integrado com `atomicFacts` e `storySummary` (`DailyRecapPanel`)

**Reaproveitar:** `storyService`, `vectorMemoryService`, `regionService`, `WorldMapModal`, entidades `JournalEntry`, `Quest`, `StorySummary`.

---

### Fase 5 — Inventário e persistência no banco (~1 semana) ✅

- [x] **5.1** Inventário autoritativo no MySQL (`character_items` + intents `equip-item` / `drop-item` / `claim-loot`)
- [x] **5.2** Delta positivo de inventário em `characterStateService` + `addOrIncrementCharacterItem`
- [x] **5.3** Moedas em `Character.coins` + `applyCurrencyDelta` / merge em `safeMerge`
- [x] **5.4** Peso/carga no `gameStateUpdate` via `getAuthoritativeInventoryState`
- [x] **5.5** UI sem mutação otimista de equipar; intents estruturados para loot/equipar

**Reaproveitar:** `inventoryService`, `CharacterItem` entity, `Inventory.tsx`.

---

### Fase 6 — Consolidação frontend (~1 semana) ✅

- [x] **6.1** Remover duplicatas (`useCharacterCreator` raiz, `CombatTracker`, `NewStep5_Equipment*`, `aiService.ts.old`)
- [x] **6.2** Split `newUseGameState` → `src/hooks/game/` (`useGameSession`, `useGameActions`, `useGameWebSocket`, `ambientSound`, `characterPatch`, `loadingLabels`)
- [x] **6.3** `AuthGate` — fluxo auth → licença → API key → jogo
- [x] **6.4** Banner + CTA "Abrir dados" no `NewNarrativeLog` quando rolagem pendente
- [x] **6.5** `resolveLoadingState` — "Mestre pensando..." vs "Aguardando rolagem" no HUD

**Reaproveitar:** todos os componentes de UI maduros; só reorganizar hooks.

---

### Fase 7 — Infra, testes e docs (~1 semana) ✅

- [x] **7.1** Migrações TypeORM (`Phase4And5Schema`, `DB_SYNC` dev / migrações em prod)
- [x] **7.2** `docker-compose.yml` — MySQL, Redis, SRD API, perfil `app` (backend + frontend)
- [x] **7.3** Testes: `promptSections`, `wsActionPipeline`, suite existente (48 testes)
- [x] **7.4** `README.md`, `docs/architecture.md`, `docs/archive/blueprint.md`
- [x] **7.5** CI `.github/workflows/ci.yml` + `scripts/verify-srd-snapshot.js`

---

## 5. Matriz de reaproveitamento 

| Componente | Ação | Esforço |
|------------|------|---------|
| Motor de regras (`backend/src/rules/`) | **Manter** | — |
| Entidades TypeORM | **Manter** (+ campos homebrew fork) | Baixo |
| WebSocket + contratos | **Manter** (+ fixes Fase 0) | Médio |
| Criação de personagem (self-service **Manter** | — |
| UI de jogo (componentes) | **Manter** | — |
| `unifiedDataService` | **Evoluir** (adapter SRD) | Médio |
| `dndApiService` | **Substituir** por `srdApiAdapter` | Médio |
| `aiService.ts` | **Evoluir** (módulos extraídos; split completo no backlog §11) | Médio |
| `narrarService.ts` | **Evoluir** (orquestrador + motorStateBridge; split no backlog §11) | Médio |
| `newUseGameState.ts` | **Reescrever** (split em hooks) | Médio |
| Homebrew UI | **Evoluir** (fork SRD) | Médio |
| Mapa/regiões | **Manter** | — |
| Memória (story/vector) | **Evoluir** | Médio |
| README / blueprint | **Reescrever** | Baixo |
| REST `/api/narrar` | **Remover** ou redirecionar para action pipeline | Baixo |

---

## 6. Stack alvo (sem mudanças drásticas)

| Camada | Tecnologia | Mudança |
|--------|-----------|---------|
| Frontend | Next.js 15, React, Tailwind, ShadCN | Consolidar hooks |
| Backend | Express, TypeORM, Node 20 | Split services |
| Banco | MySQL | + migrações |
| Cache | Redis | Mantém |
| Vetores | Qdrant (opcional) | Mantém |
| IA | Gemini via `@google/genai` | Prompts enxutos |
| Dados SRD | **5e-srd-api self-hosted** | Novo adapter |
| Realtime | WebSocket | Mantém |

---

## 7. Ordem de execução recomendada

```
Fase 0 (estabilizar) ──→ Fase 1 (SRD API) ──→ Fase 5 (inventário)
                              │
                              ▼
                         Fase 2 (homebrew)
                              │
                              ▼
                         Fase 3 (IA) ──→ Fase 4 (memória/mapa)
                              │
                              ▼
                         Fase 6 (frontend) ──→ Fase 7 (infra/docs)
```

**Rationale:** sem Fase 0, qualquer melhoria de IA ou dados é inútil (estado não persiste). SRD API antes de homebrew. IA depois que motor e dados estão estáveis.

---

## 8. Métricas de sucesso

Legenda: **auto** = regressão em `successMetrics.spec.ts` + suites relacionadas; **manual** = [`docs/VALIDATION_CHECKLIST.md`](docs/VALIDATION_CHECKLIST.md).

- [ ] Reabrir sessão mantém HP, inventário, região e journal — **manual** (+ `stateVersion` / WS em `actionFlow.e2e.spec.ts`)
- [x] Zero roll requests não solicitados — **auto** (`successMetrics.spec.ts`, `aiSanitizer.spec.ts`, `rollQueue.spec.ts`)
- [x] Prompt enxuto (soft cap &lt; 9500 tokens estimados) — **auto** (`successMetrics.spec.ts` §8.3); latência &lt; 30s — **manual**
- [x] Homebrew fork SRD (ex.: Fireball aprimorada) — **auto** (`successMetrics.spec.ts`, `homebrewMergeService.spec.ts`); fluxo UI completo — **manual**
- [x] Mapa: região e POIs no resumo de prompt — **auto** (`successMetrics.spec.ts`, `memoryLayer.spec.ts`); UI do mapa — **manual**
- [x] Facts: validação e formatação — **auto** (`successMetrics.spec.ts`, `memoryLayer.spec.ts`); persistência entre sessões — **manual**

---

## 9. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| 5e-srd-api muda schema | Adapter + snapshots offline + testes de contrato |
| Refatoração de IA quebra gameplay | Feature flag `USE_NEW_NARRATION_PIPELINE`; rollout gradual |
| God-files durante transição | Manter interfaces; migrar módulo por módulo |
| Qdrant indisponível | Memória funciona sem vetores (facts + resumos) |

---

## 10. Próximo passo imediato

**Roadmap principal concluído (Fases 0–7).** Ver §11 para backlog de splits grandes (`aiService`, `narrarService`).

```bash
docker compose -f docker-compose.srd.yml up -d
cd backend && npm run dev
cd .. && npm run dev
# Padrão: AI_PIPELINE_MODE=narration_only (estado no motor)
```

---

## 11. Backlog — refinamentos do pipeline IA

Itens adiados após a Fase 3; não bloqueiam a Fase 4.

- [x] Extrair módulos de `narrarService.ts` → `contextBuilder`, `turnProcessor`, `persistence`, `regionMapValidation`, `logPayload`, `worldStateSnapshot`
- [x] Fachadas em `backend/src/ai/` — `instructions.ts`, `gameUpdate.ts` (split completo de `aiService` permanece opcional)
- [x] Documentar `AI_PIPELINE_MODE` no README + [`docs/AI_PIPELINE.md`](docs/AI_PIPELINE.md)
- [ ] Validar gameplay end-to-end com `narration_only` — checklist em [`docs/VALIDATION_CHECKLIST.md`](docs/VALIDATION_CHECKLIST.md) (§8)
- [x] Extrair `createPrompt` → [`backend/src/ai/promptAssembler.ts`](backend/src/ai/promptAssembler.ts) (`promptAssembler.spec.ts`)

---

*Documento vivo — atualizar checkboxes conforme progresso.*
