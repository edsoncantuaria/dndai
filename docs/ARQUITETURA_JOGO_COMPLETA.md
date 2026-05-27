# Arquitetura completa do jogo — Crônicas de Aventuras

Documento único e autocontido que descreve **toda** a arquitetura do produto: frontend, backend, motor de regras, tempo real, dados, mundo, combate, sessões e infraestrutura. Complementa o documento de IA (`ARQUITETURA_IA_COMPLETA.md` no mesmo diretório), que detalha exclusivamente prompts, schemas e pipelines do Mestre virtual.

**Última revisão alinhada ao código:** maio de 2026.

---

## Sumário

1. [O que é o produto](#1-o-que-é-o-produto)
2. [Stack tecnológica](#2-stack-tecnológica)
3. [Visão em camadas](#3-visão-em-camadas)
4. [Frontend: estrutura e estágios](#4-frontend-estrutura-e-estágios)
5. [Frontend: estado e hooks](#5-frontend-estado-e-hooks)
6. [Frontend: UI de gameplay](#6-frontend-ui-de-gameplay)
7. [Autenticação e licença](#7-autenticação-e-licença)
8. [Backend: servidor e rotas HTTP](#8-backend-servidor-e-rotas-http)
9. [WebSocket: protocolo em tempo real](#9-websocket-protocolo-em-tempo-real)
10. [Ciclo de uma ação (pipeline completo)](#10-ciclo-de-uma-ação-pipeline-completo)
11. [Camada DM (orquestração pré-IA)](#11-camada-dm-orquestração-pré-ia)
12. [Motor de regras D&D 5e](#12-motor-de-regras-dd-5e)
13. [Rolagens e dados 3D](#13-rolagens-e-dados-3d)
14. [Combate](#14-combate)
15. [Inventário, loja e loot](#15-inventário-loja-e-loot)
16. [Mundo, regiões e mapa](#16-mundo-regiões-e-mapa)
17. [Elenco de sessão e presença no mundo](#17-elenco-de-sessão-e-presença-no-mundo)
18. [Sessões e personagens](#18-sessões-e-personagens)
19. [Homebrew e SRD](#19-homebrew-e-srd)
20. [Mídia: áudio, imagem e armazenamento](#20-mídia-áudio-imagem-e-armazenamento)
21. [Modelo de dados (entidades)](#21-modelo-de-dados-entidades)
22. [Sincronização de estado](#22-sincronização-de-estado)
23. [Infraestrutura Docker](#23-infraestrutura-docker)
24. [Variáveis de ambiente críticas](#24-variáveis-de-ambiente-críticas)
25. [Índice de pastas no repositório](#25-índice-de-pastas-no-repositório)
26. [Diagramas de referência](#26-diagramas-de-referência)
27. [Glossário](#27-glossário)

---

## 1. O que é o produto

**Crônicas de Aventuras** é um RPG digital de mesa inspirado em **D&D 5e**, com:

- **Mestre virtual** alimentado por LLM (narração e opções de ação).
- **Motor de regras autoritativo** no servidor (HP, combate, inventário, rolagens, XP).
- **Interface web** (Next.js) com log narrativo, ficha, mapa, inventário e **dados 3D** (`@3d-dice/dice-box`).
- **Sessões persistentes** por usuário, múltiplos personagens no “cofre”, conteúdo homebrew e grafo de regiões.

O jogador **não edita regras por chat**: ações mecânicas passam por **intents** tipados ou classificação DM; a IA **só narra** o que o motor já decidiu ou o que não exige teste.

---

## 2. Stack tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 15, React 18, TypeScript, Tailwind, Framer Motion, Radix UI |
| Backend | Node.js, Express, TypeScript, `ws` (WebSocket) |
| ORM | TypeORM |
| Banco principal | MySQL 8 |
| Cache | Redis 7 |
| Vetorial (opcional) | Qdrant |
| SRD | Fork `5e-srd-api` + MongoDB + Redis de cache |
| TTS | Piper (container HTTP) |
| Objetos / logs grandes | MinIO (S3-compatible) |
| LLM | OpenRouter (padrão OSS); Gemini (legado/fallback) |
| Auth | JWT no header HTTP e query string do WebSocket |

**Monorepo:** raiz com frontend; pasta `backend/` com API; `docker-compose.yml` orquestra dependências.

---

## 3. Visão em camadas

```
┌─────────────────────────────────────────────────────────────────────────┐
│ CAMADA DE APRESENTAÇÃO (Next.js — src/)                                  │
│  page.tsx → AuthGate → GameStateProvider → GameContainer → Game/Gameplay │
│  Contextos: Auth, Settings, GameState, HubNavigation                   │
│  Serviços: apiClient, gameService, webSocketService, regionClient, tts   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS + WSS (JWT)
┌───────────────────────────────▼─────────────────────────────────────────┐
│ CAMADA DE API (backend/src/)                                             │
│  server.ts — Express + configureWebSocket                                │
│  routes/* — REST                                                         │
│  controllers/* — handlers                                                │
│  middlewares — auth, errors                                              │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ ORQUESTRAÇÃO  │     │ MOTOR DE REGRAS │     │ NARRAÇÃO + IA   │
│ WS, DM,       │     │ rules/*         │     │ narrarService,  │
│ actionService │     │ stateDelta      │     │ ai-oss/*        │
└───────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ PERSISTÊNCIA E DADOS                                                     │
│  MySQL (entities), Redis (cache, filas, métricas), Qdrant (memória),   │
│  MinIO (payloads grandes), MongoDB SRD                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**Regra de ouro:** o **motor** é fonte da verdade para mecânica; a **IA** é fonte da verdade apenas para prosa e sugestões (`narration_only`).

---

## 4. Frontend: estrutura e estágios

### 4.1 Entrada da aplicação

- **`src/app/page.tsx`:** página principal; envolve usuário em `AuthGate` ou `AuthGateV2` (flag `isUiV2Enabled()`), depois `GameStateProvider` e `GameContainer`.
- **UI v2 (padrão recente):** layout fullscreen `100dvh`, hub moderno, `GameplayScreen` em vez do `GameScreen` legado.

### 4.2 Estágios do jogo (`GameStage`)

Definidos em `src/types/gameStage.ts` e controlados por `GameContainer`:

| Estágio | Significado |
|---------|-------------|
| `loading` | Carrega traduções, sessões e personagens |
| `main_menu` | Hub / menu principal |
| `session_list` | Lista de aventuras (sessões) |
| `character_vault` | Cofre de heróis (personagens) |
| `creating_character` | Assistente de criação (`CharacterCreationWizard` ou legado) |
| `playing` | Partida ativa → `Game` → `GameplayScreen` |
| `homebrew_store` | Loja/gerenciador de conteúdo customizado |
| `translation_studio` | Estúdio de tradução de homebrew |

Transições típicas:

- `loading` → `main_menu` quando dados iniciais carregam.
- Escolher sessão → `loadGameSession` → `playing`.
- Criar personagem → `creating_character` → `playing` ou volta ao cofre.
- `returnToMenu` limpa estado de jogo via `clearGameState`.

### 4.3 Hub vs gameplay

- **Hub** (`src/features/hub/`): landing, grade de sessões, cofre de heróis, cards, filtros.
- **Gameplay** (`src/features/gameplay/`): shell, log, dock de ações, mapa, inventário, ficha, combate.
- **Homebrew** (`src/features/homebrew/`): loja, criador com stepper, preview, translation studio.
- **Auth** (`src/features/auth/`): login/registro v2, passo de API key, licença.

### 4.4 Áudio ambiente

- `useStageAmbientSound(gameStage)` — troca som conforme estágio (hub vs jogo).
- `useMenuMusicCrossfade` — música de menu com crossfade.
- `AmbientAudioEngine` — reprodução no cliente.

---

## 5. Frontend: estado e hooks

### 5.1 Contextos React

| Contexto | Responsabilidade |
|----------|------------------|
| **AuthContext** | `user`, login/registro, licença, API key, logout |
| **SettingsContext** | modelo LLM, TTS, volume, homebrew, voz/speed Piper (`narrationTts`) |
| **GameStateContext** | Fachada de `useNewGameState` — tudo que a partida precisa |
| **HubNavigationContext** | Navegação entre telas do hub (opcional v2) |

### 5.2 Orquestrador: `useNewGameState`

Arquivo: `src/hooks/newUseGameState.ts`

Combina:

| Módulo | Arquivo | Função |
|--------|---------|--------|
| Log | `useGameLog` | `log`, `addLogEntry`, `addLogEntries` |
| Interações | `useInteractionManager` | combate, modais, rolagem, shop, loot, intents pendentes |
| Sessão | `useGameSession` | carregar sessão, `handleApiResponse`, criar personagem, WebSocket init |
| Ações | `useGameActions` | `processPlayerAction`, `submitRollResult`, level-up, loot, shop |
| WS | `useGameWebSocket` | listeners de eventos do servidor |

Estado principal exposto:

- `character`, `sessionId`, `log`, `actionOptions`
- `combatState`, `playerRollRequest`, `skillCheckRequest`, `spellCastRequest`
- `levelUpState`, `shopState`, `pendingLootOffer`, `pendingHitDiceRequest`
- `isLoading`, `actionPhaseLabel`, `apiError`, `progressionFeed`, `ambientSound`

### 5.3 `useInteractionManager`

Centraliza UI transiente:

- **Combate:** `combatState` (inicial inativo), sincronizado com respostas do servidor.
- **Modais:** rolagem, perícia, magia, level-up, loja, loot, hit dice.
- **`pendingStructuredIntent`:** intent montado no cliente (ex.: ataque, compra) aguardando envio com o próximo `processAction`.
- Helpers: `buildBuyItemIntent`, `buildStartEncounterFromCharacter`, etc. (`hooks/game/motorIntents.ts`).

### 5.4 `useGameSession`

- **`loadGameSession(id)`:** HTTP GET sessão + personagem; hidrata log, combate, `clientStateVersion`; abre WebSocket.
- **`handleApiResponse`:** aplica `GameMasterResponse` — log com `stateVersion`, patch de personagem (`patchCharacter`), combate, opções, modais (roll, shop, level-up).
- **`createCharacter`:** POST personagem + opcionalmente nova sessão.
- **Reinstall homebrew:** modal se dependências de conteúdo mudaram.

### 5.5 `useGameActions`

- **`processPlayerAction`:** valida `sessionId`, loga ação local, limpa opções transitórias, gera `actionId`, envia WS `processAction`.
- **`submitRollResult`:** envia valores dos dados 3D após `playerRollRequest`.
- Integração com timeouts (`NEXT_PUBLIC_ACTION_TIMEOUT_MS`, padrão 120s) e fila `pendingActionsRef`.

### 5.6 Serviços HTTP do cliente

| Serviço | Uso |
|---------|-----|
| `apiClient` | fetch autenticado com JWT |
| `gameService` | sessões, personagens, fatos, replay, world map |
| `authService` | login, registro, settings no servidor |
| `homebrewService` | CRUD homebrew |
| `regionClient` | regiões e POIs |
| `webSocketService` | conexão, fila, event bus por `type` |
| `ttsService` (frontend) | URLs de áudio da narração |

---

## 6. Frontend: UI de gameplay

### 6.1 `GameplayScreen` (UI v2)

Componentes e modais montados na tela de jogo:

| Peça | Função |
|------|--------|
| **GameplayShell** | Layout: top bar, coluna narrativa, side panel (desktop), nav mobile |
| **GameplayNarrativeLog** | Log scrollável com entradas por tipo |
| **GameplayActionDock** | FAB + ações contextuais (`contextualDockActions.ts`) |
| **GameplayFreeActionSheet** | Texto livre do jogador |
| **DiceRollModal** | `@3d-dice/dice-box` — rolagem visual |
| **SkillCheckModal / SpellCastModal** | Intents de perícia e magia |
| **NewCombatTracker** | HUD de combate (iniciativa, PV) |
| **GameplayMapPanel** | Mapa/região na lateral |
| **GameplayInventoryPanel / CharacterSheet** | Ficha e itens |
| **WorldMapModal** | Mapa mundial (`getWorldMapSnapshot`) |
| **ShopModal / LevelUpModal** | Economia e progressão |
| **LoadingOracle / PremiumLoader** | Estados de carregamento narrativo |

### 6.2 Dock contextual

`src/features/gameplay/lib/contextualDockActions.ts` define ações rápidas conforme:

- Combate ativo ou exploração
- Presença de loot, loja, perícia pendente
- Integração com `processPlayerAction` e intents

### 6.3 Legado

`src/components/GameScreen.tsx` — mantido; se `isUiV2Enabled()`, delega para `GameplayScreen`.

---

## 7. Autenticação e licença

### 7.1 Fluxo

1. **Registro** `POST /api/auth/register` — cria usuário.
2. **Login** `POST /api/auth/login` — retorna JWT.
3. Token armazenado em `localStorage` (`token`).
4. **Licença** `POST /api/licenses/activate` — ativa chave de produto (se aplicável ao deploy).
5. **Settings do usuário** — modelo, volume, homebrew; podem persistir no servidor e localmente.

### 7.2 Middleware

`authMiddleware` — valida JWT em rotas protegidas; injeta `userId` no request.

### 7.3 WebSocket

Conexão: `ws://host/?token=<JWT>`. Sem token, conexão não autentica ações. Heartbeat de conexão no servidor (ping `isAlive`).

### 7.4 API key do jogador

`SettingsContext` guarda chave para OpenRouter/Gemini no cliente; o servidor pode preferir chaves de pool (`OPENROUTER_PREFER_SERVER_KEYS`). Gameplay envia `apiKey` no payload WS quando necessário.

---

## 8. Backend: servidor e rotas HTTP

### 8.1 Bootstrap (`server.ts`)

Ordem de inicialização:

1. Carrega `.env` (raiz e `backend/`).
2. `AppDataSource.initialize()` — MySQL.
3. `refreshEnemyTemplatesFromDatabase`.
4. `ensureDefaultSpawnRegions` — regiões de spawn para novas sessões.
5. `checkObjectStorageHealth` — MinIO.
6. `ensureQdrantCollections` — se `QDRANT_ENABLED`.
7. `configureWebSocket(server)` — mesmo processo HTTP.
8. `listen(PORT)` — padrão via `env.PORT` (8071 em dev Docker).

### 8.2 Mapa de rotas REST

| Prefixo | Conteúdo |
|---------|----------|
| `/api/auth` | register, login |
| `/api/users` | perfil, settings |
| `/api/licenses` | ativação de licença |
| `/api/sessoes` | CRUD sessões, facts, replay, world-map, **elenco** (`/:sessionId/cast`) |
| `/api/characters` | CRUD personagens (soft delete) |
| `/api/homebrew` | conteúdo customizado, bundles |
| `/api/ai` | utilitários de IA (testes, métricas auxiliares) |
| `/api/data` | **SRD unificado** (raças, classes, magias, equipamentos) |
| `/api/cache` | invalidação/consulta cache |
| `/api/logs` | logs administrativos |
| `/api/regions` | grafo de regiões, POIs, links, snapshots |
| `/api/tts` | síntese e URLs de áudio |
| `/api/roll-requests` | consulta rolagens pendentes (HTTP auxiliar) |
| `/api/images` | geração/consulta de imagens de cena |
| `/api/srd` | proxy/health SRD local |
| `/api/sessions` | `POST /:sessionId/actions` — **REST fallback** do mesmo pipeline de ação |
| `/api/translations` | i18n para UI |
| `/api/health` | status + SRD + media + TTS |
| `/api/admin/ai-metrics` | métricas OpenRouter |
| `/metrics` | métricas Prometheus-style (se configurado) |

Todas as rotas de sessão/personagem exigem **auth**, salvo health público.

### 8.3 Elenco (cast)

Sub-rota: `/api/sessoes/:sessionId/cast`

| Método | Ação |
|--------|------|
| GET | Lista membros (PC, NPC, aliado, inimigo) |
| POST | Adiciona membro |
| POST `/sync` | Sincroniza elenco com mundo/cofre |
| PATCH `/:memberId` | Atualiza |
| DELETE `/:memberId` | Remove |

Entidade: `session_cast_members` — papéis `pc | npc | ally | enemy`, vínculo opcional a `Character` do cofre.

---

## 9. WebSocket: protocolo em tempo real

**Arquivo:** `backend/src/websocket/webSocketServer.ts`

### 9.1 Tipos de mensagem (cliente → servidor)

| type | Payload principal | Efeito |
|------|-------------------|--------|
| **`processAction`** | `ProcessActionSchema` | Pipeline completo de ação (intent ou texto livre) |
| **`submitRollResult`** | `requestId`, `rolls[]`, `apiKey`, combate, TTS | Resolve rolagem 3D e narra |
| **`getCharacter`** | `characterId` | Retorna ficha atualizada (`characterUpdate`) |

### 9.2 Tipos de mensagem (servidor → cliente)

| type | Quando |
|------|--------|
| `actionAck` | Ação recebida |
| `narrationLoading` | IA começou a processar |
| `narrationStream` | Preview de narração (OSS stream) |
| `gameStateUpdate` | Payload `GameMasterResponse` + `stateVersion` |
| `actionResolution` | Fechamento formal da ação com status |
| `narrationComplete` | Libera UI de “narrando” |
| `stopLoading` / `startLoading` | Estados de loading por `actionId` |
| `timeout` | Ação excedeu `ACTION_TIMEOUT_MS` |
| `error` | Falha (`STATE_DESYNC`, rolagem pendente, etc.) |
| `characterUpdate` | Resposta a `getCharacter` |
| `connectionClosed` | (evento interno cliente) |

### 9.3 Contrato `processAction`

Validado por Zod (`schemas/processActionSchema.ts`):

- `contractVersion`: 1
- `sessionId`, `prompt`, `intent?`, `combatState`, `apiKey`, `useAiHomebrew`, `model`
- `clientStateVersion`, `actionId`, `clientInstanceId`, `actionCursor`
- `narrationVoice`, `narrationSpeed` — repassados ao TTS pós-narração

### 9.4 Concorrência e cancelamento

- `activeActions` — ações em voo; desconexão cancela via `cancelledActions`.
- `actionPhaseService` — fases persistidas: RECEIVED, NORMALIZED, RULES, AI_SYNTHESIS, DELTA_APPLIED.
- `sessionRuntimeService` — lease por `clientInstanceId` e cursor monotônico anti-replay.

---

## 10. Ciclo de uma ação (pipeline completo)

```
JOGADOR (UI)
    │
    ├─ Botão estruturado ──► monta intent ──► processAction { intent }
    │
    └─ Texto livre ────────► processAction { prompt }
                │
                ▼
         webSocketServer
                │
    ┌───────────┴───────────┐
    │ intent presente?      │
    └───────────┬───────────┘
          sim   │   não
                │    └──► dmTurnOrchestrator.processFreeActionWithDmFlow
                │              ├─ classificar perícia?
                │              ├─ emitir playerRollRequest (3D)
                │              └─ ou processPlayerTurn (IA)
                ▼
         validateActionIntent (motor)
                │
    ┌───────────┼───────────┐
    │ rejected  │ needs_roll│ accepted
    ▼           ▼           ▼
  erro      issuePending   applyResultingStateDelta
            ou auto-roll       + eventual IA
            ▼
         [Jogador rola 3D]
            ▼
         submitRollResult
            ▼
         resolveStructuredRoll (motor)
            ▼
         completeManualRollAndNarrate
            ▼
         processPlayerTurn (IA)
            ▼
         persistNarrationTurn
            ▼
         gameStateUpdate + stateVersion
```

### 10.1 REST paralelo

`actionService.processActionIntent` — mesma lógica para clientes HTTP; usado em testes e fallback. Incrementa `stateVersion`, aplica deltas, chama narração quando aplicável.

---

## 11. Camada DM (orquestração pré-IA)

**Pasta:** `backend/src/services/dm/`

O DM **não** é um modelo separado: é código que:

1. Classifica texto livre (heurística + LLM opcional).
2. Pede rolagem ao jogador **antes** da narração quando o motor exige teste.
3. Monta prompt de fase (`dmPromptBuilder`) para a IA.

Funções-chave: `processFreeActionWithDmFlow`, `issuePendingRollToPlayer`, `narrateAfterPlayerRoll`, `completeManualRollAndNarrate`.

Variáveis: `DM_AUTO_ROLL`, `DM_CLASSIFY_FREE_ACTION`, `DM_LLM_CLASSIFY` — ver documento de IA para detalhe dos prompts DM.

---

## 12. Motor de regras D&D 5e

**Pasta:** `backend/src/rules/`

### 12.1 Entrada única: `validateActionIntent`

Arquivo: `actionIntentService.ts`

Carrega snapshot do personagem (`characterSnapshot.ts`) e despacha para validador específico.

### 12.2 Tipos de intent suportados

| type | Módulo | Exemplo de efeito |
|------|--------|-------------------|
| `weapon-attack` | `attack.ts` | Ataque corpo a corpo/distância, rolagem vs CA |
| `skill-check` | `skills.ts` | Perícia + CD |
| `spell-attack` | `spellAttack.ts` | Ataque de magia |
| `rest` | `rest.ts` | Descanso curto/longo |
| `damage` | `damage.ts` | Aplicar dano (combate) |
| `healing` | `healing.ts` | Cura |
| `consume-item` | `damage.ts` | Consumível |
| `travel` | `travel.ts` | Viagem entre regiões |
| `equip-item` | `inventoryMotor.ts` | Equipar |
| `drop-item` | `inventoryMotor.ts` | Dropar |
| `claim-loot` | `inventoryMotor.ts` | Pegar loot pendente |
| `open-shop` | `shopMotor.ts` | Abrir loja |
| `buy-item` | `shopMotor.ts` | Comprar |
| `sell-item` | `shopMotor.ts` | Vender |
| `close-shop` | `shopMotor.ts` | Fechar loja |
| `quest-complete` | `questMotor.ts` | Concluir missão |
| `start-encounter` | `combatEncounterMotor.ts` | Iniciar combate |

### 12.3 Resultado: `RuleCheckResult`

| status | Significado |
|--------|-------------|
| `accepted` | Motor aplicou ou aceitou sem rolagem |
| `rejected` | Inválido (sem slot, fora de combate, etc.) |
| `needs_roll` | Deve emitir `rollRequest` → `playerRollRequest` no cliente |

Campos importantes:

- `rollRequest` — fórmula, modificador, CD, metadata (arma, alvo, dano).
- `stateDelta` — alterações a aplicar após rolagem ou imediatamente (HP, inventário, entidades de combate).
- `authoritativeSignature` — rastreio `rules:<tipo>`.

### 12.4 Aplicação de deltas

**`stateDeltaService.applyResultingStateDelta`:**

- `characterStateService` — HP, recursos, inventário, moeda.
- `combatEntityService` — entidades hostis no encontro.
- Registra em `actionLogService`, métricas (`deltaMetricsService`).

Flag `STRICT_AUTHORITATIVE_DELTAS` — rejeita deltas não assinados pelo motor.

### 12.5 Adaptador de rolagem

`rollRequestAdapter.convertRollRequestToPlayerRoll` — converte `RollRequest` interno para `PlayerRollRequest` do cliente (tipo `check | save | attack | damage | healing | initiative`).

### 12.6 Resolução pós-dado

**`ruleResolutionService.resolveStructuredRoll`** — recebe valores do 3D, calcula sucesso/falha, aplica dano/cura, pode emitir `nextRollRequest` (ex.: dano após acerto), retorna `shouldNarrate`, `attackOutcome`, personagem atualizado.

---

## 13. Rolagens e dados 3D

### 13.1 Fluxo padrão (`DM_AUTO_ROLL=false`)

1. Motor retorna `needs_roll`.
2. `issuePendingRollToPlayer` persiste em Redis/DB (`rollRequestService`).
3. Cliente abre **DiceRollModal** com `playerRollRequest` (dados, modificador, CD, motivo).
4. Jogador rola visualmente; `onRoll` → `submitRollResult` via WebSocket.
5. Servidor valida, aplica motor, chama IA para **narração do desfecho** apenas.

### 13.2 Fluxo auto-roll (`DM_AUTO_ROLL=true`)

Servidor rola com `autoRollService.executeAutomatedRoll` e narra sem abrir modal — útil para testes ou mesa sem 3D.

### 13.3 Fila de rolagens

Uma rolagem pendente **bloqueia** novo `processAction` até resolvida (HTTP 409).

Follow-ups (dano após hit) geram novo `playerRollRequest` sem passar pela IA intermediária.

### 13.4 Biblioteca 3D

`@3d-dice/dice-box` — assets copiados no `postinstall` (`copy-dice-assets.js`).

---

## 14. Combate

### 14.1 Modelo de estado

**Schema:** `CombatStateSchema` em `gameSchemas.ts`

- `isActive`, `round`, `turn`
- `combatants[]` — id, name, hp, ac, attitude (hostile/neutral/ally), zonas (`perto|medio|longe|coberto`), condições, efeitos, cooldowns
- `initiativeOrder`, `log` de combate

Estado **canônico** no servidor: tabelas `combat_encounters`, `combat_entities`, `combatant_states`, etc.

### 14.2 Serviços

| Serviço | Função |
|---------|--------|
| `combatStateService` | Carregar, salvar, reconciliar, projetar estado público |
| `combatMotorService.runMotorCombatPipeline` | Tick de combate autoritativo pós-turno |
| `combatEntityService` | HP de NPCs/inimigos |
| `enemyTemplateRegistry` | Templates de inimigos do banco |

### 14.3 Cliente vs servidor

O cliente envia `combatState` como **hint**; o servidor reconcilia com o banco. Em `narration_only`, a IA **não** altera combate — apenas narra com base no estado público.

### 14.4 UI

- `NewCombatTracker` / `GameplayCombatTracker` — iniciativa, cartões de combatentes (`CombatantCardV2`, `InitiativeRail`).
- `startEncounter` no contexto — monta intent `start-encounter` com hostis.

### 14.5 Fim de combate

`evaluateCombatAutoEnd` — detecta vitória/derrota; pode conceder loot via `motorCombat.rewards.lootOffer`.

---

## 15. Inventário, loja e loot

### 15.1 Motor

`inventoryMotor.ts`, `inventoryMotorService.ts`, `inventoryService.ts`:

- Equipar, dropar, peso/carga (conforme implementado), moeda (`reconcileCurrency`).
- **Loot offer** pendente até `claim-loot`.
- Hidratação de itens com dados SRD (`hydrateInventoryItems`).

### 15.2 Loja

`shopMotor.ts`:

- `open-shop` — catálogo no `shopState` da resposta.
- `buy-item` / `sell-item` — transações validadas.
- UI: `ShopModal`, intents via `useInteractionManager`.

### 15.3 Cliente

`GameplayInventoryPanel`, `useInventoryData` — lê personagem do contexto; desabilita ações se `playerRollRequest` ou `isLoading`.

---

## 16. Mundo, regiões e mapa

### 16.1 Grafo de regiões

Entidades: `Region`, `RegionLink`, `RegionPointOfInterest`, `RegionSnapshot`.

Serviços: `regionService`, validação `narration/regionMapValidation.ts` — impede teletransporte inválido da IA; em `narration_only` mudanças de região vêm do motor (`travel`).

### 16.2 World state no personagem

JSON `worldState` em `Character`:

- `currentRegion`, `regionSlug`, `visitedRegions`, clima, hora (`gameClock` opcional).

### 16.3 Mapa na UI

- **Painel lateral:** `GameplayMapPanel`, `RegionGraphView`.
- **Modal:** `WorldMapModal` — snapshot via `GET /api/sessoes/:id/world-map`.

### 16.4 Spawn

Startup chama `ensureDefaultSpawnRegions` — sem regiões, novas sessões podem falhar até seed (`npm run seed:regions`).

---

## 17. Elenco de sessão e presença no mundo

### 17.1 Elenco (`session_cast_members`)

Cada sessão tem elenco dinâmico:

- **PC** — personagem jogável (auto-registrado).
- **NPC / ally / enemy** — adicionados via API ou UI (`SessionCastPanel`).
- Opcional: `characterId` apontando para ficha do cofre.

### 17.2 Sincronização

`syncSessionCastFromWorld` — alinha elenco com heróis de outras sessões na mesma região (ecos assíncronos).

### 17.3 Prompt

`getCastSummaryForSession` e `getWorldPresenceHints` entram no contexto da IA e no prompt DM — rumores, NPCs compartilhados, tensão regional.

---

## 18. Sessões e personagens

### 18.1 Sessão (`SessaoIA`)

| Campo | Uso |
|-------|-----|
| `nome` | Título da aventura |
| `userId` | Dono |
| `characterId` | PJ ativo |
| `homebrewContentIds` | Pacotes instalados na sessão |
| `stateVersion` | Contador de sincronização |
| `leaseOwnerClientId` / `leaseExpiresAt` | Lease de cliente único (opcional) |
| `lastHeartbeatAt` | Heartbeat de sessão |

Relacionamentos: logs, combates, timeline, story summaries.

### 18.2 Personagem (`Character`)

Tabelas normalizadas:

- `CharacterAttributes` — atributos, HP, CA, condições.
- `CharacterItem`, `CharacterSpell`, `CharacterProficiency`, `CharacterResource`.
- `JournalEntry`, `Relationship`, `Quest` (via relacionamentos).

Soft delete em personagem; sessões podem ser clonadas (`cloneSessao`) — nova linha do tempo com estado copiado.

### 18.3 Ciclo de vida

1. Criar personagem (wizard v2 ou legado).
2. Criar sessão vinculada ou escolher sessão existente.
3. `loadGameSession` — hidrata cliente.
4. Prompt interno `"A aventura começa."` ou continuação — primeira narração.
5. Jogo loop até sair para menu.

### 18.4 Fatos e replay

- `GET /api/sessoes/:id/facts` — resumo, timeline, NPCs, quests, fatos atômicos (painel Crônica).
- `GET /api/sessoes/:id/replay` — export markdown do replay.

---

## 19. Homebrew e SRD

### 19.1 SRD

- API local **5e-srd-api** (container Docker) + MongoDB com dataset oficial.
- `srdApiAdapter.ts` — health check, cache, snapshots offline em `data/srd`.
- `unifiedDataRouter` — endpoint único `/api/data/*` para raças, classes, magias, equipamentos.
- Scripts: `sync:srd`, `verify:srd`.

### 19.2 Homebrew

- Entidades `HomebrewContent`, `HomebrewBundle`.
- Instalação por sessão (`homebrewContentIds`).
- Criador na UI com `aiCreationService` (LLM gera JSON no formato 5e).
- Resumo em cache Redis para prompts de IA.

### 19.3 Tradução

`translation_studio` — fluxo para traduzir pacotes (UI em `features/homebrew/TranslationStudioPage`).

---

## 20. Mídia: áudio, imagem e armazenamento

### 20.1 TTS (Piper)

- Container `piper` — HTTP interno (`PIPER_HTTP_URL`).
- `ttsService.ts` (backend) — `synthesizeNarrationAudio`, URLs públicas via `API_PUBLIC_URL`.
- Vozes jogador: faber, razo, miro, dii; velocidades: rapido, normal, lento, pausado.
- Log entries podem incluir `audioUrl`.

### 20.2 Imagens de cena

- `imageGenerationService` — opcional após turno narrativo.
- Assets estáticos do app em `public/assets/AI/` (regra do projeto para arte manual/gerada estática).

### 20.3 MinIO

- Payloads grandes de log (`prepareLogPayload`) — armazenamento S3 com referência `storage: s3` no JSON do log.
- Variáveis: `MINIO_*`, bucket `chronicles`.

---

## 21. Modelo de dados (entidades)

Agrupamento das 38 entidades TypeORM em `backend/src/entities/`:

### 21.1 Núcleo do jogador

| Entidade | Tabela | Papel |
|----------|--------|-------|
| User | users | Conta |
| LicenseKey | license_keys | Licenciamento |
| Character | characters | Ficha |
| CharacterAttributes | character_attributes | Stats |
| CharacterItem | character_items | Inventário |
| CharacterSpell | character_spells | Magias |
| CharacterProficiency | character_proficiencies | Perícias/salvaguardas |
| CharacterResource | character_resources | Recursos de classe |
| JournalEntry | journal_entries | Diário |
| Relationship | relationships | NPCs e laços |
| Quest | quests | Missões |

### 21.2 Sessão e narrativa

| Entidade | Papel |
|----------|-------|
| SessaoIA | Sessão de jogo |
| SessionLog | Log persistente (ação, narração, state, gm_raw) |
| SessionFact | Fatos atômicos validados |
| StorySummary | Resumo rolling |
| TimelineEvent | Linha do tempo |
| SessionCastMember | Elenco |
| CampaignArtifact | Artefatos de campanha |
| AiFeedbackNote | Feedback para tuning de IA |

### 21.3 Combate

| Entidade | Papel |
|----------|-------|
| CombatEncounter | Encontro por sessão |
| CombatEntity | Entidade hostil/neutra |
| CombatantState | Estado de combatente |
| CombatLogEntry | Log de combate |
| CombatStatusEffect | Efeitos |
| CombatCooldown | Cooldowns |
| EnemyTemplate | Templates reutilizáveis |
| ActionLog | Log de ações mecânicas |

### 21.4 Mundo

| Entidade | Papel |
|----------|-------|
| Region | Região no grafo |
| RegionLink | Conexões (viagem, tempo, dificuldade) |
| RegionPointOfInterest | POIs |
| RegionSnapshot | Snapshots de mapa |

### 21.5 Homebrew e SRD

| Entidade | Papel |
|----------|-------|
| HomebrewContent | Item/criatura custom |
| HomebrewBundle | Pacotes |
| SrdResource | Cache de recursos SRD |

### 21.6 Memória e qualidade

| Entidade | Papel |
|----------|-------|
| VectorMemoryBacklog | Fila se Qdrant indisponível |
| ScenarioExample | Exemplos para few-shot |
| SanitizationPattern | Padrões de sanitização de resposta |

---

## 22. Sincronização de estado

### 22.1 `stateVersion`

- Incrementado no servidor após mudanças mecânicas relevantes (`stateVersionService`).
- Cliente guarda `clientStateVersionRef` e envia em cada `processAction`.
- Divergência → erro `STATE_DESYNC` — UI deve `loadGameSession`.

### 22.2 Log e versão

Entradas de log no cliente recebem `stateVersion` para evitar duplicatas ao reconciliar replay.

### 22.3 Lease e cursor

- `clientInstanceId` — identifica aba/dispositivo.
- `actionCursor` — monotônico; `validateAndPersistActionCursor` evita ações duplicadas fora de ordem.
- `heartbeatSessionLeaseOrThrow` — sessão exclusiva opcional por cliente.

### 22.4 Patch de personagem no cliente

`patchCharacter` / `characterPatch.ts` — merge parcial de `updatedCharacter` vindo do servidor sem substituir ficha inteira.

---

## 23. Infraestrutura Docker

Compose principal: `docker-compose.yml` (projeto `dndai`).

| Serviço | Porta típica | Função |
|---------|--------------|--------|
| mysql | 3306 | Banco principal |
| redis | 6379 | Cache |
| srd-db | 27018 | Mongo 5e |
| srd-cache | 6380 | Redis SRD |
| srd-api | 3000 | API regras 5e |
| minio | 9000 | Objetos |
| piper | 5500 | TTS |
| qdrant | 6333 | Vetores (opcional) |
| backend | 8071 | API + WS (profile full) |
| frontend | 9002 | Next (profile full) |

**Desenvolvimento local recomendado:**

- `npm run dev:infra` — só dependências.
- `npm run dev:backend` — hot reload API.
- `npm run dev` — Next na porta 9002.

**Produção em container:** `docker compose --profile full up -d --build`

---

## 24. Variáveis de ambiente críticas

### 24.1 Backend

| Variável | Função |
|----------|--------|
| PORT | Porta HTTP/WS |
| DB_* | MySQL |
| DB_SYNC | true só dev — sync schema automático |
| REDIS_URL | Cache; `mock` em testes |
| JWT_SECRET | Tokens |
| SRD_API_BASE | URL da API 5e local |
| QDRANT_* | Memória vetorial |
| MINIO_* | Storage |
| PIPER_HTTP_URL | TTS |
| API_PUBLIC_URL | URLs absolutas de mídia |
| OPENROUTER_KEY* | IA |
| AI_ENGINE | oss / legacy |
| DM_* | Pipeline do mestre |
| ACTION_TIMEOUT_MS | Timeout WS |

### 24.2 Frontend

| Variável | Função |
|----------|--------|
| NEXT_PUBLIC_API_URL | REST |
| NEXT_PUBLIC_WS_URL | WebSocket |
| NEXT_PUBLIC_ACTION_TIMEOUT_MS | Timeout cliente |
| NEXT_PUBLIC_UI_V2 | UI moderna |

---

## 25. Índice de pastas no repositório

```
dndai/
├── src/                          # Frontend Next.js
│   ├── app/                      # Rotas App Router
│   ├── components/               # UI compartilhada + legado
│   ├── contexts/                 # Auth, Settings, GameState
│   ├── features/                 # hub, gameplay, homebrew, auth
│   ├── hooks/                    # game/*, newUseGameState
│   ├── services/                 # HTTP + WS
│   ├── types/                    # Tipos TS compartilhados
│   └── lib/                      # utils, uiV2, narrationTts
├── backend/src/
│   ├── server.ts
│   ├── routes/ controllers/ middlewares/
│   ├── websocket/
│   ├── services/                 # domínio (dm, combat, inventário…)
│   ├── rules/                    # motor 5e
│   ├── narration/                # contexto + persistência narrativa
│   ├── ai-oss/                   # pipeline IA OSS
│   ├── ai/                       # legado Gemini
│   ├── entities/                 # TypeORM
│   ├── schemas/                  # Zod
│   └── database/                 # migrations, data-source, qdrant
├── docs/                         # documentação (este arquivo)
├── docker/                       # Piper, etc.
├── public/assets/                # estáticos + AI/
└── docker-compose.yml
```

---

## 26. Diagramas de referência

### 26.1 Mapa do produto (mental)

```
                    ┌─────────────┐
                    │   CONTA     │
                    │ User+License│
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Personagem│ │ Homebrew │ │ Settings │
        │  (cofre)  │ │  packs   │ │ model/tts│
        └─────┬────┘ └─────┬────┘ └──────────┘
              │            │
              └──────┬─────┘
                     ▼
              ┌─────────────┐
              │   SESSÃO    │
              │  SessaoIA   │
              └──────┬──────┘
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
┌─────────┐   ┌─────────────┐  ┌──────────┐
│  LOG    │   │   COMBATE   │  │  MUNDO   │
│ Session │   │  Encounter  │  │  Region  │
└─────────┘   └─────────────┘  └──────────┘
                     │
              ┌──────┴──────┐
              ▼             ▼
        ┌──────────┐  ┌──────────┐
        │  MOTOR   │  │    IA    │
        │  rules   │  │ narrar   │
        └──────────┘  └──────────┘
```

### 26.2 Estados da UI (GameStage)

```
loading → main_menu ⇄ session_list
              ⇄ character_vault
              ⇄ creating_character
              ⇄ homebrew_store
              ⇄ translation_studio
              → playing (GameplayScreen)
```

### 26.3 Integração motor + IA + cliente

```
┌────────────┐     intent/prompt      ┌────────────┐
│  CLIENTE   │ ───────────────────►  │     WS     │
└────────────┘                       └─────┬──────┘
      ▲                                    │
      │         gameStateUpdate            │
      │                                    ▼
      │                              ┌────────────┐
      │                              │    DM      │
      │                              └─────┬──────┘
      │                                    │
      │              ┌─────────────────────┼─────────────────────┐
      │              ▼                     ▼                     ▼
      │        ┌──────────┐         ┌──────────┐         ┌──────────┐
      │        │  MOTOR   │         │ ROLAGEM  │         │ narrar   │
      │        │  rules   │         │ 3D/pend. │         │ + IA     │
      │        └────┬─────┘         └────┬─────┘         └────┬─────┘
      │             │                     │                     │
      │             └─────────────────────┼─────────────────────┘
      │                                   ▼
      │                             ┌──────────┐
      └─────────────────────────────│ MySQL +  │
                                    │  Redis   │
                                    └──────────┘
```

---

## 27. Glossário

| Termo | Definição |
|-------|-----------|
| **Sessão** | Partida salva (`SessaoIA`) com log, personagem ativo e estado |
| **Cofre** | Coleção de personagens do usuário reutilizáveis entre sessões |
| **Intent** | Ação tipada enviada ao motor (`weapon-attack`, `skill-check`, …) |
| **DM (camada)** | Orquestrador que classifica texto livre e emite rolagens antes da IA |
| **Motor** | `backend/src/rules` + serviços de aplicação de delta |
| **stateVersion** | Contador de revisão de estado da sessão |
| **playerRollRequest** | Pedido de rolagem exibido no modal 3D |
| **GameMasterResponse** | Pacote de resposta (log, opções, combate, modais) |
| **narration_only** | Modo em que a IA não controla HP/inventário/combate |
| **OSS** | Pipeline de IA via OpenRouter (`ai-oss/`) |
| **Elenco (cast)** | NPCs/aliados/inimigos registrados na sessão |
| **SRD** | System Reference Document — regras abertas 5e |
| **Homebrew** | Conteúdo customizado fora do SRD oficial |
| **POI** | Point of Interest no mapa regional |
| **Lease** | Bloqueio opcional de sessão a um cliente/aba |

---

## Relação com a documentação de IA

Tudo que diz respeito exclusivamente a **prompts, schemas JSON do LLM, OpenRouter, validação OSS e contrato narrativo** está no documento **`ARQUITETURA_IA_COMPLETA.md`** (mesmo diretório `docs/`). Este arquivo cobre o **jogo como sistema completo**; aquele cobre o **subsistema de inteligência artificial**.

Para alterar comportamento de mesa, comece por:

1. **Regras** — `backend/src/rules/` e `actionIntentService.ts`
2. **Fluxo WS** — `webSocketServer.ts` e `dmTurnOrchestrator.ts`
3. **UI** — `src/features/gameplay/` e hooks em `src/hooks/game/`
4. **Dados** — `entities/` e migrations em `backend/src/database/migrations/`

---

*Fim do documento.*
