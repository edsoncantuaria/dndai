---
name: dndai-frontend-cinematic-design
description: Define diretrizes de UI cinematográfica WotC-adjacent + ritmo tático BG3-like, com InputGate absoluto e fluxo turnPipeline (idle/rolling/mechanical/narrating). Use ao redesenhar UI v2, mexer em GameplayShell/Dock/FreeActionSheet, tokens `dnd-*`, loaders do turno, ou ao remover legado (`NEXT_PUBLIC_UI_V2` / componentes *Legacy*).
disable-model-invocation: true
---

# dndai — Frontend Cinematográfico (WotC-adjacent + BG3-like)

## Fonte canônica (verbatim)

- Ler **antes de propor mudanças grandes**: `reference.md` (texto fornecido pelo usuário, sem alterações).

## Objetivo

Tornar a camada de apresentação **mais bonita e mais jogável**: reduzir fricção do turno distribuído, bloquear inputs concorrentes, manter legibilidade narrativa e consistência visual (sem “SaaS cinza”).

## Invariantes (não negociar)

- **InputGate absoluto**: qualquer ação state-changing deve respeitar o gate e só liberar em `narrationComplete` (ou falha final + `stopLoading`).
- **Integridade assíncrona**: `mechanicalStateUpdate` aplica números/estado antes da prosa; UI comunica “motor validou / DM narrando”.
- **Tokens sem hex**: não usar `bg-red-600`, `text-amber-500`, hex direto; usar `dnd-*`.
- **Preview não canônico**: `narrationStream` é preview, não “commit”.
- **Sem legado**: não reintroduzir `NEXT_PUBLIC_UI_V2`, *Legacy* components, ou “coexistência” de UI.

## Checklist de PR (frontend)

- **UI do turno**
  - [ ] `turnPipeline`: `idle → rolling → mechanical → narrating → idle` coerente
  - [ ] `InputGate` bloqueia **dock + free actions + hotkeys** state-changing em `LOCKED_*`
  - [ ] Copy BG3-like: “Motor validou… Mestre narrando…” em `LOCKED_NARRATING`
  - [ ] Timeout UX: CTA para recarregar/reconectar sem abrir gate automaticamente

- **WebSocket/ordenação**
  - [ ] `actionSequence`/discard de frames antigos permanece ativo
  - [ ] Heal de roll em reconnect (quando aplicável): `syncPendingRoll`/`pendingRollState`

- **Design system**
  - [ ] Tokens `dnd-*` e tipografias (`font-display`, `font-narrative`, `font-ui`) aplicados corretamente
  - [ ] Legibilidade: prosa em `dnd-parchment` sobre obsidian, sem fadiga
  - [ ] Sem “painel admin”: evitar tabelas cinza, inputs cruamente utilitários no gameplay

## Onde atualizar documentação

- Atualize `docs/DESIGN_FRONTEND.md` para refletir mudanças em shell, pipeline visual, InputGate e padrões BG3-like.
- Se tocar em protocolo WS/eventos do turno, atualizar também `docs/ECOSSISTEMA.md` (seções WS + pipeline).

