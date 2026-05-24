# Crônicas de Aventuras — Redesign UI/UX completo

> **Objetivo:** Remodelar **100% da interface** para uma experiência de aventura fantástica, inspirada na identidade visual do site oficial de [Dungeons & Dragons](https://www.dungeonsanddragons.com/) e na imersão da [Intro Experience](https://www.dungeonsanddragons.com/intro-experience/) — mesmo sendo um RPG narrado por texto, deve **parecer** épico, cinematográfico e “de tirar o fôlego”.
>
> **Escopo:** Mobile-first **e** desktop premium. **Backend e motor de regras permanecem**; esta iniciativa é principalmente frontend + design system + fluxos.
>
> **Última atualização:** 2026-05-23

---

## 0. Norte estético e emocional

### Referências visuais

| Referência | O que roubar |
|------------|----------------|
| [dnd.com](https://www.dungeonsanddragons.com/) | Hero fullscreen, tipografia serifada imponente, vermelho/ouro/preto, vídeos em loop, cards com hover dramático, sensação “oficial AAA” |
| [Intro Experience](https://www.dungeonsanddragons.com/intro-experience/) | Onboarding imersivo passo a passo, pausas cinematográficas, “rotate your device”, transições lentas, foco em uma ação por vez |
| Crônicas (atual) | Motor WS, `@3d-dice/dice-box`, hooks `game/*`, homebrew fork SRD — **manter a lógica**, trocar o invólucro |

### Palavras-chave do novo produto

`aventura` · `mistério` · `tocha` · `pergaminho` · `dragão` · `mesa` · `destino` · `imersão`

### Tom de interface

- **Narrativa em primeiro lugar:** o log de texto é o “palco”; UI ao redor é moldura, não competição.
- **Poucas decisões por tela:** no jogo, **4 opções sugeridas + campo livre** (ver §5).
- **Rolagem física:** manter dado 3D real (`DiceRollModal` + `dice-box`) como ritual — nunca substituir por número seco sem animação.
- **Mobile:** uma coluna, gestos, bottom sheets; **Desktop:** layout em três zonas (narrativa | contexto | ficha).

---

## 1. Design system — `src/design-system/`

Criar camada única antes de refazer telas (evita retrabalho).

### 1.1 Tokens (`tokens.css` + `tokens.ts`)

- [x] **Cores**
  - `--dnd-ember` (#C41E3A aprox. — vermelho WotC)
  - `--dnd-gold` (#C9A227)
  - `--dnd-obsidian` (#0A0A0C)
  - `--dnd-parchment` (#F4E8D0)
  - `--dnd-mist` (rgba branco 8% — overlays)
  - `--dnd-success` / `--dnd-danger` para combate
- [x] **Tipografia**
  - Display: `Cinzel Decorative` (já em `layout.tsx`) — títulos hero
  - Corpo narrativo: `IM Fell English` ou `Literata` — blocos de texto longos
  - UI funcional: `Inter` ou `DM Sans` — labels, botões, forms
- [x] **Espaçamento:** escala 4px; containers `max-w-screen-xl`
- [x] **Raio / sombra:** cards com borda dourada sutil + `box-shadow` profunda
- [x] **Motion:** durações 200ms (UI), 600–900ms (transições de cena), easing `cubic-bezier(0.22, 1, 0.36, 1)`

### 1.2 Componentes primitivos (`src/components/primitives/`)

- [x] `DndButton` — primário ember, secundário outline gold, ghost parchment
- [x] `DndCard` — vidro escuro + borda gradiente ouro
- [x] `DndInput` / `DndTextarea` — estilo pergaminho escuro
- [x] `DndHeading` — variantes hero / section / label
- [x] `DndDivider` — ornamento (linha + losango)
- [x] `DndBadge` — condições, nível, região
- [x] `DndSheet` — bottom sheet mobile / side panel desktop
- [x] `DndTabs` — ícones + labels (Inventário, Mapa, História, Ficha)
- [x] `DndToast` — notificações temáticas
- [x] `AmbientBackground` — vídeo loop / gradiente animado / partículas leves (CSS)

### 1.3 Layouts responsivos

| Breakpoint | Largura | Layout jogo |
|------------|--------|-------------|
| `xs` | &lt; 640px | Narrativa full; painéis em sheets; ações fixas no rodapé |
| `md` | 768px+ | Split 60/40 narrativa / contexto |
| `lg` | 1024px+ | Três colunas: narrativa · log lateral · ficha compacta |
| `xl` | 1280px+ | Hero desktop com margens generosas estilo dnd.com |

- [x] Hook `useBreakpoint()` + `usePrefersReducedMotion()`

### 1.4 Storybook (opcional mas recomendado)

- [ ] Documentar primitivos e estados (hover, disabled, loading)

---

## 2. Arquitetura de rotas e estágios

### 2.1 Evolução de `GameStage` (`src/types/gameStage.ts`)

```ts
// Alvo (expandir gradualmente)
| 'intro'              // splash cinematográfico (novo)
| 'auth'               // login/cadastro unificado (novo)
| 'landing'            // home pós-login estilo dnd.com (novo)
| 'main_menu'          // hub de aventuras
| 'session_list'
| 'character_vault'
| 'creating_character'
| 'homebrew_studio'    // renomear homebrew_store
| 'playing'
| 'translation_studio'
```

- [ ] Separar **rotas Next** onde fizer sentido (`/`, `/auth`, `/play/[sessionId]`, `/create`, `/homebrew`) em vez de um único `page.tsx` monolítico
- [ ] Manter `GameContainer` como orquestrador fino ou migrar para layout `(game)` + `(marketing)`

### 2.2 Estrutura de pastas alvo

```
src/
├── app/
│   ├── (marketing)/page.tsx          # Landing pública
│   ├── (auth)/login/page.tsx
│   ├── (auth)/register/page.tsx
│   ├── (app)/hub/page.tsx            # Menu principal
│   ├── (app)/create/page.tsx         # Wizard personagem
│   ├── (app)/play/[id]/page.tsx      # Sessão de jogo
│   └── (app)/homebrew/page.tsx
├── design-system/
├── features/
│   ├── auth/
│   ├── hub/
│   ├── character-create/
│   ├── gameplay/
│   │   ├── narrative/
│   │   ├── actions/                  # 4 opções + livre
│   │   ├── dice/                     # DiceRollModal
│   │   ├── inventory/
│   │   ├── map/
│   │   ├── story/
│   │   └── combat/
│   └── homebrew/
└── components/                       # legado → migrar e apagar
```

---

## 3. Fase A — Experiência de entrada (estilo Intro Experience)

### A.1 Splash / Intro (`features/intro/`)

- [x] Tela inicial com logo animado + “Bem-vindo à mesa”
- [x] 2–3 slides curtos (swipe mobile / setas desktop) explicando: texto + IA + dados 3D
- [x] CTA único: **Começar a aventura**
- [x] Detectar `prefers-reduced-motion` → versão estática
- [x] Mensagem “gire o dispositivo” só em landscape bloqueado (como no site oficial)

**Substituir / criar:** novo fluxo antes de `AuthGate`

### A.2 Autenticação (`features/auth/`)

**Substituir:** lógica em `AuthGate.tsx` (manter contratos `authService`)

- [x] **Tela de login**
  - Fundo vídeo/imagem escura + vignette
  - Form minimal: email, senha, “Entrar”
  - Link para cadastro
- [x] **Tela de cadastro**
  - Nome, email, senha, confirmar senha
  - Checkbox termos + licença/API key Gemini (fluxo existente)
  - Validação inline elegante (sem modais genéricos)
- [x] Estados: loading, erro, sucesso → redirect para landing
- [x] Mobile: teclado não quebra layout; desktop: card central 480px

### A.3 Landing pós-login (`features/hub/landing/`)

Inspirada no hero do [dnd.com](https://www.dungeonsanddragons.com/):

- [x] Hero: “Sua jornada começa aqui” + subtítulo
- [x] Cards grandes: **Continuar**, **Nova aventura**, **Cofre de heróis**, **Homebrew**
- [x] Carrossel “Destaques da comunidade” (facts da última sessão — já existe `featuredSessionFacts`)
- [x] Footer discreto: logout, versão

---

## 4. Fase B — Menu principal e cofre

**Substituir:** `GameMenuContent.tsx` (659+ linhas) → dividir em features

### B.1 Hub principal (`features/hub/`)

- [x] Grid de sessões com arte de capa (placeholder → IA imagem depois)
- [x] Badge: região atual, nível do personagem (rolagem pendente quando API expuser flag)
- [x] Ações rápidas: jogar, renomear, clonar, excluir (sheet v2 + modais GameContainer)
- [x] Empty state cinematográfico: “Nenhuma crônica iniciada — forje seu destino”

### B.2 Cofre de heróis (`features/hub/vault/`)

- [x] Cards de personagem estilo “ficha de mesa”
- [x] Filtro por classe/raça/nível
- [x] CTA: criar novo / iniciar sessão com este herói

### B.3 Configurações globais

**Evoluir:** `SettingsModal.tsx`

- [x] Painel lateral desktop / sheet mobile
- [x] Áudio ambiente, homebrew IA, TTS, API key — mesmas flags, nova UI (chrome v2 em SettingsModal)

---

## 5. Fase C — Wizard de criação de personagem

**Substituir:** `NewCreationCharacter/*` + `useCharacterCreator` (manter hooks, refazer UI)

### Princípio Intro Experience

Um passo por tela, barra de progresso ornamental, ilustração lateral (desktop).

| Passo | Componente atual | Novo |
|-------|------------------|------|
| 1 | `NewStep1_RaceClass` | [x] wizard v2 (UI shell; lógica mantida) |
| 2 | `NewStep2_Attributes` | [x] wizard v2 |
| 3 | `NewStep3_Background` | [x] wizard v2 |
| 4 | `NewStep4_*` | [x] wizard v2 |
| 5 | `NewStep5_Equipment2` | [x] wizard v2 |
| 6 | `NewStep6_Spells` | [x] wizard v2 |
| 7 | `NewStep7_Feats` | [x] wizard v2 (auto-skip não-variante) |
| 8 | `NewStep8_Finalize` | [x] `RevealStep` — finalização + modal |

- [x] `NewStepper` → `CreationStepper` vertical desktop / dots mobile
- [x] Resumo fixo colapsável: atributos, CA, percepção (`CharacterSummaryCollapsible`)
- [x] Botões: Voltar (ghost) · Continuar (ember) (`WizardStepLayout`)
- [ ] Mobile: swipe entre passos (opcional fase 2)
- [x] Ao finalizar: modal confirmação → cofre (`onCharacterCreated`)

---

## 6. Fase D — Homebrew Studio

**Substituir:** `Homebrew/*` (Store, Creator, forms)

### D.1 Loja / galeria (`HomebrewStore`)

- [x] Layout Grimório (`HomebrewLayout` + `HomebrewStorePage`) — marketplace embarcado
- [x] Card com badge SRD / Fork / Original (`showSourceBadges`)
- [x] Traduções de sistema **fora** do marketplace (`hideTranslationEntry`, filtro `type !== translation`)
- [ ] Instalar na sessão com feedback visual (polish)

### D.2 Criador (`HomebrewCreator`, forms)

- [x] Wizard 3 etapas v2 + `HomebrewLivePreview` lateral (Grimório embarcado)
- [x] `SrdSourcePanel` `variant="v2"` — “Herdar do SRD”
- [x] `AiCreator` v2 — `DndSheet`, prompt único, card pergaminho antes do editor
- [x] Reskin dos forms (`RaceForm`, `SpellForm`, etc.) — tokens `hb` + CSS `.hb-form`

### D.3 Tradução (`TranslationStudio`) — **rota separada**

- [x] `TranslationLayout` (tom ciano) + `TranslationStudioPage` — distinto do Grimório
- [x] Hub: card “Tradução” só admin (`user.id === 1`); Grimório para todos
- [x] `TranslationStudio` `variant="v2"` sem header duplicado

---

## 7. Fase E — Tela de jogo (coração do redesign)

**Substituir:** `GameScreen.tsx`, `Game.tsx`, `NewNarrativeLog.tsx`, `MobileToolbar.tsx`

### E.0 Integração (ativa com UI v2)

- [x] `GameplayScreen` — shell real + `GameStateContext` (substitui layout legado quando v2)
- [x] `GameplayActionDock` — 4 slots + loot/rolagem/combate/SDR
- [x] Painéis laterais: mapa, história, inventário, ficha (componentes legados reutilizados)
- [x] Modais preservados: dados 3D, skill/spell, level-up, shop, mapa mundi
- [x] `/ui-preview` → `GameplayPreviewShell` (mock)

### 7.1 Layout geral `GameplayShell`

```
┌─────────────────────────────────────────────────────────────┐
│  Top bar: região · relógio · menu · som                      │
├──────────────────────────────┬──────────────────────────────┤
│                              │  Tabs: Mapa | História | ...  │
│   NARRATIVA (scroll)         │  (desktop: coluna direita)    │
│   · entradas tipo cartas     │                              │
│   · TTS play por bloco       │  Mobile: bottom nav 4 ícones │
│                              │                              │
├──────────────────────────────┴──────────────────────────────┤
│  ACTION BAR: [Opção 1][Opção 2][Opção 3][Opção 4]  [✎ Livre] │
│  Estado: Mestre pensando… / Aguardando rolagem                 │
└─────────────────────────────────────────────────────────────┘
```

- [x] `GameplayTopBar` — região, clima/hora, narração, menu
- [x] `NarrativeStage` — `NewNarrativeLog` com `variant="v2"` via `GameplayNarrativeLog` (TTS/imagens/rolagens preservados)
- [x] `ActionBar` — 4 slots + “—” se faltar opção
- [x] Se IA enviar &gt; 4 opções: carousel paginado na `ActionBar`
- [x] Campo livre: `GameplayFreeActionSheet` (pergaminho)
- [x] `LoadingOracle` + banner `resolveLoadingState`

### 7.2 Rolagem 3D (NÃO REGREDIR)

**Manter:** `DiceRollModal.tsx`, `@3d-dice/dice-box`, `/assets/dice-box/`

- [x] Refazer **chrome** do modal: moldura dourada, fundo blur, resultado em tipografia display
- [x] Fullscreen no mobile durante rolagem
- [x] Som + haptic (`navigator.vibrate`) opcional — cues `diceRoll` / `diceCritical` / `diceFailure` em `useEventFeedback`
- [x] Integrar com banner “Abrir dados” do narrative log (scroll + foco no painel do modal)
- [x] Crítico/falha: flash ember / névoa verde (CSS)

### 7.3 Combate

**Evoluir:** `NewCombatTracker.tsx`

- [x] Barra de iniciativa horizontal estilo CRPG (`InitiativeRail`)
- [x] Cartões de combatente com HP animado (`CombatantCardV2`)
- [x] Ataques via `StructuredAttackPanel` `variant="v2"` em `GameplayCombatTracker`

### 7.4 Painéis laterais (refazer 100%)

| Painel | Arquivo atual | Novo feature |
|--------|---------------|--------------|
| Inventário | `Inventory.tsx`, `ItemCard.tsx` | [x] `features/gameplay/inventory/` — grid, peso, moedas, equipar |
| Mapa | `WorldMapModal.tsx`, `premium-map` | [x] `features/gameplay/map/` — grafo + modal mundi |
| História | `NewJournal.tsx`, `StoryHighlightsCard` | [x] `features/gameplay/story/` — timeline, facts, diário |
| Ficha | fragmentos em `GameScreen` | [x] `features/gameplay/character-sheet/` — abas Atributos, Magias, Relações, Progressão |
| Progressão | `ProgressionTab`, `LevelUpModal` | [x] aba Progressão na ficha v2; modal level-up (E.5) |

#### Mapa e grafo

- [x] Visualização de grafo de regiões (`RegionGraphView` + `regionTree`)
- [x] Nó atual pulsante em gold; rotas descobertas vs bloqueadas
- [x] POIs contagem no nó; pan + scroll zoom
- [x] Link para `WorldMapModal` via botão no painel mapa

#### História / crônica

- [x] Timeline com ícones por tipo (`StoryTimeline`)
- [x] Facts da sessão (`SessionFactsPanel` + `getSessionFacts`)
- [x] `DailyRecapPanel` `variant="v2"` no painel mapa

### 7.5 Modais de jogo legados → skin nova

- [x] `ShopModal`, `SpellCastModal`, `SkillCheckModal`, `LevelUpModal` — `DndGameModalShell` + tokens dnd
- [x] `StructuredRestPanel`, `StructuredSkillPanel`, `StructuredSpellPanel` — `variant="v2"` no `GameplayActionDock`

---

## 8. Fase F — Mobile-first e gestos

- [x] Safe areas iOS (`--dnd-safe-*` + `viewportFit: cover` + padding no shell)
- [x] Bottom navigation: Narrativa · Mapa · Inventário · Ficha · Menu (`GameplayMobileMenuPanel`)
- [x] Pull-to-refresh desabilitado no log (`.gameplay-narrative-scroll` + `useGameplayScrollLock`)
- [x] Teclado virtual: action bar sobe com `useKeyboardViewportInset` + Visual Viewport API
- [x] Touch targets mín. 44px (`DndButton`, bottom nav, top bar)
- [x] Viewports alvo documentados: 390×844 (iPhone 14) e 360×800 (Android comum) — validar no DevTools

---

## 9. Fase G — Motion, áudio e “surreal”

- [x] `framer-motion` page transitions entre estágios (`StageTransition` no `GameContainer`)
- [x] Parallax leve no hero (desktop) — `HubHeroParallax` em `HubLayout` + `HubLanding`
- [x] Crossfade hub ↔ jogo — `ambientSoundCrossfade.ts`, `useStageAmbientSound`, `useMenuMusicCrossfade`, `AmbientAudioEngine`
- [x] Vignette global — `Vignette` (`subtle` hub, `hp` em `GameplayShell`)
- [x] Micro-interações: hover em `DndCard`, ripple em `DndButton` ember
- [x] Prefers-reduced-motion: parallax/transições/ripple/vinhetas pulsantes desligados

---

## 10. O que NÃO refazer (preservar)

| Área | Motivo |
|------|--------|
| `backend/*`, WebSocket, motor de regras | Estável pós-refatoração Fases 0–7 |
| `hooks/game/*`, `newUseGameState` | Orquestração já splitada |
| `DiceRollModal` + dice-box | Requisito explícito de imersão |
| `authService`, `gameService`, `webSocketService` | Apenas consumir |
| Schemas Zod / tipos `types.ts` | Adaptar UI aos tipos, não inverter |
| Pipeline IA `narration_only` | Narrativa continua vindo da IA; UI só exibe |

---

## 11. Migração e limpeza

- [x] Marcar componentes legados `@deprecated` (`GameScreenLegacy`, `GameMenuContentLegacy`, Homebrew, combate, criação)
- [x] Extrair monólito do menu → `GameMenuContentLegacy.tsx`; roteador fino em `GameMenuContent.tsx`
- [x] Homebrew: páginas v2 em `features/homebrew/` (store ainda embute motor legado até migração total)
- [x] `globals.css` — `.hb-form` com tokens CSS; keyframes duplicados removidos (usar Tailwind)
- [x] `tailwind.config` — cores `dnd.*` alinhadas a `tokens.css` (`ember-muted`, `obsidian-glass`, `mist-strong`)
- [x] Pasta `docs/ui-screenshots/` + `docs/legacy-ui.md` + `src/lib/legacyUiMap.ts`

---

## 12. Ordem de execução recomendada

```
Fase 1 Design System (§1)
    ↓
Fase A Intro + Auth + Landing (§3)
    ↓
Fase B Hub + Cofre (§4)
    ↓
Fase C Wizard personagem (§5)
    ↓
Fase E Gameplay shell + 4 opções + dados 3D (§7.1–7.2)  ← MVP jogável bonito
    ↓
Fase E Painéis (inventário, mapa, história) (§7.4)
    ↓
Fase D Homebrew (§6)
    ↓
Fase F Mobile polish (§8)
    ↓
Fase G Motion final (§9)
```

**MVP visual jogável:** Design System + Auth + Hub + Gameplay shell (narrativa + 4 opções + dice) — **~3–4 semanas** estimadas.

**Redesign completo:** **~10–14 semanas** (1 dev full-time), paralelizável com 2 devs (UI + features).

---

## 13. Métricas de sucesso (UI)

- [ ] Lighthouse Performance ≥ 75 mobile, ≥ 85 desktop (com vídeos lazy-load)
- [ ] Nenhum overflow horizontal em 320px width
- [ ] Tempo até primeira interação no jogo &lt; 3s após sessão carregada
- [ ] 4 action options sempre visíveis sem scroll no action bar (mobile)
- [ ] Rolagem 3D inicia em &lt; 1s após abrir modal
- [ ] Teste com 5 usuários: “parece oficial / épico” (escala 1–5, média ≥ 4)

---

## 14. Riscos

| Risco | Mitigação |
|-------|-----------|
| Escopo infinito | Fases com MVP; feature flags `NEXT_PUBLIC_UI_V2` |
| Regressão gameplay | Mesmos hooks; testes E2E críticos (WS, roll queue) |
| Performance vídeo/3D | Lazy load; pausar dice-box quando modal fechado |
| Fontes WotC | Inspirar paleta/tipografia **sem** copiar assets protegidos — arte original/IA |

---

## 15. Checklist rápido por arquivo legado

| Arquivo | Ação |
|---------|------|
| `src/app/page.tsx` | Dividir rotas |
| `src/components/Auth/AuthGate.tsx` | → `features/auth` |
| `src/components/GameContainer.tsx` | Enxugar orquestração |
| `src/components/game-menu/GameMenuContent.tsx` | **Substituir** por `features/hub` |
| `src/components/GameScreen.tsx` | **Substituir** por `GameplayShell` |
| `src/components/NewNarrativeLog.tsx` | → `NarrativeStage` |
| `src/components/DiceRollModal.tsx` | **Skin nova**, manter dice-box |
| `src/components/NewCreationCharacter/*` | **Refazer UI** passo a passo |
| `src/components/Homebrew/*` | **Refazer** em `features/homebrew` |
| `src/components/Inventory.tsx` | → `features/gameplay/inventory` |
| `src/components/world-map/*` | → `features/gameplay/map` |
| `src/components/NewJournal.tsx` | → `features/gameplay/story` |
| `src/app/globals.css` | Tokens §1 |

---

## 16. Próximo passo imediato

1. ~~Aprovar este roadmap (ajustar prioridades se necessário).~~
2. Criar branch `feat/ui-redesign-v2` (pendente).
3. ~~Implementar **§1 Design System** + mock estático do **GameplayShell**~~ → ver `/ui-preview`.
4. Review comparando com [dnd.com](https://www.dungeonsanddragons.com/) e [intro-experience](https://www.dungeonsanddragons.com/intro-experience/).
5. ~~Fase A (Intro + Auth + Landing)~~ — ativa por padrão (`NEXT_PUBLIC_UI_V2=false` para legado).
6. ~~Fase B (Hub principal + Cofre)~~ — `features/hub/`.
7. ~~Fase C (Wizard de criação)~~ — `features/character-create/CharacterCreationWizard`.
8. ~~Fases E–G (Gameplay, mobile, motion)~~ — ver checklists §7–§9.
9. **Próximo:** migração/limpeza (§11), métricas (§13) ou polish pontual.

---

*Documento vivo — marcar `[x]` conforme entregas. Não duplicar trabalho do `TODO.md` técnico (backend/IA); os dois convivem.*
