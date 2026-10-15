# Spec — UI v2: Input Gate do Turno (hard-lock até `narrationComplete`)

> Status: **aprovado**
>
> Data: **2026-05-27**
>
> Objetivo: tornar a mesa **jogável em produção** eliminando ações concorrentes e “cascatas” de intents enquanto o turno ainda está fechando (split mecânico × narrativo).

---

## 1) Problema

O split do turno é correto (hot path mecânico → worker narrativo), mas a UI pode:

- liberar input após `mechanicalStateUpdate` e antes do `gameStateUpdate`/`narrationComplete`;
- permitir que o jogador dispare intents contra um alvo que o motor já considerou morto ou fora de alcance;
- entrar em “limbo UX” em reconexão (roll pendente, 409, etc.).

Resultado: frustração, double-submit e dessincronia de expectativa (“vi HP cair, então posso agir” vs “o turno ainda está fechando”).

---

## 2) Princípio de design (D&D)

Em D&D, quando o **DM ainda está resolvendo e narrando o desfecho**, a mesa não empilha novas intenções táticas. A UI deve espelhar isso:

- **bloqueia qualquer ação que altera estado** enquanto o turno fecha;
- **mantém interação de leitura** (scroll, inspect, tooltips, abrir ficha) sempre disponível;
- comunica explicitamente: “o motor validou, o DM está narrando”.

---

## 3) Objetivo e “Definition of Done”

**DoD:**

- Nenhum caminho de UI consegue disparar `processAction`/intents enquanto o gate estiver fechado.
- Gate só abre novamente no evento **`narrationComplete`** (ou erro final).
- Reconexão re-hidrata rolagem pendente automaticamente (heal), evitando travamento do jogador.
- UX deixa claro o estado: *validado mecanicamente* vs *narrando*.

---

## 4) Modelo de estado proposto: `InputGate`

### 4.1 Estados

- `OPEN`: jogador pode enviar intents (dock/sheet/hotkeys).
- `LOCKED_MECHANICAL`: ação aceita, aguardando delta mecânico/roll.
- `LOCKED_ROLLING`: existe `playerRollRequest` pendente (modal de dados ativo).
- `LOCKED_NARRATING`: delta mecânico já aplicado; aguardando narração e fechamento do turno.

### 4.2 Fonte canônica do gate

O gate é **client-side**, mas dirigido por eventos WS **canônicos**:

- `playerRollRequest` / `mechanicalStateUpdate` / `narrationQueued` / `narrationComplete` / `error`/`stopLoading`
- `pendingRollState` (heal de reconnect)

---

## 5) Regras de transição (determinísticas)

### 5.1 Ao enviar ação

- Ao acionar `processAction` (UI):
  - set `LOCKED_MECHANICAL` imediatamente (otimista) ou no `actionAck`/`startLoading`.

### 5.2 Ao receber `playerRollRequest`

- Set `LOCKED_ROLLING`
- Somente o modal de dados deve aceitar “submit roll”.

### 5.3 Ao receber `mechanicalStateUpdate`

- Set `LOCKED_NARRATING`
- A UI mostra “motor validou” e impede novos intents.

### 5.4 Enquanto narra

- Eventos `narrationQueued`/`narrationStream`/`gameStateUpdate` **não abrem** o gate.
- `narrationStream` é “preview”, jamais canônico para liberar input.

### 5.5 Ao receber `narrationComplete`

- Set `OPEN`
- Limpa loaders relacionados ao `actionId` (se aplicável)

### 5.6 Falha final

- Em `error` + `stopLoading` (após tentativas):
  - Set `OPEN`
  - Exibir toast com mensagem e CTA (“tentar novamente” / “reconectar”).

---

## 6) Escopo de bloqueio (o que fica indisponível)

### 6.1 Bloqueado (state-changing)

Qualquer UI que gere intent/ação:

- `GameplayActionDock`
- `GameplayFreeActionSheet`
- botões táticos de combate / exploração que disparem `processAction`
- hotkeys/atalhos que disparem intents

### 6.2 Permitido (view-only)

Interação de leitura e inspeção:

- scroll do log
- abrir/fechar ficha
- tooltips/inspect/hover
- zoom/pan mapa
- configurações e UI não-mecânica

---

## 7) UX: Loader “DM narrando” (anti-frustração)

### 7.1 Mensagem

Durante `LOCKED_NARRATING`, mostrar indicador persistente (banner/overlay leve):

- “O motor validou sua ação. O Mestre está descrevendo o desfecho…”

Se houver `narrationStream`, opcionalmente:

- exibir *preview* incremental (sem commitar como log canônico)

### 7.2 Requisitos de UI

- Deve ser evidente que **não é travamento**, é “resolução de turno”.
- Não deve ocultar o tabuleiro/log; deve ser leve e informativo.

---

## 8) Reconexão e heal de rolagem pendente

Ao reconectar:

- cliente envia `syncPendingRoll { sessionId }`
- servidor responde `pendingRollState`
  - se `pending != null`: re-hidrata `playerRollRequest` e seta `LOCKED_ROLLING`
  - se `pending == null`: mantém gate conforme o estado local (ex.: `LOCKED_NARRATING` se havia ação em andamento)

---

## 9) Timeouts e comportamento seguro

### 9.1 Timeout de narração

Se ficar em `LOCKED_NARRATING` por mais de \(T\) (ex.: 20–30s):

- mostrar CTA: “Recarregar” / “Reconectar”
- **não** liberar input automaticamente (abrir o gate sem `narrationComplete` recria o bug)

### 9.2 Timeout de rolagem

Se `LOCKED_ROLLING` e o modal foi perdido:

- o heal em reconnect cobre o caso
- UI pode exibir CTA “Reabrir rolagem” (futuro), mas o servidor é fonte do pendente

---

## 10) Observabilidade (mínima)

- Métrica/telemetria: tempo médio em `LOCKED_NARRATING`
- Contagem de “tentativa de clicar em ação enquanto bloqueado” (para calibrar UX)

---

## 11) Plano de entrega (PRs pequenas)

1. Introduzir `inputGate` central (store/hook) + mapear eventos WS → gate.
2. Bloquear `GameplayActionDock` + `GameplayFreeActionSheet` + hotkeys.
3. Loader “DM narrando” com copy + preview opcional de stream.
4. Timeout UX (CTA) + métricas.

