# UI Input Gate TurnPipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bloquear qualquer ação “state-changing” na UI v2 entre `processAction` e `narrationComplete`, mantendo interação de leitura, com UX “DM narrando” e heal de rolagem pendente no reconnect.

**Architecture:** Introduzir um `InputGate` derivado da fase do `turnPipeline` + sinais WS (roll pendente / loading / narrationComplete) e consumi-lo em `GameplayActionDock` + `GameplayFreeActionSheet` + caminhos de submit. O gate é client-side, dirigido por eventos canônicos (WS).

**Tech Stack:** Next.js/React, hooks existentes (`useGameWebSocket`, `turnPipelineStore`), UI v2 (`GameplayActionDock`, `GameplayFreeActionSheet`, `GameplayScreen`).

---

## File structure (mudanças planejadas)

**Modify:**
- `src/hooks/game/turnPipelineStore.ts` — estender para expor `InputGate` e helpers
- `src/hooks/game/useTurnPipeline.ts` — manter como está (pode ser usado para derivar UI)
- `src/hooks/game/useGameWebSocket.ts` — garantir que as transições `idle/rolling/mechanical/narrating` estejam coerentes e que `narrationComplete` sempre volte pra `idle`
- `src/features/gameplay/components/GameplayActionDock.tsx` — bloquear seletor e mostrar “motor validou/DM narrando” de modo BG3-like
- `src/features/gameplay/GameplayFreeActionSheet.tsx` — aceitar `disabled` e bloquear submit/hotkey
- `src/features/gameplay/GameplayScreen.tsx` — impedir `handleFreeSubmit` quando gate fechado; passar `disabled` pro sheet; reforçar overlay/banner

**Create:**
- `src/hooks/game/inputGate.ts` — lógica pura (derivação do gate a partir de sinais) para permitir teste unitário fácil
- `src/__tests__/inputGate.spec.ts` — testes com `node:test` (sem Vitest no frontend)

**Modify (scripts):**
- `package.json` — adicionar `test:frontend` rodando `node --test` para os testes do gate

---

## Task 1: Definir modelo `InputGate` + derivação pura

**Files:**
- Create: `src/hooks/game/inputGate.ts`
- Test: `src/__tests__/inputGate.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Criar a função pura de gate (sem React)**

```ts
// src/hooks/game/inputGate.ts
export type InputGate =
  | 'OPEN'
  | 'LOCKED_MECHANICAL'
  | 'LOCKED_ROLLING'
  | 'LOCKED_NARRATING';

export type TurnPipelinePhase = 'idle' | 'rolling' | 'mechanical' | 'narrating';

export type InputGateSignals = {
  phase: TurnPipelinePhase;
  hasPlayerRollRequest: boolean;
  hasPendingActions: boolean; // pendingActionsRef.size > 0
  isLoading: boolean;
};

export function deriveInputGate(s: InputGateSignals): InputGate {
  if (s.hasPlayerRollRequest || s.phase === 'rolling') return 'LOCKED_ROLLING';
  if (s.phase === 'narrating') return 'LOCKED_NARRATING';
  if (s.isLoading || s.hasPendingActions || s.phase === 'mechanical') return 'LOCKED_MECHANICAL';
  return 'OPEN';
}

export function isStateChangingBlocked(gate: InputGate): boolean {
  return gate !== 'OPEN';
}
```

- [ ] **Step 2: Adicionar testes unitários com `node:test`**

```ts
// src/__tests__/inputGate.spec.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveInputGate, isStateChangingBlocked } from '@/hooks/game/inputGate';

test('deriveInputGate: roll sempre bloqueia', () => {
  assert.equal(
    deriveInputGate({ phase: 'idle', hasPlayerRollRequest: true, hasPendingActions: false, isLoading: false }),
    'LOCKED_ROLLING',
  );
});

