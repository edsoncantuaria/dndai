# UI V3 Cinematic Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever completamente a camada de apresentação em uma linha única V3 (Hub `hub-a` + Mesa `game-a`), removendo UI antiga do repositório e garantindo invariantes (split mecânico/narrativo, ordering P4.1, InputGate BG3-like, heal-roll reconnect).

**Architecture:** Hub cinematográfico com 1 CTA dominante (retomar sessão) e navegação secundária compacta. Mesa fullscreen em 3 blocos rígidos (topbar + coluna narrativa + sidepanel), com dock e free-action fisicamente bloqueados por fases do turno e ordering via `actionSequence`.

**Tech Stack:** Next.js 15, React 18, TypeScript, Tailwind (`dnd-*` tokens), Framer Motion, WebSocket client (`src/services/webSocketService.ts`).

---

## File map (o que deve existir após a V3)

**V3 canônico (mantém / evolui):**
- `src/app/page.tsx`
- `src/components/GameContainer.tsx`
- `src/components/game-menu/GameMenuContent.tsx`
- `src/features/hub/*` (Hub V3)
- `src/features/gameplay/*` (Mesa V3)
- `src/hooks/game/useGameWebSocket.ts`
- `src/hooks/game/turnPipelineStore.ts`
- `src/hooks/game/useInputGate.ts`
- `src/design-system/tokens.css`
- `src/app/globals.css`

**Remover do repo (não pode sobrar):**
- Qualquer `*Legacy*`
- Qualquer “UI antiga” ainda referenciada (ex.: `src/components/NewNarrativeLog.tsx`, `src/components/NewJournal.tsx`, `src/components/NewRelationships.tsx`, `src/components/CombatantCard.tsx`, etc.) **após migração para equivalentes V3**.
- Pasta `src/components/NewCreationCharacter/` (não pode sobrar)

---

### Task 1: Consolidar Hub V3 (`hub-a`) e deletar sobras não-canônicas

**Files:**
- Modify: `src/features/hub/HubMain.tsx`
- Modify: `src/features/hub/HubLayout.tsx`
- Modify: `src/components/game-menu/GameMenuContent.tsx`
- Delete: quaisquer componentes de hub/menu antigos ainda não usados

- [ ] **Step 1: Ajustar o “Featured Chronicle” para CTA dominante**

Implementar no `HubMain.tsx`:
- “Última mesa” (sessão mais recente) deve sempre renderizar o CTA grande “Continuar Jornada: {session.nome}”.
- Se não houver sessões, CTA grande vira “Criar herói” e direciona para cofre.

- [ ] **Step 2: Garantir que o hub não tenha rotas/telas antigas “escondidas”**

Checar `GameMenuContent.tsx` e remover qualquer import que aponte para componentes antigos de homebrew/tradução (fora de `src/features/homebrew`).

- [ ] **Step 3: Verificação manual rápida**

Rodar:

```bash
npm run -s dev
```

Abrir:
- hub → aparece 1 CTA dominante
- navegar para cofre/homebrew/sessões

- [ ] **Step 4: Verificação automatizada mínima**

Rodar:

```bash
npm run -s lint
```

Expected: sem erros novos em arquivos tocados.

---

### Task 2: Mesa V3 (`game-a`) — layout 3 blocos rígidos (desktop) + tabs (mobile)

**Files:**
- Modify: `src/features/gameplay/GameplayShell.tsx`
- Modify: `src/features/gameplay/GameplayScreen.tsx`
- Modify: `src/features/gameplay/components/GameplayTopBar.tsx`
- Modify: `src/features/gameplay/components/GameplaySidePanel.tsx`
- Modify: `src/features/gameplay/components/GameplaySidePanelContent.tsx`

- [ ] **Step 1: Desktop grid rígido**

Em `GameplayShell.tsx`, garantir:
- TopBar fixa
- coluna narrativa central (tracker + log + dock)
- painel lateral persistente com tabs (map/inventory/sheet)

- [ ] **Step 2: Mobile tabs**

Em `GameplayShell.tsx`, garantir:
- tabs inferiores: Narrative/Map/Inventory/Sheet/Menu
- dock sobreposto com safe-area e keyboard inset já existentes

- [ ] **Step 3: Verificação visual**

Rodar:

```bash
npm run -s dev
```

Validar:
- desktop lg+: side panel persistente
- mobile: tabs mudam conteúdo

---

### Task 3: InputGate absoluto (BG3-like) com bloqueio físico/visual

**Files:**
- Modify: `src/hooks/game/useGameWebSocket.ts`
- Modify: `src/hooks/game/turnPipelineStore.ts`
- Modify: `src/features/gameplay/components/GameplayActionDock.tsx`
- Modify: `src/features/gameplay/GameplayFreeActionSheet.tsx`

- [ ] **Step 1: Gate sempre derivado de sinais do pipeline**

No `useGameWebSocket.ts`, garantir que `setInputGate(deriveInputGate(...))` rode sempre que:
- fase muda
- loading muda
- roll request aparece/desaparece
- pending actions muda

- [ ] **Step 2: Bloqueio físico do dock**

Em `GameplayActionDock.tsx`, aplicar overlay visual quando `isStateChangingBlocked(gate)` for true:
- `pointer-events-none` overlay
- `opacity` + `backdrop-blur` leve
- texto status BG3-like quando `LOCKED_NARRATING`

- [ ] **Step 3: FreeActionSheet bloqueado**

