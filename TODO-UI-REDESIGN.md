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

- [ ] **Cores**
  - `--dnd-ember` (#C41E3A aprox. — vermelho WotC)
  - `--dnd-gold` (#C9A227)
  - `--dnd-obsidian` (#0A0A0C)
  - `--dnd-parchment` (#F4E8D0)
  - `--dnd-mist` (rgba branco 8% — overlays)
  - `--dnd-success` / `--dnd-danger` para combate
- [ ] **Tipografia**
  - Display: `Cinzel Decorative` (já em `layout.tsx`) — títulos hero
  - Corpo narrativo: `IM Fell English` ou `Literata` — blocos de texto longos
  - UI funcional: `Inter` ou `DM Sans` — labels, botões, forms
- [ ] **Espaçamento:** escala 4px; containers `max-w-screen-xl`
- [ ] **Raio / sombra:** cards com borda dourada sutil + `box-shadow` profunda
- [ ] **Motion:** durações 200ms (UI), 600–900ms (transições de cena), easing `cubic-bezier(0.22, 1, 0.36, 1)`

### 1.2 Componentes primitivos (`src/components/primitives/`)

- [ ] `DndButton` — primário ember, secundário outline gold, ghost parchment
- [ ] `DndCard` — vidro escuro + borda gradiente ouro
- [ ] `DndInput` / `DndTextarea` — estilo pergaminho escuro
- [ ] `DndHeading` — variantes hero / section / label
- [ ] `DndDivider` — ornamento (linha + losango)
- [ ] `DndBadge` — condições, nível, região
- [ ] `DndSheet` — bottom sheet mobile / side panel desktop
- [ ] `DndTabs` — ícones + labels (Inventário, Mapa, História, Ficha)
- [ ] `DndToast` — notificações temáticas
- [ ] `AmbientBackground` — vídeo loop / gradiente animado / partículas leves (CSS)

### 1.3 Layouts responsivos

| Breakpoint | Largura | Layout jogo |
|------------|--------|-------------|
| `xs` | &lt; 640px | Narrativa full; painéis em sheets; ações fixas no rodapé |
| `md` | 768px+ | Split 60/40 narrativa / contexto |
| `lg` | 1024px+ | Três colunas: narrativa · log lateral · ficha compacta |
| `xl` | 1280px+ | Hero desktop com margens generosas estilo dnd.com |

- [ ] Hook `useBreakpoint()` + `usePrefersReducedMotion()`

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

- [ ] Tela inicial com logo animado + “Bem-vindo à mesa”
- [ ] 2–3 slides curtos (swipe mobile / setas desktop) explicando: texto + IA + dados 3D
- [ ] CTA único: **Começar a aventura**
- [ ] Detectar `prefers-reduced-motion` → versão estática
- [ ] Mensagem “gire o dispositivo” só em landscape bloqueado (como no site oficial)

**Substituir / criar:** novo fluxo antes de `AuthGate`

### A.2 Autenticação (`features/auth/`)

**Substituir:** lógica em `AuthGate.tsx` (manter contratos `authService`)

- [ ] **Tela de login**
  - Fundo vídeo/imagem escura + vignette
  - Form minimal: email, senha, “Entrar”
  - Link para cadastro
- [ ] **Tela de cadastro**
  - Nome, email, senha, confirmar senha
  - Checkbox termos + licença/API key Gemini (fluxo existente)
  - Validação inline elegante (sem modais genéricos)
- [ ] Estados: loading, erro, sucesso → redirect para `/hub`
- [ ] Mobile: teclado não quebra layout; desktop: card central 480px

### A.3 Landing pós-login (`features/hub/landing/`)

Inspirada no hero do [dnd.com](https://www.dungeonsanddragons.com/):

- [ ] Hero: “Sua jornada começa aqui” + subtítulo
- [ ] Cards grandes: **Continuar**, **Nova aventura**, **Cofre de heróis**, **Homebrew**
- [ ] Carrossel “Destaques da comunidade” (facts da última sessão — já existe `featuredSessionFacts`)
- [ ] Footer discreto: configurações, logout, versão

---

## 4. Fase B — Menu principal e cofre

**Substituir:** `GameMenuContent.tsx` (659+ linhas) → dividir em features

### B.1 Hub principal (`features/hub/`)

- [ ] Grid de sessões com arte de capa (placeholder → IA imagem depois)
- [ ] Badge: região atual, nível do personagem, “rolagem pendente”
- [ ] Ações rápidas: jogar, renomear, clonar, excluir (manter modais, novo visual)
- [ ] Empty state cinematográfico: “Nenhuma crônica iniciada — forje seu destino”

### B.2 Cofre de heróis (`features/hub/vault/`)

- [ ] Cards de personagem estilo “ficha de mesa”
- [ ] Filtro por classe/raça/nível
- [ ] CTA: criar novo / iniciar sessão com este herói

### B.3 Configurações globais

**Evoluir:** `SettingsModal.tsx`

- [ ] Painel lateral desktop / sheet mobile
- [ ] Áudio ambiente, homebrew IA, TTS, API key — mesmas flags, nova UI

---

## 5. Fase C — Wizard de criação de personagem

**Substituir:** `NewCreationCharacter/*` + `useCharacterCreator` (manter hooks, refazer UI)

### Princípio Intro Experience

Um passo por tela, barra de progresso ornamental, ilustração lateral (desktop).

| Passo | Componente atual | Novo |
|-------|------------------|------|
| 1 | `NewStep1_RaceClass` | `RaceClassStep` — cards visuais grandes |
| 2 | `NewStep2_Attributes` | `AttributesStep` — rolagem animada ou point-buy visual |
| 3 | `NewStep3_Background` | `BackgroundStep` |
| 4 | `NewStep4_*` | `ProficienciesStep` |
| 5 | `NewStep5_Equipment2` | `EquipmentStep` — grid de itens com ícones |
| 6 | `NewStep6_Spells` | `SpellsStep` |
| 7 | `NewStep7_Feats` | `FeatsStep` |
| 8 | `NewStep8_Finalize` | `RevealStep` — “revelação” do herói (nome, retrato, resumo) |

- [ ] `NewStepper` → stepper vertical desktop / dots mobile
- [ ] Resumo fixo colapsável: atributos, CA, percepção
- [ ] Botões: Voltar (ghost) · Continuar (ember)
- [ ] Mobile: swipe entre passos (opcional fase 2)
- [ ] Ao finalizar: transição para hub ou direto “Iniciar primeira sessão”

---

## 6. Fase D — Homebrew Studio

**Substituir:** `Homebrew/*` (Store, Creator, forms)

### D.1 Loja / galeria (`HomebrewStore`)

- [ ] Layout tipo “grimoire marketplace” — categorias: itens, magias, monstros, raças
- [ ] Card com badge SRD / Fork / Original
- [ ] Instalar na sessão com feedback visual

### D.2 Criador (`HomebrewCreator`, forms)

- [ ] Wizard em abas com preview ao vivo
- [ ] `SrdSourcePanel` integrado como “herdar do SRD” (manter lógica)
- [ ] `AiCreator` com prompt único + resultado em card pergaminho

### D.3 Tradução (`TranslationStudio`)

- [ ] UI secundária, mesmo design system, prioridade menor

---

## 7. Fase E — Tela de jogo (coração do redesign)

**Substituir:** `GameScreen.tsx`, `Game.tsx`, `NewNarrativeLog.tsx`, `MobileToolbar.tsx`

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

- [ ] `GameplayTopBar` — `LocationHud` redesenhado
- [ ] `NarrativeStage` — substitui `NewNarrativeLog` (cartas, tipografia Fell, separadores)
- [ ] `ActionBar` — **exatamente 4 slots** de `actionOptions` + botão “Ação livre” abre textarea/modal
- [ ] Se IA enviar &lt; 4 opções: slots desabilitados ou “—”; se &gt; 4: carousel ou “mais…”
- [ ] Campo livre: modal estilo pergamínho ou expand inline (mobile)
- [ ] `LoadingOracle` — estados de `loadingLabels.ts` com animação runa/pulso

### 7.2 Rolagem 3D (NÃO REGREDIR)

**Manter:** `DiceRollModal.tsx`, `@3d-dice/dice-box`, `/assets/dice-box/`

- [ ] Refazer **chrome** do modal: moldura dourada, fundo blur, resultado em tipografia display
- [ ] Fullscreen no mobile durante rolagem
- [ ] Som + haptic (`navigator.vibrate`) opcional
- [ ] Integrar com banner “Abrir dados” do narrative log (scroll suave mantido)
- [ ] Crítico/falha: flash ember / névoa verde (CSS)

### 7.3 Combate

**Evoluir:** `NewCombatTracker.tsx`

- [ ] Barra de iniciativa horizontal estilo CRPG
- [ ] Cartões de combatente com HP animado
- [ ] Ataques via `StructuredAttackPanel` dentro do novo visual (não reescrever motor)

### 7.4 Painéis laterais (refazer 100%)

| Painel | Arquivo atual | Novo feature |
|--------|---------------|--------------|
| Inventário | `Inventory.tsx`, `ItemCard.tsx` | `features/gameplay/inventory/` — grid, peso, moedas, equipar |
| Mapa | `WorldMapModal.tsx`, `premium-map` | `features/gameplay/map/` — grafo interativo, POIs, névoa de guerra |
| História | `NewJournal.tsx`, `StoryHighlightsCard` | `features/gameplay/story/` — timeline vertical, facts, resumos |
| Ficha | fragmentos em `GameScreen` | `features/gameplay/character-sheet/` — abas Atributos, Magias, Relações |
| Progressão | `ProgressionTab`, `LevelUpModal` | integrar em ficha + modal level-up épico |

#### Mapa e grafo

- [ ] Visualização de grafo de regiões (dados de `regionClient` / `regionTree`)
- [ ] Nó atual pulsante em gold; rotas descobertas vs bloqueadas
- [ ] POIs como ícones no nó; zoom/pan (mobile: pinch)
- [ ] Link para `premium-map` se mantido — unificar estética

#### História / crônica

- [ ] Timeline com ícones por tipo (combate, social, descoberta)
- [ ] Facts da sessão (`getSessionFacts`) em cards colapsáveis
- [ ] `DailyRecapPanel` como “recapitulação do dia” estilo trailer text

### 7.5 Modais de jogo legados → skin nova

- [ ] `ShopModal`, `SpellCastModal`, `SkillCheckModal`, `LevelUpModal`
- [ ] `StructuredRestPanel`, `StructuredSkillPanel`, `StructuredSpellPanel`

---

## 8. Fase F — Mobile-first e gestos

- [ ] Safe areas iOS (`env(safe-area-inset-*)`)
- [ ] Bottom navigation: Narrativa · Mapa · Inventário · Ficha · Menu
- [ ] Pull-to-refresh desabilitado no log (evitar conflito scroll)
- [ ] Teclado virtual: action bar sobe com `visualViewport`
- [ ] Touch targets mín. 44px
- [ ] Testar em 390×844 e 360×800

---

## 9. Fase G — Motion, áudio e “surreal”

- [ ] `framer-motion` page transitions entre estágios
- [ ] Parallax leve no hero (desktop)
- [ ] `ambientSound.ts` — crossfade entre hub e jogo
- [ ] Vignette global (`Vignette.tsx` → integrar no shell)
- [ ] Micro-interações: hover em cards, ripple em botões ember
- [ ] Prefers-reduced-motion: desligar vídeos/parallax

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

- [ ] Marcar componentes legados `@deprecated` ao criar equivalente em `features/`
- [ ] Remover quando paridade atingida: `GameMenuContent` monólito, duplicatas homebrew
- [ ] Atualizar `globals.css` — tokens novos, remover estilos mortos
- [ ] Auditar `tailwind.config` — cores `dnd.*`
- [ ] Screenshots antes/depois por fase (pasta `docs/ui-screenshots/`)

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

1. Aprovar este roadmap (ajustar prioridades se necessário).
2. Criar branch `feat/ui-redesign-v2`.
3. Implementar **§1 Design System** + mock estático do **GameplayShell** (sem ligar backend) para validar direção visual.
4. Review comparando com [dnd.com](https://www.dungeonsanddragons.com/) e [intro-experience](https://www.dungeonsanddragons.com/intro-experience/).

---

*Documento vivo — marcar `[x]` conforme entregas. Não duplicar trabalho do `TODO.md` técnico (backend/IA); os dois convivem.*
