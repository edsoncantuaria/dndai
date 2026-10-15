# Spec — UI V3: Redesenho cinematográfico completo (Hub + Mesa)

> Status: **rascunho para aprovação**
>
> Data: **2026-05-28**
>
> Direção escolhida: **`hub-a` + `game-a`** (inspirado em BG3).

---

## 1) Objetivo

Refazer **completamente** a camada de apresentação do *Crônicas de Aventuras* em uma linha única V3:

- **sem legado no repositório** (deletar componentes antigos e CSS utilitário não-semantico);
- **experiência cinematográfica** (WotC-adjacent, premium, “mesa” como centro);
- **turn pipeline distribuído** (mecânico síncrono vs narrativa assíncrona) refletido na UX com InputGate BG3-like;
- manter as invariantes do ecossistema (ordering por `actionSequence`, `narration_only`, heal roll reconnect).

---

## 2) Não-negociáveis (invariantes)

- **Sem coexistência**: não existir `NEXT_PUBLIC_UI_V2`, `*Legacy*`, nem rotas/branches alternativos.
- **Split**:
  - `mechanicalStateUpdate`: aplica estado mecânico **instantaneamente** na UI.
  - `gameStateUpdate`: commita prosa + opções (filtrado por ordering).
- **Ordering (P4.1)**: manter `latestActionSequenceRef` e descartar frames com `actionSequence` menor.
- **InputGate absoluto**: bloquear inputs state-changing em `mechanical` e `narrating` (e `rolling`).
- **Heal roll**: em reconexão, enviar `syncPendingRoll` e reabrir `DiceRollModal` via `pendingRollState`.

---

## 3) Direção de UX (o que “parece BG3” aqui)

### 3.1 Hub: `hub-a` (Hero + 1 CTA dominante)

**Primeira dobra**:

- Hero cinematográfico com “mesa em destaque”.
- **Um CTA dominante**: “Continuar Jornada: [Sessão]”.
- Secundários compactos: cofre, homebrew, settings, logout.

**O resto do hub**:

- “Mesas recentes” em grid menor (até 6).
- “Explorar” com cards (Cofre/Homebrew/Suas mesas/Tradução admin).

### 3.2 Mesa: `game-a` (3 blocos rígidos)

Desktop:

1) `GameplayTopBar` fixa (região + relógio + toggles).
2) Coluna central:
   - `GameplayCombatTracker` (faixa horizontal) quando combate ativo
   - `GameplayNarrativeLog`
   - `GameplayActionDock` (flutuante/ancorado) sob InputGate
3) Side panel persistente com tabs: Mapa | Inventário | Ficha

Mobile:

- Tabs inferiores (Narrativa | Mapa | Inventário | Ficha | Menu)
- Dock sobreposto na coluna narrativa com safe-area/keyboard inset.

---

## 4) Design system (tokens e tipografia)

### 4.1 Paleta semântica (V3)

Usar **apenas** tokens `dnd-*` (via `tokens.css` + Tailwind):

- `bg-dnd-obsidian`, `bg-dnd-obsidian-raised`
- `text-dnd-parchment`, `text-dnd-parchment-muted`
- `text-dnd-gold`, `border-dnd-gold`
- `bg-dnd-ember`, `text-dnd-ember`

### 4.2 Tipografia restrita

- `font-display` (Cinzel Decorative): títulos, hub, alertas táticos
- `font-narrative` (IM Fell English): prosa no log
- `font-ui` (Inter): números, forms, labels

### 4.3 Regra de migração

- Nenhum novo uso de `stone/amber/gray/red` utilitário em telas V3.
- CSS antigo não-semantico deve ser removido ao ser tocado.

---

## 5) Componentes e reescrita destrutiva (escopo)

### 5.1 Hub

- Consolidar hero/CTA do hub como canônico.
- Remover telas antigas remanescentes que não sejam consumidas pelo hub V3.

### 5.2 Mesa

- `GameplayShell` como layout canônico.
- Dock e free action com InputGate e bloqueio visual consistente.
- Combat tracker: cards compactos, dead dim, destaque do turno com acento ember.

---

## 6) Definition of Done

- Não existe `*Legacy*` no repo.
- Não existe `NEXT_PUBLIC_UI_V2` (nem código, nem `.env.example`).
- UI do turno: input state-changing só abre em `narrationComplete` (ou falha final + `stopLoading`).
- Ordering: frames antigos descartados (P4.1).
- Heal roll: reconexão reabre rolagem pendente.
- Tokens/typo: telas V3 usam `dnd-*` e `font-*` corretos.

