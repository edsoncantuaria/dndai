# Crônicas de Aventuras — Design e frontend

> **Documento canônico** da camada de apresentação para revisão sênior de UX/UI. Complementa **ECOSSISTEMA.md** (backend, IA, dados). Índice: **VALIDACAO_SENIOR.md**.
>
> **Referência de atmosfera (não copiar assets):** [Dungeons & Dragons — site oficial](https://www.dungeonsanddragons.com/)
>
> **Última revisão:** junho de 2026 (death saves + HeroDeathScreen; V3 PENAI-only — `usePenaiTurnPipeline`; deep-dive: [`architecture/frontend-turn-pipeline.md`](./architecture/frontend-turn-pipeline.md))

---

## Sumário

1. [Princípios de design](#1-princípios-de-design)
2. [Identidade visual vs site WotC](#2-identidade-visual-vs-site-wotc)
3. [Tokens — referência completa](#3-tokens--referência-completa)
4. [UI V3 — PENAI exclusivo](#4-ui-v3--penai-exclusivo)
5. [Arquitetura de navegação (GameStage)](#5-arquitetura-de-navegação-gamestage)
6. [GameplayShell — layout](#6-gameplayshell--layout)
7. [Pipeline visual do turno](#7-pipeline-visual-do-turno)
8. [Estado React e WebSocket](#8-estado-react-e-websocket)
9. [Componentes da mesa](#9-componentes-da-mesa)
10. [Homebrew e tradução (UI)](#10-homebrew-e-tradução-ui)
11. [Áudio, TTS e imersão](#11-áudio-tts-e-imersão)
12. [Responsivo e acessibilidade](#12-responsivo-e-acessibilidade)
13. [Checklist PR e manutenção](#13-checklist-pr-e-manutenção)

---

## 1. Princípios de design

| Princípio | Implementação |
|-----------|----------------|
| **Mesa primeiro** | Log narrativo é o centro visual; mecânica em painéis laterais |
| **Fantasia premium** | Escuro cinematográfico + ouro + vermelho ember — não SaaS cinza |
| **Feedback honesto** | Números do motor antes do parágrafo IA |
| **InputGate absoluto (BG3-like)** | Ações state-changing só liberam após `narrationComplete` (ou falha final) |
| **Legibilidade** | Pergaminho/claro sobre fundo escuro para texto longo |
| **Toque moderno** | `100dvh`, safe areas, dock flutuante no mobile |
| **Marca respeitosa** | Inspirar WotC; não usar IP protegida |

**Skill operacional (PRs frontend):** `dndai-frontend-cinematic-design` (usa checklist e invariantes; evita regressão de “cinematográfico/BG3-like”).

---

## 2. Identidade visual vs site WotC

O [site D&D](https://www.dungeonsanddragons.com/) (2026) usa:

- Hero **fullscreen** escuro com acento vermelho
- Tipografia **serifada display** em manchetes
- Seções editoriais “Discover / Play your way / Community”
- CTAs de alto contraste
- Sensação **cinematográfica**, não tabela administrativa

### 2.1 Tradução para Crônicas

| Site WotC | Nosso produto |
|-----------|---------------|
| Hero vídeo + vermelho | `--dnd-bg-cinematic` + CTAs `dnd-ember` |
| “Continue your journey” | Hub → retomar sessão / cofre |
| Actual play / comunidade | `PenaiStoryFeed` + `SessionFactsPanel` |
| D&D Beyond (ecossistema) | Integração SRD + homebrew próprio |
| Multiverso (games, streaming) | **Fora de escopo** — foco mesa IA |

### 2.2 O que não copiar

- Logo ampersand WotC, personagens licenciados, key art oficial
- Footer legal WotC
- Carrosséis de produtos terceiros

---

## 3. Tokens — referência completa

Fonte: `src/design-system/tokens.css` → Tailwind `dnd.*`.

### 3.1 Cores (hex)

| Token CSS | Hex | Tailwind | Uso |
|-----------|-----|----------|-----|
| `--dnd-ember` | `#e40712` | `dnd-ember` | CTA, perigo, combate |
| `--dnd-ember-hover` | `#ff2430` | `dnd-ember-hover` | Hover CTA |
| `--dnd-ember-deep` | `#9b0610` | `dnd-ember-deep` | Pressed |
| `--dnd-gold` | `#d4af37` | `dnd-gold` | Bordas, títulos |
| `--dnd-gold-bright` | `#f0d878` | `dnd-gold-bright` | Hover ouro |
| `--dnd-obsidian` | `#050506` | `dnd-obsidian` | Fundo base |
| `--dnd-obsidian-raised` | `#121216` | `dnd-obsidian-raised` | Cards |
| `--dnd-parchment` | `#f7f0e3` | `dnd-parchment` | Texto narrativo |
| `--dnd-parchment-muted` | `#b8a88c` | `dnd-parchment-muted` | Meta |
| `--dnd-success` | `#2d8a4e` | `dnd-success` | Cura / sucesso |
| `--dnd-danger` | `#e40712` | `dnd-danger` | Dano |

### 3.2 Tipografia

| Token | Família | Uso |
|-------|---------|-----|
| `--font-display` | Cinzel Decorative | Títulos, hub |
| `--font-narrative` | IM Fell English | Log, citações |
| `--font-ui` | Inter | Forms, labels densos |

### 3.3 Motion

| Token | Valor | Uso |
|-------|-------|-----|
| `--dnd-duration-ui` | 200ms | Hover, tabs |
| `--dnd-duration-scene` | 700ms | Transições de estágio |
| `--dnd-ease-out-expo` | cubic-bezier | Entrada hero |

### 3.4 Sombras

- `shadow-card` — painéis mesa
- `shadow-elevated` — modais
- `shadow-hero` — hub landing

### 3.5 Regra de migração

**Novas telas:** só `dnd-*`. **Legado:** `stone-*` / `amber-*` — refatorar ao tocar.

---

## 4. UI V3 — PENAI exclusivo (maio/2026)

| Área | Implementação |
|------|----------------|
| Entrada | `AuthGateV2` |
| Hub / lobby | `GameMenuContent` + `GET/POST /api/v2/sessions` |
| Mesa | `GameplayScreen` + `GameplayShell` + WS Contract v2 |
| Narração | `PenaiStoryFeed` (storyFeed WS + TTS v2) |
| Combate | `GameplayCombatTracker` + FSM P0.4 |
| Bootstrap sessão | `SessionWorldLoadingScreen` + `worldBootstrapWorkflow` |

**Política:** não existe coexistência com Express/MySQL/BullMQ no cliente. `NEXT_PUBLIC_PENAI_WS=true` e `NEXT_PUBLIC_PENAI_UI=true` são o único caminho.

**Removidos (não reintroduzir):** `NewNarrativeLog`, `NewJournal`, `StoryHighlightsCard`, `NewRelationships`, `GameScreen`, `MobileToolbar`, `StoryTimeline`, mapeamento `ActionLog` → narrativa legada.

| Peça V3 | Substitui |
|---------|-----------|
| `GameplayNarrativeLog` + `PenaiStoryFeed` | `NewNarrativeLog` |
| `CampanhaPanel` | aba História + highlights legados |
| `ReputationPanel` | `NewRelationships` (reputação PENAI) |
| `usePenaiTurnPipeline` + `usePenaiMechanicalSync` | log WS legado + `m.combat` |
| `penaiMechanicalHydrate.ts` | hidratação duplicada combate/loot/loja |

---

## 5. Arquitetura de navegação (GameStage)

```mermaid
stateDiagram-v2
    [*] --> loading
    loading --> main_menu
    main_menu --> session_list
    main_menu --> character_vault
    main_menu --> homebrew_store
    main_menu --> translation_studio
    session_list --> creating_character
    session_list --> playing
    character_vault --> creating_character
    creating_character --> playing
    playing --> main_menu: returnToMenu
    homebrew_store --> main_menu
```

### 5.1 Responsabilidades por estágio

| Estágio | UX |
|---------|-----|
| `loading` | Traduções (se flag), sessões, personagens |
| `main_menu` / hub | Hero, música ambiente, CTAs |
| `session_list` | Cards de aventura |
| `character_vault` | Cofre reutilizável |
| `creating_character` | Wizard multi-step |
| `homebrew_store` | CRUD + instalar na sessão |
| `translation_studio` | Overlay SRD |
| `playing` | **GameplayShell** |

Orquestrador: `GameContainer` + `GameStateProvider`.

---

## 6. GameplayShell — layout (v3)

### 6.1 Árvore de composição

```mermaid
flowchart TB
    GS[GameplayShell]
    GS --> TB[GameplayTopBar]
    TB --> VIT[HeroVitalsStrip HP CA FOR DES CON]
    GS --> CT[Coluna narrativa]
    GS --> SP[GameplaySidePanel desktop 38%]
    GS --> MN[Nav mobile 4 tabs]

    CT --> COM[GameplayCombatTracker se combate]
    CT --> LOG[GameplayNarrativeLog]
    CT --> DOCK[GameplayActionDock]

    SP --> MAP[Mapa]
    SP --> CAMP[Campanha]
    SP --> BAG[Bolsa]

    MN --> MAIS[Drawer Mais: ficha magias XP campanha config]
```

### 6.2 Desktop (lg+)

```
┌────────────────────────────────────────────────────────────────────┐
│ TopBar: região + tempo │ HeroVitalsStrip (PV, CA, atributos) │ TTS │
├─────────────────────────────────────┬──────────────────────────────┤
│ [Combate tracker se ativo]          │  Side panel (3 tabs)         │
│                                     │  Mapa | Campanha | Bolsa     │
│  GameplayNarrativeLog (scroll)      │                              │
│  GameplayActionDock                 │                              │
└─────────────────────────────────────┴──────────────────────────────┘
```

Proporção: narrativa **62%** · painel **38%**.

### 6.3 Mobile (< lg)

- Abas inferiores: **Narração | Mapa | Bolsa | Mais** (4 itens)
- **Mais:** magias, progressão, campanha, config, sair — ficha completa não ocupa aba dedicada
- **HeroVitalsStrip** no header (PV + CA sempre visíveis; atributos a partir de `sm`)
- Dock sobreposto na coluna narrativa; `useKeyboardViewportInset` ajusta padding
- **Registro WS** (`GameplaySessionLogPanel`): só dev — `NEXT_PUBLIC_DEBUG_WS=1` ou `?debug=ws`

### 6.4 Equipar / desequipar (PENAI)

Intent `equip-item` com `inventoryItemId` (UUID) ou `itemKey`; UI com botões explícitos **Equipar** / **Desequipar** em `ItemCard` v2. Estado autoritativo via `mechanicalStateUpdate` → `usePenaiMechanicalSync`.

### 6.5 Primitivos visuais

- `AmbientBackground` — gradiente vivo
- `Vignette` — bordas escurecidas
- `DndTabs`, `DndButton` — família UI v2
- `HeroVitalsStrip` — PV barra, badge CA (tooltip itens equipados)

---

## 7. Pipeline visual do turno (BG3-like)

> **Caminho canônico V3:** `usePenaiTurnPipeline` + `turnPipelineStore` — **não** `useGameWebSocket` como autoridade de fase. Detalhe: [`architecture/frontend-turn-pipeline.md`](./architecture/frontend-turn-pipeline.md).

Espelha o backend PENAI (ECOSSISTEMA §8 + architecture/ws-pipeline-temporal).

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> rolling: playerRollRequest
    rolling --> mechanical: submitRollResult
    idle --> mechanical: processAction (não bootstrap)
    mechanical --> narrating: narrationQueued (!sync)
    rolling --> narrating: após roll + queue
    narrating --> idle: narrationComplete | falha | timeout 120s
    narrating --> rolling: rollPriorityRef
```

| Fase UI | Gatilho (código) | Comportamento |
|---------|------------------|---------------|
| `idle` | `narrationComplete`, falha, reconnect | Dock e texto livre liberados |
| `rolling` | `playerRollRequest`, `pendingRollState` | `DiceRollModal`; gate `LOCKED_ROLLING`; `rollPriorityRef` impede salto para `narrating` |
| `mechanical` | `processAction`, `mechanicalStateUpdate` | Overlay motor; `PenaiMechanicalSync` patch ficha/combate |
| `narrating` | `narrationQueued` (não-`sync`, fora bootstrap) | Banner Temporal em `PenaiStoryFeed`; gate `LOCKED_NARRATING` |

### 7.0 Bootstrap de abertura

- `sessionStorage` `cda:session:{id}:penaiOpening` evita reenviar prompt de abertura após hydrate.
- `processAction` com `{ bootstrap: true }` mantém **`InputGate OPEN`** — jogador explora mapa enquanto LLM responde.
- `narrationQueued` com `sync: true` ou durante bootstrap **não** trava fase.

### 7.1 InputGate (hard-lock até `narrationComplete`)

Inspirado no ritmo de combate de jogos como **Baldur’s Gate 3**: após uma ação ser aceita, a UI **não** deve permitir empilhar novas intenções mecânicas enquanto o turno está “fechando” (hot path mecânico + worker narrativo).

Estado `InputGate` (derivado do pipeline + sinais WS):

| Gate | Quando | Efeito |
|------|--------|--------|
| `OPEN` | `idle` e sem pendências | permite intents (dock/free action) |
| `LOCKED_MECHANICAL` | ação aceita / loading / `mechanical` | bloqueia ações state-changing |
| `LOCKED_ROLLING` | `playerRollRequest` pendente | só o modal de dados pode enviar roll |
| `LOCKED_NARRATING` | `narrating` | bloqueia até `narrationComplete` |
| `LOCKED_UNCONSCIOUS` | HP ≤ 0 inconsciente/estável ou `gameOver` | bloqueia ações; só death save (`LOCKED_ROLLING` tem prioridade) |

**Regra de ouro:** liberar input state-changing **apenas** em `narrationComplete` (ou falha final + `stopLoading`).

**Regra:** nunca commitar merge WS com `actionSequence` menor que `latestActionSequenceRef` (`usePenaiTurnPipeline`).

### 7.2 Dedupe sensory (pendente)

`dedupeSensoryTail` em `src/lib/narrationText.ts` remove âncora sensorial repetida no final da prosa — **testado**, ainda **não aplicado** em `PenaiStoryFeed` (gap P2).

---

## 8. Estado React e WebSocket

### 8.1 Camadas de estado (V3)

| Camada | Responsabilidade |
|--------|------------------|
| `PenaiGameplayContext` | WS ao vivo: `storyFeed`, `phase`, `lastMechanical`, envio ação |
| `GameStateProvider` / `newUseGameState` | Ficha, combate, modais; `penaiBridge` para motor |
| `usePenaiTurnPipeline` | **Autoridade de fase** — WS lifecycle, stale sequence filter |
| `turnPipelineStore` | Pub/sub global `TurnPipelinePhase` + `InputGate` |
| `useTurnPipeline` / `useInputGate` | Hooks reativos ao store |
| `PenaiMechanicalSync` | Efeito: aplica `lastMechanical` na ficha/combate |
| `SettingsContext` / `AuthContext` | Preferências, JWT `token`, `aiAccess` |

Slices legados (`useGameNarrationSlice`, `isLoading`) coexistem para labels — **não** duplicar gate de fase.

### 8.2 Eventos WS PENAI (handler principal: `usePenaiTurnPipeline`)

| Evento | Efeito UI |
|--------|-----------|
| `connected` | Valida `contractVersion >= 2`, locale `pt-BR` |
| `mechanicalStateUpdate` | Fase `mechanical`; patch via `PenaiMechanicalSync` |
| `playerRollRequest` | Fase `rolling`; modal dados |
| `narrationQueued` | Fase `narrating` (exceto bootstrap/sync) |
| `storyFeed` / `storyFeedReplay` | Merge crônica `PenaiStoryFeed` |
| `gameStateUpdate` | Opções + merge (filtro sequence) |
| `narrationComplete` | Fase `idle`; libera gate |
| `narrationFailed` / `actionRejected` | `idle` + toast; `penai-turn-settled` |
| `syncPendingRoll` | Reconnect: reabre rolagem pendente |

Mensagens com `actionSequence < latestActionSequenceRef` são **descartadas** (`isStaleSequence`).

### 8.3 Auth e sessionStorage

| Chave | Propósito |
|-------|-----------|
| `localStorage token` | JWT único — `authToken.ts` |
| `cda:session:{id}:penaiOpening` | Evita reabertura duplicada (bootstrap PENAI) |
| `dndai_gemini_byok_key` | BYOK Gemini — `geminiApiKeyStorage.ts` |
| `dndai:session-opened:{id}` | Sessão aberta na aba (`sessionDevStorage`) |

WS URL: `buildPenaiWsUrl(token)` → `/ws?token=…`

### 8.4 Fluxo envio de ação (PENAI)

```mermaid
sequenceDiagram
    participant U as Usuário
    participant D as GameplayActionDock
    participant P as usePenaiTurnPipeline
    participant W as /ws PENAI

    U->>D: clica ação / texto
    D->>P: sendProcessAction
    P->>W: processAction { actionId, playerAction }
    Note over W: ver architecture/ws-pipeline-temporal
```

---

## 9. Componentes da mesa (V3)

| Componente | Função |
|------------|--------|
| `GameplayNarrativeLog` | Coluna central — `PenaiStoryFeed` + loading Temporal |
| `PenaiStoryFeed` | Crônica estilo livro; TTS via `/api/v2/tts/generate` |
| `GameplayActionDock` | Botões contextuais (exploração, social, combate) |
| `GameplayTopBar` | Região, relógio, **HeroVitalsStrip**, toggle narração/TTS |
| `HeroVitalsStrip` | PV (barra), CA (badge + tooltip equipado), FOR/DES/CON compactos |
| `GameplaySidePanel` | Tabs desktop — **Mapa \| Campanha \| Bolsa** |
| `GameplayMobileMenuPanel` | Drawer **Mais** — ficha (magias/XP), campanha, config |
| `GameplayMaisSheetSection` | Magias + progressão dentro de Mais |
| `GameplayInventoryPanel` | Bolsa + seção **Equipado agora** + `ItemCard` v2 |
| `CampanhaPanel` | Mood, reputação, pulso, crônica, journal, cast, fatos |
| `GameplayCombatTracker` | Iniciativa + `CombatantCardV2` (tokens `dnd-*`) |
| `SessionFactsPanel` | Fatos de sessão (`GET /v2/sessions/:id/facts`) |
| `SessionCastPanel` | Elenco / vitals PATCH |
| `GameplaySessionLogPanel` | Debug WS — **dev only** (`NEXT_PUBLIC_DEBUG_WS`) |
| `PenaiEngineIntro` | Hub — onboarding leigo (motor / narrador / mundo offline) |
| `DiceRollModal` | Integração dice-box |
| `ShopModal` / level-up modais | Motor disparou estado |
| `SettingsModal` | Modelo, voz, velocidade |

### 9.1 Dock contextual

Ações derivadas de `contextualDockActions` — mudam com região, combate, fase pipeline.

### 9.2 Combate na mesa

`showCombat` no shell → faixa `GameplayCombatTracker` acima do log — iniciativa e HP visíveis sem cobrir narrativa.

### 9.3 Aba Campanha (P7.5)

Side panel tab **`campanha`** (substitui História legado):

| Bloco | Dados |
|-------|--------|
| `PenaiExplainerAccordion` | Copy estática — motor, IA, mundo offline |
| `RegionMoodCard` | `GET /v2/sessions/:id/campaign` → `regionState` |
| `QuestTrackerCard` | `activeQuests[]` (dentro de `MundoVivoPanel`) |
| `ReputationPanel` | Barras por região/facção — tiers `reputationTiers` |
| `MundoVivoPanel` | WS `worldPulse` + REST eventos + quests |
| `PenaiStoryFeed` / `PenaiJournalPanel` | WS + REST journal |
| `SessionFactsPanel` / `SessionCastPanel` | Fatos RAG + elenco editável |
| `SharedWorldShardCard` | Shard regional compartilhado (`campaign.shard`, `timelineRecent`) |

Hook: `useSessionCampaign(sessionId)` — refetch em `worldPulse` e fim de narração.

Hub: `PenaiIntroModal` (first visit `localStorage penai_intro_seen`) + `PenaiEngineIntro`.

### 9.4 Bootstrap de sessão (tela de carga)

Nova sessão PENAI **não** abre a mesa até `worldBootstrap.status === 'ready'`.

| Peça | Função |
|------|--------|
| `usePenaiWorldBootstrap` | `POST /world-bootstrap` + poll `GET /ui-state` |
| `SessionWorldLoadingScreen` | Overlay fullscreen — passos region → factions → npcs → quests → economy → simulation → pulse |
| `GameplayScreen` | Monta hook com `sessionId`; retry em falha Gemini; overlay `HeroDeathScreen` em `gameOver` |
| `HeroDeathSavesBanner` | Testes de morte (sucessos/falhas) no log quando HP = 0 |
| `HeroDeathScreen` | Game over fullscreen — export cofre, nova campanha, reset nível 1, hub |

Copy dos passos: `WORLD_BOOTSTRAP_STEP_LABELS` em `penaiApi.ts`.

### 9.5 Mapa Aurathis (aba Mapa)

| Peça | Função |
|------|--------|
| `WorldMapModal` / `WorldMapPanZoom` | Pan/zoom sobre arte SVG/PNG |
| `aurathisMapArt.ts` | URL do asset (`/assets/AI/aurathis-continente-v*.svg`) |
| `worldMapLayout.ts` | Posição POIs/regiões sobre a arte |
| `PlayerMapMarker` | Marcador do herói |
| `PoiMapMarker` | POIs da região ativa |
| `RegionGraphView` | Grafo de viagem (fallback/alternativa) |

Calibração overlay: `docs/AURATHIS_MAP_OVERLAY.md` · prompt arte IA: `docs/AURATHIS_MAP_AI_PROMPT.md`.

---

## 10. Homebrew e tradução (UI)

### 10.1 Oficina (`homebrew_store`)

```mermaid
flowchart LR
    LIST[Lista / filtros] --> EDIT[Form por tipo]
    EDIT --> PRE[Preview .homebrew-preview]
    PRE --> PUB[Publicar ou privado]
    PUB --> INST[Instalar na sessão ativa]
```

| Tipo form | Campos guiados |
|-----------|----------------|
| race, class, spell, … | Wizard por tipo 5e API |
| translation | `sourceIndex` + overlay PT |
| AI creator | Gera JSON validado |

Badges `sourceKind`: original | translation | fork.

### 10.2 Estúdio de tradução

- Lista recursos SRD
- Editor overlay campos traduzíveis
- Preview lado a lado (EN vs PT)

### 10.3 Tradução global UI

- `loadTranslations()` no boot se `NEXT_PUBLIC_ENABLE_TRANSLATIONS=true`
- `translateRace`, `translateClass`, etc. em `translator.ts`
- Sem flag → termos EN do SRD nas listas

**Gap de produto:** PT completo exige flag + banco populado + homebrew translation nas sessões.

---

## 11. Áudio, TTS e imersão

| Recurso | Quando |
|---------|--------|
| `useStageAmbientSound` | Hub vs `playing` |
| `useMenuMusicCrossfade` | Menu principal |
| Narração TTS | Piper via `/api/v2/tts/generate` (`penaiStoryTts.ts`) |
| Vinheta dados | CSS flash em `globals.css` |

Config: `narrationVoice` (faber, razo, miro, dii), `narrationSpeed` no WS.

---

## 12. Responsivo e acessibilidade

| Requisito | Status |
|-----------|--------|
| `100dvh` + safe areas | Implementado |
| Dock acessível com teclado aberto | `keyboardViewportInset` |
| Contraste pergaminho/obsidian | OK narrativa |
| Ember não único indicador de erro | Ícone + texto |
| `prefers-reduced-motion` | Parcial — aplicar em heroes |
| Touch ≥ 44px dock | Meta |
| App Expo (Android/iOS) | `apps/mobile` — intro nativa + WebView do mesmo Next |

### 12.1 App móvel (Expo)

- **Cliente único:** após a intro orbital, `react-native-webview` carrega `EXPO_PUBLIC_WEB_APP_URL` (porta 9002 em dev) — mesma UI, API v2 e WS que o browser.
- **Auth:** bridge injeta `localStorage.token` e espelha em `expo-secure-store` (chave JWT alinhada ao web).
- **Dev em dispositivo:** `npm run dev:mobile:lan` (detecta IP, gera `.env.local`, sobe stack + Expo `--lan`). Next padrão escuta em `0.0.0.0:9002`; CORS dev aceita origens `192.168.*` (`penaiEnv.isDevLanOrigin`).

---

## 13. Checklist PR e manutenção

### PR frontend

- [ ] Tokens `dnd.*` (sem stone/amber novo)
- [ ] `playing` + hub testados
- [ ] `turnPipeline` respeitado
- [ ] `actionSequence` / loading
- [ ] Sem assets WotC
- [ ] Atualizar este doc se novo estágio ou shell

### Onde documentar mudanças

| Mudança | Doc |
|---------|-----|
| Cor, layout, estágio | **DESIGN_FRONTEND.md** (aqui) |
| WS, fila, IA | **ECOSSISTEMA.md** |
| Decisão dev longa | **MOM** + doc |

Screenshots: `docs/ui-screenshots/` (referência PR, não spec).

---

*Fim do design frontend.*