test('deriveInputGate: narrating bloqueia até complete', () => {
  assert.equal(
    deriveInputGate({ phase: 'narrating', hasPlayerRollRequest: false, hasPendingActions: true, isLoading: true }),
    'LOCKED_NARRATING',
  );
  assert.equal(isStateChangingBlocked('LOCKED_NARRATING'), true);
});

test('deriveInputGate: idle sem loading fica OPEN', () => {
  assert.equal(
    deriveInputGate({ phase: 'idle', hasPlayerRollRequest: false, hasPendingActions: false, isLoading: false }),
    'OPEN',
  );
  assert.equal(isStateChangingBlocked('OPEN'), false);
});
```

- [ ] **Step 3: Adicionar script de teste no frontend**

```json
// package.json (trecho)
{
  "scripts": {
    "test:frontend": "node --test --import tsx \"src/__tests__/**/*.spec.ts\"",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 4: Rodar testes e typecheck**

Run:
- `npm run test:frontend`
- `npm run typecheck`

Expected:
- PASS nos testes do gate
- typecheck sem erros

- [ ] **Step 5: Commit**

Run:
```bash
git add package.json src/hooks/game/inputGate.ts src/__tests__/inputGate.spec.ts
git commit -m "test(frontend): adiciona InputGate derivado e testes unitários"
```

---

## Task 2: Expor `InputGate` no store/hook do turno

**Files:**
- Modify: `src/hooks/game/turnPipelineStore.ts`
- Create: `src/hooks/game/useInputGate.ts`

- [ ] **Step 1: Estender `turnPipelineStore` com estado derivado**

```ts
// src/hooks/game/turnPipelineStore.ts (adição)
import type { InputGate } from './inputGate';

let inputGate: InputGate = 'OPEN';
type InputGateListener = (gate: InputGate) => void;
const gateListeners = new Set<InputGateListener>();

export function getInputGate(): InputGate {
  return inputGate;
}

export function setInputGate(next: InputGate): void {
  if (inputGate === next) return;
  inputGate = next;
  gateListeners.forEach(fn => fn(inputGate));
}

export function subscribeInputGate(fn: InputGateListener): () => void {
  gateListeners.add(fn);
  return () => gateListeners.delete(fn);
}
```

- [ ] **Step 2: Criar hook reativo `useInputGate()`**

```ts
// src/hooks/game/useInputGate.ts
'use client';
import { useEffect, useState } from 'react';
import { getInputGate, subscribeInputGate } from './turnPipelineStore';
import type { InputGate } from './inputGate';

export function useInputGate(): InputGate {
  const [gate, setGate] = useState<InputGate>(() => getInputGate());
  useEffect(() => subscribeInputGate(setGate), []);
  return gate;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/game/turnPipelineStore.ts src/hooks/game/useInputGate.ts
git commit -m "feat(frontend): adiciona store de InputGate"
```

---

## Task 3: Dirigir o gate a partir de WS (hard-lock até `narrationComplete`)

**Files:**
- Modify: `src/hooks/game/useGameWebSocket.ts`
- Modify: `src/hooks/game/turnPipelineStore.ts` (apenas se precisar de helpers)

- [ ] **Step 1: Garantir que `narrationComplete` sempre volta a fase para `idle`**

Implementar no `handleNarrationComplete`:

```ts
setTurnPipelinePhase('idle');
```

Somente quando não há `pendingActions` e não há `playerRollRequest` (como já é feito para loading).

- [ ] **Step 2: Atualizar `InputGate` em pontos canônicos**

Depois de cada transição relevante (set de phase/roll/loading), chamar:

```ts
setInputGate(deriveInputGate({ phase, hasPlayerRollRequest: Boolean(...), hasPendingActions: ..., isLoading: ... }))
```

Onde:
- `phase`: estado atual do turnPipeline (conhecido no handler)
- `hasPlayerRollRequest`: `interactionState.playerRollRequest != null` ou payload re-hidratado no heal
- `hasPendingActions`: `pendingActionsRef.current.size > 0`
- `isLoading`: estado local `isLoading`

- [ ] **Step 3: Timeout UX (não liberar input)**

Quando disparar o toast de timeout hoje (recarregar sessão), manter gate fechado até o reload completar; não abrir “por conta”.

- [ ] **Step 4: Rodar `npm run test:frontend` + `npm run typecheck`**

- [ ] **Step 5: Commit**

```bash
git add src/hooks/game/useGameWebSocket.ts
git commit -m "feat(frontend): hard-lock de input até narrationComplete"
```

---

## Task 4: Bloquear `GameplayActionDock` (BG3-like) e mostrar estado “motor validou / DM narrando”

**Files:**
- Modify: `src/features/gameplay/components/GameplayActionDock.tsx`

- [ ] **Step 1: Consumir `useInputGate()` e bloquear ações state-changing**

Substituir o `isActionLocked` atual (derivado de `isLoading`, `isRollPending`, etc.) por:

- `isActionLocked = isStateChangingBlocked(gate) || ...` (mantendo loot/hitDice como exceções se forem “state-changing” obrigatórias do motor)

Regra sugerida:
- Se gate != OPEN, **desabilitar** o `ActionBar` e botões contextuais.

- [ ] **Step 2: Copy BG3-like**

Quando gate for `LOCKED_NARRATING`, setar `statusLabel` para algo como:
- “O motor validou. O Mestre descreve o desfecho…”

Quando gate for `LOCKED_MECHANICAL`:
- “Resolvendo a ação…”

- [ ] **Step 3: Rodar `npm run lint` + `npm run typecheck`**

- [ ] **Step 4: Commit**

```bash
git add src/features/gameplay/components/GameplayActionDock.tsx
git commit -m "feat(frontend): bloqueia ActionDock via InputGate"
```

---

## Task 5: Bloquear `GameplayFreeActionSheet` e `handleFreeSubmit`

**Files:**
- Modify: `src/features/gameplay/GameplayFreeActionSheet.tsx`
- Modify: `src/features/gameplay/GameplayScreen.tsx`

- [ ] **Step 1: Adicionar prop `disabled` no sheet**

```ts
export interface GameplayFreeActionSheetProps {
  // ...
  disabled?: boolean;
}
```

E:
- desabilitar `DndTextarea`
- desabilitar botão “Enviar”
- ignorar Ctrl/Cmd+Enter quando `disabled`

- [ ] **Step 2: Em `GameplayScreen`, impedir submit quando gate fechado**

No `handleFreeSubmit`:
- se gate bloqueado: mostrar toast “Aguarde o Mestre terminar a narração.”
- não enviar `processPlayerAction`

- [ ] **Step 3: Commit**

```bash
git add src/features/gameplay/GameplayFreeActionSheet.tsx src/features/gameplay/GameplayScreen.tsx
git commit -m "feat(frontend): bloqueia free actions via InputGate"
```

---

## Task 6: QA manual (Go-Live check)

**Run:**
- `npm run dev` (frontend)
- `npm run dev --prefix backend` (backend)
- Rodar uma sessão e executar:

- [ ] **Cenário 1: Ataque com rolagem**
  - Ação gera `playerRollRequest` → gate vira ROLLING; dock/sheet bloqueados.
  - Envia roll → `mechanicalStateUpdate` chega → gate vira NARRATING; dock continua bloqueado.
  - Ao `narrationComplete` → gate OPEN; dock libera.

- [ ] **Cenário 2: Reconectar durante roll**
  - Forçar refresh/queda WS durante `LOCKED_ROLLING`
  - Conectar → `syncPendingRoll` → `pendingRollState` → modal volta; gate continua ROLLING.

- [ ] **Cenário 3: Narration timeout**
  - Simular atraso do worker (temporário) → banner/loader aparece, dock não libera; CTA oferece recarregar.

---

## Plan self-review (feito no final)

- Cobertura do spec: gate, transições, bloqueio de dock/sheet, loader/copy, heal reconnect, timeouts.
- Sem placeholders “TBD”.
- Assinaturas/types consistentes (`InputGate`, `deriveInputGate`).