Em `GameplayFreeActionSheet.tsx`:
- textarea `disabled`
- aviso “Input bloqueado…”
- impedir submit por teclado e botão

- [ ] **Step 4: Verificação manual**

Com `npm run dev`, validar:
- Enviar ação → dock bloqueia até `narrationComplete`
- Roll pendente → dock bloqueia e modal de dados aparece

---

### Task 4: WebSocket V3 — ordering P4.1 + split mecânico/narrativo + heal-roll

**Files:**
- Modify: `src/hooks/game/useGameWebSocket.ts`
- Verify: `src/services/webSocketService.ts`

- [ ] **Step 1: Ordering P4.1**

Garantir que `acceptActionSequence` seja aplicado em:
- `gameStateUpdate`
- `narrationComplete`
- `narrationQueued`

Regra: se `payload.actionSequence < latestActionSequenceRef.current`, descartar.

- [ ] **Step 2: Split**

Garantir que `mechanicalStateUpdate`:
- aplica patches de estado imediatamente
- muda fase para `mechanical`

E que `gameStateUpdate`:
- só commita prosa/opções (após filtro)

- [ ] **Step 3: Heal roll**

No listener `connectionOpen`, enviar:

```ts
sendMessage('syncPendingRoll', { sessionId })
```

E no evento `pendingRollState`, reabrir a rolagem (`setPhase('rolling')`) quando vier `pending.rollRequest`.

- [ ] **Step 4: Verificação manual**

Simular:
- refresh/reconnect enquanto roll pendente
- confirmar que `DiceRollModal` volta automaticamente

---

### Task 5: CombatTracker V3 — rail horizontal + cards compactos + dead dim + ember pulse

**Files:**
- Modify: `src/features/gameplay/combat/GameplayCombatTracker.tsx`
- Modify: `src/features/gameplay/combat/CombatantCardV2.tsx`
- Modify: `src/features/gameplay/combat/InitiativeRail.tsx`
- Verify: `src/features/gameplay/combat/useCombatTrackerData.ts`

- [ ] **Step 1: Linha horizontal acima do log**

Em `GameplayShell.tsx`, manter o tracker em uma faixa horizontal acima do log narrativo.

- [ ] **Step 2: Dead dim**

Garantir em `CombatantCardV2.tsx` e `InitiativeRail.tsx`:
- `isDead: true` → `opacity` reduzida e visual de derrotado

- [ ] **Step 3: Ember pulse do turno**

No `GameplayCombatTracker.tsx`, quando `isPlayerTurn`:
- acento ember (pulsação leve) + destaque de turno atual

- [ ] **Step 4: Verificação manual**

Em combate ativo:
- o turno atual destaca
- mortos ficam apagados

---

### Task 6: Tokens/typo — remover utilitários genéricos e consolidar `dnd-*`

**Files:**
- Modify: `src/design-system/tokens.css`
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`
- Modify: arquivos V3 tocados no hub/mesa

- [ ] **Step 1: Garantir fontes**

Verificar `src/app/layout.tsx` com:
- `Cinzel_Decorative` → `--font-cinzel`
- `IM_Fell_English` → `--font-im-fell`
- `Inter` → `--font-inter`

- [ ] **Step 2: Remover CSS legado**

Apagar classes em `globals.css` que dependam de `stone/amber/red` utilitário e não sejam usadas em V3.

- [ ] **Step 3: Replace utilitário por token (só em telas V3)**

Exemplos:
- `text-stone-400` → `text-dnd-parchment-muted`
- `bg-stone-900/…` → `bg-dnd-obsidian-raised/…`
- `border-amber-*` → `border-dnd-gold/…`

- [ ] **Step 4: Verificação**

Rodar:

```bash
npm run -s lint
```

---

### Task 7: Remoção total de módulos antigos do repo (deletar de verdade)

**Files:**
- Delete: `src/components/NewCreationCharacter/**`
- Delete: `src/components/NewNarrativeLog.tsx` (após migração)
- Delete: `src/components/NewJournal.tsx` (após migração)
- Delete: `src/components/NewRelationships.tsx` (após migração)
- Delete: qualquer outro componente “New*” antigo fora de `features/*` que não seja consumido

- [ ] **Step 1: Mapear dependências remanescentes**

Rodar:

```bash
npm run -s typecheck
```

E listar cada arquivo antigo ainda importado por módulos V3.

- [ ] **Step 2: Migrar imports para equivalentes V3**

Para cada import antigo encontrado, substituir por módulo em `src/features/**` (ou criar um equivalente V3).

- [ ] **Step 3: Deletar os arquivos**

Após nenhum import restante, deletar os arquivos antigos.

- [ ] **Step 4: Verificação final**

Rodar:

```bash
npm run -s lint
npm run -s typecheck
npm run test --prefix backend
```

Expected:
- lint ok
- typecheck ok
- backend tests ok

---

## Plan self-review

- Spec coverage:
  - Hub `hub-a`: Task 1
  - Mesa `game-a`: Task 2
  - InputGate BG3-like: Task 3
  - Ordering P4.1 + split + heal-roll: Task 4
  - CombatTracker V3: Task 5
  - Tokens/typo: Task 6
  - Remoção destrutiva de UI antiga: Task 7

- Placeholder scan: sem “TODO/TBD”; comandos e paths incluídos.
- Type consistency: nomes e paths referenciam arquivos existentes no repo.

