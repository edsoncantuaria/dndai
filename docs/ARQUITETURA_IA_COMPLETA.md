 # Arquitetura completa de IA — Crônicas de Aventuras

Documento único e autocontido que descreve **todo** o ecossistema de inteligência artificial do jogo: princípios, fluxos, schemas, prompts, provedores, validação, memória, persistência e variáveis de ambiente. Destina-se a quem precisa entender ou auditar o sistema sem abrir dezenas de arquivos.

**Última revisão alinhada ao código:** maio de 2026 (P0–P4 concluídos: motor síncrono + narração BullMQ, JSON OSS minimal fixo, `actionSequence`, idempotência, snapshot Redis, sem feature flags de arquitetura).

**Complementos:** `ARQUITETURA_JOGO_COMPLETA.md` · `ARQUITETURA_P4_DISTRIBUIDO.md` · `ARQUITETURA_P5_RESILIENCIA.md` · `TODO-ARQUITETURA.md`

---

## Sumário

1. [Princípio fundamental: motor vs IA](#1-princípio-fundamental-motor-vs-ia)
2. [Visão geral em camadas](#2-visão-geral-em-camadas)
3. [Modos de operação](#3-modos-de-operação)
4. [Pontos de entrada da IA](#4-pontos-de-entrada-da-ia)
5. [Fluxo do jogador até a resposta](#5-fluxo-do-jogador-até-a-resposta)
6. [Camada DM (Mestre virtual)](#6-camada-dm-mestre-virtual)
7. [Serviço central: processPlayerTurn](#7-serviço-central-processplayerturn)
8. [Montagem de contexto (antes do LLM)](#8-montagem-de-contexto-antes-do-llm)
9. [Dois motores de narração: OSS e legado](#9-dois-motores-de-narração-oss-e-legado)
10. [Pipeline OSS (detalhado)](#10-pipeline-oss-detalhado)
11. [Pipeline legado Gemini/OpenRouter (detalhado)](#11-pipeline-legado-geminiopenrouter-detalhado)
12. [Schemas: referência completa](#12-schemas-referência-completa)
13. [Prompts: referência completa](#13-prompts-referência-completa)
14. [Pós-processamento e contrato narrativo](#14-pós-processamento-e-contrato-narrativo)
15. [Combate, rolagens e o que a IA não faz](#15-combate-rolagens-e-o-que-a-ia-não-faz)
16. [Persistência após a IA](#16-persistência-após-a-ia)
17. [Memória: SQL, fatos e Qdrant](#17-memória-sql-fatos-e-qdrant)
18. [Serviços auxiliares de IA](#18-serviços-auxiliares-de-ia)
19. [TTS, imagem e streaming](#19-tts-imagem-e-streaming)
20. [Telemetria e depuração](#20-telemetria-e-depuração)
21. [Variáveis de ambiente](#21-variáveis-de-ambiente)
22. [Índice de arquivos no repositório](#22-índice-de-arquivos-no-repositório)
23. [Diagramas de referência](#23-diagramas-de-referência)
24. [Sistema distribuído da narração (P4)](#24-sistema-distribuído-da-narração-p4)

---

## 1. Princípio fundamental: motor vs IA

O jogo separa duas responsabilidades que **nunca** devem se misturar em produção:

| Camada | Responsabilidade | Exemplos |
|--------|------------------|----------|
| **Motor de regras (backend)** | Tudo que altera estado mecânico de forma autoritativa | HP, CA, inventário, moeda, loot, loja, slots de magia, XP, level-up, combate (iniciativa, turnos, dano), rolagens (`playerRollRequest`), viagem entre regiões, validação de intents estruturados |
| **IA (Mestre narrador)** | Prosa, atmosfera, diálogos de NPCs, consequências **já resolvidas** pelo motor, sugestões de próximos passos | `logEntries`, `actionOptions`, `systemLog`, `memoryContext`, `newFacts` narrativos |
| **Jogador** | Escolhe opções na UI, usa ficha, rola nos **dados 3D** quando o motor pedir | Não “comanda” a IA para ganhar itens ou mudar HP por texto livre |

O modo padrão chama-se **`narration_only`**: a IA devolve apenas narrativa e opções; qualquer campo de estado que o modelo alucinar (HP, combate, loot, rolagem) é **descartado** antes de persistir ou enviar ao cliente.

O jogador **não manipula a IA** para alterar regras. Texto livre passa por classificação (heurística e opcionalmente um LLM leve); mecânica estruturada passa pelo motor via `intent` tipado.

---

## 2. Visão geral em camadas

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js)                                              │
│  GameStateProvider → useNewGameState → useGameActions            │
│  webSocketService (processAction, submitRollResult)              │
│  GameplayScreen, DiceRollModal, dock de ações                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ WebSocket (JWT)
┌────────────────────────────▼────────────────────────────────────┐
│  BACKEND Express + WebSocket                                     │
│  action-pipeline/ → motor síncrono → dispatchNarrationToQueue    │
│  narrationJobProcessor (BullMQ) → processPlayerTurn              │
│  rules/* · dmTurnOrchestrator · narrarService                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   OpenRouter           MySQL TypeORM         Redis (BullMQ + cache)
                                                        Qdrant
   (gpt-oss-120b)       sessões, logs,       cache, embeddings
                        personagem, combate
```

**Infraestrutura típica (Docker):** MySQL, Redis, fork da API 5e-SRD, Piper TTS, Qdrant (opcional), chaves OpenRouter no servidor.

---

## 3. Modos de operação

### 3.1 `AI_PIPELINE_MODE`

Único modo suportado: **`narration_only`**.

Valores antigos como `full` ou `dual` no `.env` são ignorados com aviso no log. Não existe mais fase de “estado” separada na IA: o `phaseOrchestrator` retorna `statePhase: null` e só executa a fase narrativa.

### 3.2 `AI_ENGINE`

| Valor | Comportamento |
|-------|---------------|
| **`oss`** | Recomendado em produção/Docker. Usa `ai-oss/orchestration/narrationPipeline.ts` → OpenRouter, modelo típico `openai/gpt-oss-120b:free`, prompts compactos. |
| **`legacy`** (default no código se a variável não estiver definida) | Usa `services/aiService.ts` → `getGameUpdate`, prompts grandes via `promptAssembler.ts`, failover Gemini + OpenRouter. |

A escolha ocorre em `narration/phaseOrchestrator.ts` via `isOssEngineEnabled()`.

### 3.3 Chaves de API

- **OpenRouter:** `OPENROUTER_KEY1` … `OPENROUTER_KEYN` no servidor; rotação e cooldown em `OpenRouterManager`.
- **`OPENROUTER_PREFER_SERVER_KEYS=true`:** o backend usa chaves do servidor mesmo que o cliente envie `apiKey` vazio nas configurações.
- **Gemini (legado):** `GEMINI_API_KEY` ou `GOOGLE_API_KEY` para fallback na cadeia legada.

Sem chave resolvível, `processAction` falha com erro explícito pedindo configuração de `OPENROUTER_KEY1..N`.

---

## 4. Pontos de entrada da IA

Nem toda chamada a um LLM passa pelo mesmo caminho. Esta é a lista completa:

| Entrada | Canal | Função principal |
|---------|-------|------------------|
| **Turno narrativo principal** | WS `processAction` | Motor/DM síncrono → **fila** → worker chama `processPlayerTurn` |
| **Desfecho após dados 3D** | WS `submitRollResult` | `resolveStructuredRoll` → fila `kind: roll` → `completeManualRollAndNarrate` no worker |
| **Intent com delta sem rolagem** | `handleStructuredIntent` | Delta + `mechanicalStateUpdate` → fila com prompt DM |
| **Intent com rolagem** | `processAction` + `intent` | `issuePendingRollToPlayer` — **sem IA** até `submitRollResult` |
| **REST (P4.8)** | `POST /api/sessions/:id/actions` | Mesma fila que WS via `tryEnqueueRestNarration` quando Redis + `apiKey`; resposta `narration_queued` — cliente precisa de WS para `gameStateUpdate` |
| **Fallback sem Redis** | Handlers WS / REST | `processPlayerTurn` inline (`REDIS_URL=mock` ou fila indisponível) |
| **Classificador de ação livre** | Interno ao DM | `classifyFreeActionWithLlm` — JSON pequeno, modelo leve, **opcional** |
| **Criação de homebrew** | HTTP / serviço | `aiCreationService` — JSON de item/criatura para API 5e |
| **Embeddings / recall** | Interno | `vectorMemoryService` + OpenRouter embeddings → Qdrant |
| **Imagem de cena** | Pós-persistência | `imageGenerationService` — opcional, não é o Mestre textual |

O **hot path** do gameplay é: `processAction` (WebSocket) → motor/DM **síncrono** → `dispatchNarrationToQueue` → worker BullMQ → `processPlayerTurn` → OSS ou legado → `persistNarrationTurn` (com claim idempotente) → `gameStateUpdate` + `narrationComplete`. O handler WS **não** chama `processPlayerTurn` quando a fila aceita o job.

---

## 5. Fluxo do jogador até a resposta

### 5.1 Frontend

1. O jogador digita ação ou escolhe botão no dock (`GameplayActionDock`, ficha, combate).
2. `useGameActions.processPlayerAction` monta payload e chama `sendMessage('processAction', { ... })`.
3. Payload inclui: `contractVersion: 1`, `sessionId`, `prompt`, `intent` (opcional), `combatState`, `apiKey`, `model`, `useAiHomebrew`, `narrationVoice`, `narrationSpeed`, `actionId`, `clientStateVersion`, `clientInstanceId`, `actionCursor`.
4. `useGameWebSocket` escuta: `actionAck`, **`mechanicalStateUpdate`**, `narrationLoading`, **`narrationQueued`**, **`narrationCancelled`**, `narrationStream` (preview não canônico), `gameStateUpdate`, `actionResolution`, `narrationComplete`, `stopLoading`, `error`. Payloads relevantes incluem **`actionSequence`** (servidor).
5. `turnPipelineStore` / `useTurnPipeline` — fases `idle` | `rolling` | `mechanical` | `narrating`.
6. `latestActionSequenceRef` (P4.1) — descarta `gameStateUpdate` / `narrationComplete` com `actionSequence` menor que o último visto.

### 5.2 Backend WebSocket (`processAction`)

**Handler:** `action-pipeline/processActionHandler.ts`

1. Valida **`ProcessActionSchema`** (Zod) e `contractVersion`.
2. Bloqueia se **rolagem pendente** (409).
3. Valida **`clientStateVersion`** → `STATE_DESYNC` se divergir.
4. Fases: `RECEIVED` → `NORMALIZED` → `RULES` / `AI_SYNTHESIS` → `DELTA_APPLIED`.
5. Com **`intent`**: `handleStructuredIntent`
   - `rejected` → erro.
   - `needs_roll` → `playerRollRequest` (sem fila de narração).
   - `accepted` + `stateDelta` → mecânico + **`dispatchNarrationToQueue`** → `narrationQueued` → return.
   - `DM_AUTO_ROLL=true` → exceção síncrona (`completeRollAndNarrate`).
6. **Texto livre**: `processFreeActionWithDmFlow({ ws, … })`
   - rolagem emitida → resposta com `playerRollRequest` (síncrona).
   - senão → fila → `isNarrationQueuedResponse` → return (sem `gameStateUpdate` narrativo no handler).
7. Fallback síncrono no handler só sem Redis (testes).

### 5.3 WebSocket (`submitRollResult`)

**Handler:** `action-pipeline/submitRollResultHandler.ts`

1. `resolveStructuredRoll` + `advanceCombatPhaseAfterRoll` (FSM).
2. `nextRollRequest` → novo `playerRollRequest`, sem narração.
3. `shouldNarrate === false` → só `actionResolution` / estado.
4. Caso contrário: **`dispatchNarrationToQueue`** (`kind: 'roll'`, payload com `pending`, `diceValues`, `resolutionResult`).
5. Worker: `narrationJobProcessor` → `completeManualRollAndNarrate` → `sendToUser` com `gameStateUpdate` + `narrationComplete`.
6. `applyMotorPostRollEffects` no worker (loot, XP, combate).

---

## 6. Camada DM (Mestre virtual)

O DM não é um modelo separado: é **orquestração em código** que decide se o turno precisa de rolagem mecânica antes de chamar o LLM narrador.

**Arquivo central:** `backend/src/services/dm/dmTurnOrchestrator.ts`

### 6.1 Funções principais

| Função | Papel |
|--------|-------|
| `processFreeActionWithDmFlow` | Texto livre; com `ws` enfileira narração em vez de `processPlayerTurn` inline |
| `dispatchNarrationToQueue` | `queue/narrationDispatch.ts` — `allocateActionSequence`, cancela jobs obsoletos, mecânico + BullMQ + WS |
| `tryClassifyAndIssueRoll` | Classifica e, se preciso, emite rolagem sem narrar |
| `issuePendingRollToPlayer` | Salva rolagem pendente; resposta mínima com `playerRollRequest` |
| `narrateAfterPlayerRoll` | Após dados 3D: monta prompt de desfecho e chama `processPlayerTurn` |
| `completeRollAndNarrate` | Modo `DM_AUTO_ROLL=true`: servidor rola e narra |
| `completeManualRollAndNarrate` | Ponte WebSocket pós-`submitRollResult` |
| `narrateOpeningScene` | Abertura de sessão (“A aventura começa”) |

### 6.2 Classificação de ação livre

Ordem em `tryClassifyAndIssueRoll`:

1. **`inferSkillCheckFromFreeText`** (sempre ativo — heurística em português + **`skillActionSemantics`** para corrigir perícia errada, ex.: “acrobacia para enganar” → Enganação).
2. Se ainda sem intent e `DM_LLM_CLASSIFY` ativo e há API key: **`classifyFreeActionWithLlm`** (ver seção 18).
3. **`validateActionIntent`** no motor.
4. Se `needs_roll`: emite rolagem (3D ou auto-roll) e **retorna sem** `processPlayerTurn`.
5. Se não classificou rolagem: segue para narração direta.

### 6.3 Prompt DM (`dmPromptBuilder.ts`)

Antes de `processPlayerTurn`, o texto do jogador é envolvido em instruções de fase:

| Fase `DmTurnPhase` | Quando | Conteúdo extra |
|--------------------|--------|----------------|
| `scene` | Abertura | 2–4 parágrafos, 3–5 actionOptions, sem pedir rolagem |
| `action` | Ação livre sem teste | Consequências diretas |
| `roll_outcome` | Após rolagem | Resultado já resolvido + hints do motor |
| `combat` | Combate ativo | Beat tático; HP vem do motor |

Blocos adicionais: resumo do **elenco** (`getCastSummaryForSession`), hints `[Motor]`, `[Combate]`, resultado formatado da rolagem (`formatRollOutcomeForDm`).

Esse prompt composto vira o **`playerAction`** passado ao `processPlayerTurn` (não é o texto cru do jogador em todos os casos).

### 6.4 Variáveis DM

| Variável | Padrão | Efeito |
|----------|--------|--------|
| `DM_AUTO_ROLL` | `false` | Se `true`, servidor rola sozinho (sem modal 3D) |
| Heurística PT + `skillActionSemantics` | sempre no código | Sem env — `inferSkillCheckFromFreeText` |
| `DM_LLM_CLASSIFY` | `true` | LLM auxiliar; `false` para economizar |
| `DM_CLASSIFY_MODEL` | (opcional) | Modelo só para classificar |

---

## 7. Serviço central: processPlayerTurn

**Arquivo:** `backend/src/services/narrarService.ts`  
**Função:** `processPlayerTurn(sessionId, userId, playerAction, apiKey, combatState?, useAiHomebrew?, stateHints?, actionId?, narrationTts?)`

### 7.1 Etapas internas (ordem)

1. **Carrega sessão e personagem** (TypeORM); modo teste usa `sessionId === -1` com personagem fictício.
2. **Homebrew:** resumo em cache Redis (`session:{id}:homebrew_summary`, TTL 24h) ou gera de `homebrewContentIds`.
3. **Valida chave OpenRouter** (`hasResolvableOpenRouterKey`).
4. **Modelo:** `ensureOssModel(user.settings.model || AI_DEFAULT_MODEL)`.
5. **Logs recentes:** últimos 20 `SessionLog` → string compacta `compactGameLog` (máx. 12 entradas, 320 chars cada).
6. **`buildNarrationContext`** — memória em camadas (seção 8).
7. **Combate carregado** do banco; reconcilia com `combatState` do cliente se necessário.
8. **Monta `GameMasterFlowInput`** com `suppressRollRequest: true`, `stateHints`, elenco, presença de outros jogadores na região, etc.
9. **`runNarrationAiPhases`** → resposta do LLM (seção 9–11).
10. **`stripMotorOwnedFields`** + **`enforceNarrativeOnlyResponse`** (seção 14).
11. **Persiste `newFacts`** via `persistValidatedFacts` (remove do objeto antes de enviar ao cliente).
12. **Combate:** em `narration_only`, **`runMotorCombatPipeline`** — motor atualiza combate; IA só recebe estado público projetado.
13. **XP, loot, level-up:** motor; não confia na IA.
14. **`persistNarrationTurn`** — transação MySQL (seção 16).
15. **TTS** opcional (`synthesizeNarrationAudio`).
16. **Imagem de cena** opcional.
17. Retorna **`GameMasterResponse`** com `stateVersion`.

### 7.2 Detecção de modo de interação (`detectAiMode`)

Orienta limites de tokens e tom: `gameplay`, `combat`, `generation`, `audit` — conforme ação interna, combate ativo ou prompts de teste.

### 7.3 Ações internas (não logadas como ação do jogador)

Strings que começam com `Recarregar estado atual`, `A aventura começa.` ou contêm texto de demonstração de capacidades do GM — tratadas como internas para logs e política de embedding.

---

## 8. Montagem de contexto (antes do LLM)

**Arquivo:** `backend/src/narration/contextBuilder.ts`  
**Função:** `buildNarrationContext`

### 8.1 Fontes de dados

| Fonte | Serviço | O que entra no prompt |
|-------|---------|------------------------|
| Resumo da história | `storyService.getStorySummary` | `storySummary` |
| Linha do tempo | `storyService.buildTimelineFacts` | `timelineFacts` |
| Região / mapa | `regionContext.resolveRegionContextForPrompt` | `regionSlug`, `regionGraphSummary`, rotas descobertas, regiões visitadas |
| Fatos SQL da sessão | `sessionFactService.queryRelevantFacts` | NPCs, quests ativas — formatados em texto |
| Recall vetorial | `vectorMemoryService.recallSimilarMemories` | Top 5 memórias similares à ação + log (se Qdrant ativo e política permitir) |
| Política de embedding | `embeddingPolicy.shouldEmbedForOperation` | Evita embed caro em sessões “frias” |

O resultado inclui **`enrichedGameLog`**: log compacto + bloco `MEMORIA_CAMADAS=` com tudo acima.

### 8.2 Contexto OSS adicional (`buildOssSceneContext`)

**Arquivo:** `backend/src/ai-oss/context/contextBuilder.ts`

Prioriza chunks com orçamento ~4500 caracteres:

- `storySummary`, `timelineFacts`, `layeredMemorySummary`
- Região atual / grafo
- Combate ativo (rodada, turno)
- `stateHints` do motor
- Resumo homebrew (até 800 chars, prioridade baixa)

Usa `contextPrioritizer.trimContextBudget` para não estourar o prompt.

### 8.3 Ficha narrativa compacta

**Arquivo:** `backend/src/ai-oss/context/narrativeCharacterCard.ts`  
**Função:** `buildNarrativeCharacterCard` (~520 chars)

Inclui: nome, raça, classe, nível, região, HP/CA, condições (até 3), 2 laços/NPCs, até 3 itens equipados. **Não** envia inventário completo nem lista de magias — o motor decide mecânica.

No user prompt OSS vira a linha: `FICHA=...`

### 8.4 Compressão do log

**Arquivo:** `backend/src/ai-oss/memory/compressor.ts`  
**Função:** `compressGameLogForOss` — reduz `gameLog` antes de `LOG_RECENTE=` (últimos ~2000 caracteres no composer).

### 8.5 Elenco e mundo assíncrono

Em `processPlayerTurn`, antes da IA:

- `syncSessionCastFromWorld` — sincroniza elenco da sessão com “heróis do cofre” na mesma região.
- `getCastSummaryForSession` — bloco de texto no prompt DM.
- `getWorldPresenceHints` — ecos/rumores de outros jogadores na região (multiplayer assíncrono leve).

### 8.6 Snapshot narrativo em Redis (P4.5)

**Arquivo:** `backend/src/services/narrativeSnapshotService.ts`

Camadas “pesadas” do contexto (resumo, timeline, região, fatos estáticos formatados) são cacheadas em Redis (`session:{id}:narrative_snapshot`) após `persistNarrationTurn`, com refresh a cada **`NARRATIVE_SNAPSHOT_EVERY_N_TURNS`** turnos (default 3).

`buildNarrationContext` (`narration/contextBuilder.ts`) chama `getNarrativeSnapshot` e `applySnapshotToMemoryLayers` — reduz consultas SQL/Qdrant no worker quando o snapshot ainda é válido. Recall vetorial e fatos dinâmicos continuam sendo buscados quando a política de embedding permitir.

| Env | Padrão | Função |
|-----|--------|--------|
| `NARRATIVE_SNAPSHOT_EVERY_N_TURNS` | 3 | Intervalo de rebuild |
| `NARRATIVE_SNAPSHOT_TTL_SEC` | 3600 | TTL da chave Redis |

---

## 9. Dois motores de narração: OSS e legado

**Orquestrador:** `backend/src/narration/phaseOrchestrator.ts`

```
runNarrationAiPhases (alias runAiPhases)
    └── requestPhaseResponse (até 3 tentativas de validação)
            ├── isOssEngineEnabled() → runOssNarration
            └── senão → getGameUpdate (aiService legado)
    └── mergedResponse (só campos narrativos)
```

Cada tentativa falha de validação adiciona `validationFeedback` ao próximo `GameMasterFlowInput` para o modelo corrigir o JSON.

Métricas: `recordAiPipelineMetric` por fase, latência, sucesso/falha.

Se todas as tentativas falharem: **`generateFallbackResponse`** (texto genérico local, sem API).

---

## 10. Pipeline OSS (detalhado)

**Arquivo:** `backend/src/ai-oss/orchestration/narrationPipeline.ts`  
**Entrada:** `OssNarrationParams { input: GameMasterFlowInput, apiKey, model?, generationConfig?, actionId?, traceId?, stateVersion? }`  
**Saída:** `GameUpdateResult { response: GameMasterResponse, rawText, warnings? }`

### 10.0 JSON minimalista (sempre ativo)

- `isOssMinimalNarrationEnabled()` → `true` (`config/ossMinimalNarration.ts`).
- Schema: `OssMinimalNarrationSchema` — `narration`, `actionOptions` do **registry** (`ai-oss/actions/registry.ts`).
- Com minimal: **`OSS_MAX_API_ATTEMPTS`** efetivo = **1** (menos retries = menos custo).
- Não existe env `OSS_MINIMAL_NARRATION` — comportamento fixo.

### 10.1 Loop de geração

Até **`OSS_MAX_API_ATTEMPTS`** (2 no modo legado; **1** com minimal):

1. **`composePrompt`** (`promptDsl.ts`) — system + user + fase `exploration` | `combat` | `social`.
2. **Cache de system instruction** por `sessionId + regionSlug + stateVersion + combatActive` (`OSS_PROMPT_CACHE`), exceto em repair.
3. Se `validationFeedback` anterior: anexa `CORRECAO: ...` ao user prompt.
4. **`logOssPromptBundle`** — grava prompt completo para debug (telemetria).
5. **Chamada API:**
   - Stream só se `shouldEmitNarrationStream` (`streamPolicy.ts`): `OSS_STREAM_NARRATION=true`, `actionId` e **sem** fila assíncrona no turno (preview com `canonical: false`).
   - Com stream: `streamOpenRouterChat` → WS `narrationStream`.
   - Senão: `createOssModelAdapter` → `generateContent` síncrono.
6. **Parse:** `parseOssJsonResponse` → `repairPass` (normalização de aspas, extração de JSON, etc.).
7. Se parse falhou: **`runOssJsonOnlyRepair`** — mini-chamada só para consertar JSON (`OSS_JSON_ONLY_REPAIR`).
8. **`validateOssPayload`** — Zod OSS + mapeamento + validação legado narrativa.
9. **`detectNarrationLoop`** — se texto repete log recente, injeta `antiLoopHint` e tenta de novo.
10. Sucesso → retorna; falha total → fallback local.

### 10.2 Configuração de geração por domínio

| Config | temperature | maxOutputTokens | Uso |
|--------|-------------|-----------------|-----|
| `OSS_NARRATIVE_CONFIG` | 0.78 | 2048 | Exploração / social |
| `OSS_COMBAT_CONFIG` | 0.55 | 1536 | Combate |

Arquivos: `ai-oss/configs/narrative.ts`, `ai-oss/configs/combat.ts` — validados por `GenerationConfigSchema`.

### 10.3 Modelo e provedor

- Modelo padrão: **`openai/gpt-oss-120b:free`** (`OSS_120B_MODEL`).
- Cliente: `OpenRouterManager` — rotação de chaves, cooldown 60s após 429, circuit breaker após 3 falhas.
- Request: `responseMimeType: application/json`, system + user messages.

### 10.4 Pós-validação OSS específica

- **Combate:** `OssCombatNarrationSchema` (narração ≤ 900 chars, ≥ 2 actionOptions) → `applyCombatDeterminism` → normaliza opções pelo registry de combate.
- **Exploração:** `normalizeActionOptionsFromRegistry` com domínio `exploration` ou `social`.
- **Mapeamento:** `mapOssNarrationToGameMasterShape` → `logEntries`, `actionOptions`, `systemLog`, `newFacts` (formato SQL).

---

## 11. Pipeline legado Gemini/OpenRouter (detalhado)

**Arquivo:** `backend/src/services/aiService.ts` (marcado deprecated)  
**Fachada:** `backend/src/ai/gameUpdate.ts` → `getGameUpdate`

### 11.1 Montagem de prompt legado

| Peça | Arquivo |
|------|---------|
| System instruction | `ai/instructions.ts` + `ai/narrativeContract.ts` |
| User prompt | `ai/promptAssembler.ts` → `createPrompt()` |
| Seções compactas | `ai/promptSections.ts` |
| Regras embutidas | `game/prompts/regrasBase.ts`, `regrasCombate.ts`, `regrasInventario.ts` |
| Grafo de memória | `game/memoryGraph.ts` |

O prompt legado é **muito maior**: inventário (12 itens), proficiências, relações, combate condensado, schema hash, exemplo JSON, orçamento `PROMPT_BUDGET` (soft cap ~9500 tokens).

### 11.2 Structured output Gemini

Se modelo `gemini-2.5*` e flag global: envia `NARRATIVE_PHASE_GENERATIVE_SCHEMA` / `GAME_MASTER_RESPONSE_GENERATIVE_SCHEMA` (`schemas/gameMasterResponseGenerativeSchema.ts`) — schema JSON raso para o Gemini; validação completa continua em Zod após resposta.

### 11.3 Failover de modelos

Cadeia padrão (`ai/constants.ts` + `providerFactory.ts`):

1. `meta-llama/llama-3.3-70b-instruct:free`
2. `qwen/qwen3-next-80b-a3b-instruct:free`
3. `openai/gpt-oss-120b:free`
4. `nousresearch/hermes-3-llama-3.1-405b:free`
5. `gemini-2.5-flash`
6. `gemini-2.5-flash-lite`

Override via `AI_FAILOVER_CHAIN` (lista separada por vírgula). `AI_DISABLE_AUTO_FAILOVER` desliga rotação automática.

### 11.4 Reparo legado

`aiRepairUtils`, `semanticRecoveryService`, `sessionRecoveryCache`, até 3 tentativas com hints `RETRY_PROMPT_HINTS`, sanitização `aiSanitizer`, validação `gmValidator`, integridade `schemaIntegrityService`.

**Recomendação operacional:** usar `AI_ENGINE=oss` e não estender o legado.

---

## 12. Schemas: referência completa

Todos os schemas abaixo usam **Zod** salvo o classificador LLM (JSON informal).

### 12.1 Entrada WebSocket — `ProcessActionSchema`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `contractVersion` | number | não | Deve ser `1` se presente |
| `sessionId` | number | sim | ID da sessão |
| `prompt` | string | condicional | Texto da ação; obrigatório se não há intent e precisa de IA |
| `intent` | `{ type, payload }` | não | Intent estruturado do motor |
| `combatState` | CombatState | não | Snapshot do cliente |
| `apiKey` | string | não | Chave do jogador (se servidor não tiver pool) |
| `useAiHomebrew` | boolean | não | Permissão narrativa para mencionar homebrew |
| `model` | string | não | Override de modelo |
| `clientStateVersion` | number | não | Reconciliação de estado |
| `actionId` | string | não | Correlação / streaming / telemetria |
| `clientInstanceId` | string | não | 8–64 chars |
| `actionCursor` | number | não | Ordenação de ações |
| `narrationVoice` | faber \| razo \| miro \| dii | não | TTS |
| `narrationSpeed` | rapido \| normal \| lento \| pausado | não | TTS |

### 12.2 Entrada do fluxo narrativo — `GameMasterFlowInput`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `character` | any | Snapshot read-only do PJ para o prompt |
| `playerAction` | string | Ação ou prompt DM composto |
| `gameLog` | string | Histórico recente (enriquecido) |
| `combatState` | CombatState? | Resumo público do combate |
| `homebrewSummary` | string? | Texto de conteúdo homebrew instalado |
| `validationFeedback` | string? | Erros da tentativa anterior (retry) |
| `sessionId` | string? | ID estável para métricas |
| `useAiHomebrew` | boolean? | |
| `enableNarrativeRevalidation` | boolean? | Instrui revisão de continuidade |
| `timelineFacts` | string? | |
| `regionSlug` | string? | |
| `regionGraphSummary` | string? | |
| `scenarioLabel` | string? | Testes automatizados |
| `mode` | gameplay \| combat \| generation \| audit | |
| `responseFocus` | full \| narrative \| state | Sempre `narrative` na prática |
| `suppressRollRequest` | boolean? | **true** no gameplay — IA não pode pedir dado |
| `exampleSnippet` | string? | Few-shot de cenários |
| `stateHints` | string[]? | Deltas do motor, rolagem, elenco |
| `layeredMemorySummary` | string? | |
| `storySummary` | string? | |

### 12.3 Saída OSS compacta — `OssNarrationResponseSchema`

| Campo | Tipo | Regras |
|-------|------|--------|
| `narration` | string? | Prosa única; alternativa a logEntries |
| `logEntries` | array? | Tipos: narration, action, system, combat, insight, roll; min 1 se sem narration |
| `actionOptions` | array | **Obrigatório**, 1–8 itens: string OU `{ text, action, skill? }` |
| `systemLog` | string? | Nota de mesa |
| `state_changes` | string[]? | Até 12 strings narrativas (não aplicadas mecanicamente pelo OSS) |
| `newFacts` | array? | Até 6: `{ fact: 4–280 chars, importance?: low\|medium\|high }` |

Refine: deve existir `narration` não vazia **ou** `logEntries` com pelo menos uma entrada.

### 12.4 Saída OSS combate — `OssCombatNarrationSchema`

Estende `OssNarrationResponseSchema` com:

- Texto total ≤ **900 caracteres**
- Mínimo **2** `actionOptions` táticas

### 12.5 Memória OSS — `OssMemoryFactSchema` / `OssMemoryPatchSchema`

- `fact`: string 4–280
- `importance`: low | medium | high (inglês no JSON)
- Patch opcional: `memoryContext` até 600 chars

### 12.6 Efeitos narrativos — `OssEffectsSchema`

- `state_changes`: até 8 strings 3–120 chars
- `systemLog`: até 400 chars  
Usado como sugestão; motor não aplica automaticamente.

### 12.7 Saída validada para o jogo — `NarrativePhaseResponseSchema`

Subconjunto **estrito** aceito após IA em `narration_only`:

| Campo | Tipo |
|-------|------|
| `logEntries` | array min 1 |
| `actionOptions` | array |
| `systemLog` | string? |
| `memoryContext` | objeto opcional |
| `newFacts` | array opcional (convertido para SQL) |

### 12.8 Saída completa legada — `GameMasterResponseSchema`

Inclui todos os campos mecânicos (`updatedCharacter`, `combatState`, `playerRollRequest`, `xpEvents`, `lootOffer`, `shopState`, `levelUpState`, etc.). Em `narration_only`, esses campos vindos da IA são **removidos** antes de persistir.

### 12.9 Fatos persistidos — `NewFactSchema`

| Campo | Tipo |
|-------|------|
| `category` | string (ex.: general) |
| `fact` | string até 500 |
| `subject` | string opcional (importante, relevante) |

Mapeamento desde OSS: `importance: high` → subject `importante`, etc.

### 12.10 Configuração de geração — `GenerationConfigSchema`

| Campo | Faixa |
|-------|-------|
| `temperature` | 0–1 |
| `topP` | 0–1 |
| `topK` | ≥ 1 |
| `maxOutputTokens` | 256–4096 |

### 12.11 Classificador LLM (não-Zod)

JSON esperado:

```json
{
  "needsRoll": true,
  "intentType": "skill-check",
  "skillIndex": "deception",
  "difficulty": "medium",
  "reason": "..."
}
```

Índices SRD em inglês: stealth, perception, athletics, acrobatics, deception, persuasion, intimidation, insight, investigation, arcana, history, religion, nature, medicine, animal-handling, survival, performance, sleight-of-hand.

---

## 13. Prompts: referência completa

### 13.1 System OSS — exploração/social

Arquivo: `ai-oss/prompts/system/format.ts`

Conteúdo efetivo (paráfrase estruturada):

- Papel: Mestre D&D 5e, português Brasil.
- Resposta: **somente JSON UTF-8**, aspas duplas, sem markdown.
- Chaves permitidas na referência: `narration`, `logEntries`, `actionOptions` (2–5 na ref; schema Zod aceita até 8), `newFacts`, `systemLog`, `state_changes`.
- `newFacts`: 0–6 fatos narrativos; sem HP, inventário, XP, números de combate.
- Proibido: inventar HP, dano, rolagens, loot.
- Bloco **`OSS_NARRATIVE_QUALITY_BLOCK`** (`narrativeQuality.ts`):
  - 3–6 frases exploração/social, 2–4 em combate
  - Sentidos, emoção, gancho
  - Evitar listas secas e “sem eventos recentes”
  - 4 actionOptions, textos 8–18 palavras
  - `narration` sempre string; `importance` em inglês
  - Preferir um único `logEntries` type=narration

### 13.2 System OSS — combate

Arquivo: `ai-oss/prompts/system/combat.ts`

- Narração curta 1–3 frases
- Não rolar dados, não informar dano final nem HP
- actionOptions táticas (atacar, esquivar, recuar, item, etc.)
- Proibido: novos inimigos, loot ou fim de combate sem ordem do sistema

### 13.3 Fase dinâmica (append ao system)

Arquivo: `ai-oss/prompts/phaseTemplates.ts`

| Fase | Detecção | Hint |
|------|----------|------|
| `combat` | `combatState.isActive` | Ritmo rápido, sem resolver dados |
| `social` | regex em ação (falar, persuadir, intimidar, …) | Diálogo, subtexto |
| `exploration` | default | Cena vívida, 4 opções específicas ao local |

### 13.4 User prompt OSS (linhas)

Arquivo: `ai-oss/prompts/promptComposer.ts` + `promptDsl.ts`

| Linha | Origem |
|-------|--------|
| `FICHA=` | `buildNarrativeCharacterCard` |
| `MODO=combate` | se combate |
| hint `COMBATE rX tY \| participantes: ...` | `buildCombatSceneHint` |
| `CENA=` | `buildOssSceneContext` (até 600 chars na linha) |
| `LOG_RECENTE=` | log comprimido (até 2000 chars) |
| `ACAO_JOGADOR=` | texto do jogador ou prompt DM |
| `ANTI_LOOP=` | hint se detecção de repetição |
| `ABERTURA_DE_SESSÃO:` | se ação de início de aventura |

Em repair: `\n\nCORRECAO: {validationFeedback}\nReescreva só o JSON.`

### 13.5 System legado

Arquivo: `ai/instructions.ts` + `ai/narrativeContract.ts`

- Contrato explícito: JSON **apenas** com chaves narrativas
- Lista de chaves **proibidas** (updatedCharacter, combatState, playerRollRequest, …)
- Exemplo JSON mínimo embutido (`NARRATIVE_JSON_EXAMPLE`)
- Homebrew: só mencionar o já instalado; sem `newHomebrewContent`
- Revalidação opcional de continuidade com gameLog

### 13.6 User legado

`createPrompt` concatena: contrato, personagem, combate, inventário resumido, memória, região, homebrew, gameLog, playerAction, feedback de validação, hints de cenário.

### 13.7 Prompt classificador

Arquivo: `services/dm/freeActionLlmClassifier.ts`

System fixo (Mestre que classifica para motor): regras de `needsRoll`, mapeamento de perícia por intenção, lista de índices SRD. User: `Ação do jogador:\n{texto}` (até 800 chars). temperature 0.2, max 256 tokens, JSON.

### 13.8 Prompt DM (wrapper)

Arquivo: `services/dm/dmPromptBuilder.ts` — ver seção 6.3.

---

## 14. Pós-processamento e contrato narrativo

### 14.1 `stripMotorOwnedFields`

Arquivo: `narration/motorStateBridge.ts`

Remove da resposta da IA: `updatedCharacter`, `worldState`, `combatState`, `playerRollRequest`, `xpEvents`, `progressionFeed`, `newHomebrewContent`, `levelUpState`, `shopState`, `lootOffer`, `useHitDiceRequest`, `gameClock`.

Mantém: `logEntries`, `actionOptions`, `systemLog`, `memoryContext`.

### 14.2 `enforceNarrativeOnlyResponse`

Arquivo: `ai/narrativeContract.ts`

- Whitelist: `logEntries`, `actionOptions`, `systemLog`, `memoryContext`, `newFacts`
- Qualquer outra chave → lista em `stripped` e log em `systemLog`
- `sanitizeActionOptionsForPlayerAgency` — remove opções que pedem ao jogador burlar regras

### 14.3 Roll guard

Mesmo que o modelo devolva `playerRollRequest`, com `suppressRollRequest: true` o backend descarta e contabiliza em `rollMetricsService` (`recordUnexpectedAiRoll`).

### 14.4 Validação em camadas (OSS)

1. `normalizeOssNarrationPayload` / `localFieldRepair`
2. `OssNarrationResponseSchema` ou combate
3. Registry de ações
4. `validateByPhaseFocus(..., 'narrative')` → `NarrativePhaseResponseSchema`
5. Contrato narrativo final

### 14.5 Fallback

`gameOrchestrator.generateFallbackResponse` — narração genérica + opções padrão quando JSON inválido após todas as tentativas e repairs.

---

## 15. Combate, rolagens e o que a IA não faz

### 15.1 Rolagens

| Etapa | Quem decide |
|-------|-------------|
| Precisa de teste? | Motor (`validateActionIntent`) ou classificador DM |
| CD, modificador, tipo de dado | Motor |
| `playerRollRequest` emitido | `issuePendingRollToPlayer` / WS — **nunca** a IA |
| Valores dos dados | Jogador no `DiceRollModal` (3D) → `submitRollResult` |
| Aplicação de dano/cura/efeitos | `resolveStructuredRoll`, `motorPostRollService` |
| Narração do desfecho | IA no **worker** BullMQ, com hints `[Motor]` e resultado da rolagem no prompt |

### 15.2 Combate

- Estado canônico: `combatStateService`, `combatMotorService.runMotorCombatPipeline`
- IA recebe `projectPublicCombatState` — visão resumida para narrar
- Loot pós-combate, XP, fim de encontro: motor
- `aiResponse.combatState` enviado ao cliente é o **público** após motor, não o JSON bruto do LLM

### 15.3 Intents estruturados (exemplos)

Tipos em `actionIntentService`: `weapon-attack`, `skill-check`, `spell-attack`, `rest`, `damage`, `healing`, `consume-item`, `travel`, `equip-item`, `drop-item`, `claim-loot`, etc.

Fluxo: intent → motor → rolagem ou aceite → eventualmente IA só para narrar.

---

## 16. Persistência após a IA

**Arquivo:** `narration/persistence.ts` — `persistNarrationTurn`

### 16.0 Idempotência (P4.2)

Antes de gravar logs/fatos/XP na transação, o worker chama **`tryClaimNarrationPersistenceTx`** (`narrationIdempotencyService.ts`) na tabela **`narration_completions`** (unique `sessionId` + `actionId`).

- Primeira execução: claim OK → persiste normalmente.
- Retry BullMQ com mesmo `actionId`: claim falha → **não** duplica `SessionLog` nem fatos; o worker pode reemitir WS (cliente filtra por `actionSequence`).
- `isNarrationPersistenceCompleted` evita rodar o LLM de novo se a persistência já terminou.

### 16.1 Transação MySQL

Transação MySQL:

| Log type | Conteúdo |
|----------|----------|
| `gm_raw` | Texto bruto do modelo (até 4000 chars) |
| `gm_validation` | attempts, issues, fallback |
| `gm_discarded` | respostas descartadas com hints |
| `action` | ação do jogador (se não interna) |
| `state` | snapshot da resposta GM sem logEntries |
| `summary` | novo resumo de história se houver |
| entradas de `logEntries` | narration, system, combat, etc. |

Também:

- Merge seguro de personagem (`safeMerge`) — só campos que o pipeline ainda permite fora de narration_only
- `saveCombatEncounterState` se motor alterou combate
- `storeMemory` → Qdrant se política e embedding ativos
- `indexNewJournalEntries` — journal → memória
- `incrementStateVersion`
- `enforceWorldStateLocation` — valida região/POI se IA sugerir mudança (em modos que ainda passam worldState; em narration_only a IA não envia)
- Invalidação de cache Redis de homebrew se necessário
- Geração de imagem de cena assíncrona opcional
- **`refreshNarrativeSnapshotIfDue`** — atualiza snapshot Redis (P4.5) quando o contador de turnos atinge o intervalo

---

## 17. Memória: SQL, fatos e Qdrant

### 17.1 Fatos de sessão (SQL)

- IA envia `newFacts` → `persistValidatedFacts` → tabela de fatos da sessão
- Rejeição se fato inválido, curto ou duplicado
- `queryRelevantFacts` na próxima vez em `buildNarrationContext`
- **Tier + TTL (P2.3):** `SessionFact.tier` (`ephemeral` | `scene` | `persistent`) + `sessionFactTtl.ts` / env `SESSION_FACT_TTL_*`

### 17.2 Vetorial (Qdrant)

- Modelo embedding: `nvidia/llama-nemotron-embed-vl-1b-v2:free` (2048 dimensões)
- Chave: `OPENROUTER_KEY_EMBEDDING` ou pool principal
- Coleção: `session_memories` com filtro `sessionId`
- Recall: similaridade com `playerAction + compactGameLog`
- Política: `embeddingPolicy` — não faz busca semântica em sessões com poucos fatos ou versão de estado baixa (economia)

### 17.3 Resumo rolling

`storyService` mantém resumo textual da sessão atualizado após turnos relevantes — entra em `storySummary` no prompt.

---

## 18. Serviços auxiliares de IA

### 18.1 Classificador de ação livre (LLM)

- **Quando:** heurística não detectou `skill-check` e `DM_LLM_CLASSIFY=true`
- **Custo:** chamada extra pequena (256 tokens)
- **Saída:** `ActionIntent` tipo `skill-check` ou null
- **Economia:** `DM_LLM_CLASSIFY=false` desliga a chamada extra; heurística permanece sempre ativa

### 18.2 Criação de homebrew

- **Arquivo:** `services/aiCreationService.ts`
- Converte prompt do usuário em JSON no formato da API D&D 5e
- Usa adapter Gemini/OpenRouter, não o pipeline OSS de turno

### 18.3 Embeddings

- **Arquivo:** `services/vectorMemoryService.ts`
- Provider OpenRouter via `ai-oss/providers/openRouterEmbeddings.ts`
- Indexação após turnos conforme `shouldEmbedForOperation`

### 18.4 Geração de imagem

- **Arquivo:** `services/imageGenerationService.ts`
- Opcional após persistência; não faz parte do JSON do Mestre

---

## 19. TTS, imagem e streaming

### 19.1 TTS (não é LLM)

- **Serviço:** `ttsService.ts` — Piper em Docker
- Vozes: faber, razo, miro, dii — velocidades: rapido, normal, lento, pausado
- Payload WS: `narrationVoice`, `narrationSpeed`
- Gera áudio da narração e pode anexar `audioUrl` em log entries

### 19.2 Streaming de narração (P4.6)

- **`streamPolicy.ts`:** `NARRATION_STREAM_CANONICAL = false` — o texto final vem sempre de `gameStateUpdate` após parse/validação.
- `shouldEmitNarrationStream`: desligado quando há job BullMQ para o turno (narração assíncrona).
- Com stream ativo: `registerNarrationStreamSink(actionId)` no WebSocket; eventos `narrationStream` com `kind: preview | structured | done` e `canonical: false`.
- Frontend deve ignorar preview como fonte de log — só animação de loading.
- Extração parcial: `extractStreamingNarrationPreview` enquanto JSON chega no handler síncrono.

### 19.3 TTS no contrato WS

Voz e velocidade via `narrationVoice` / `narrationSpeed` no `ProcessActionSchema`; tipos compartilhados em `backend/src/config/narrationTts.ts` e `src/lib/narrationTts.ts`. Repassados ao worker e a `synthesizeNarrationAudio` após persistência.

---

## 20. Telemetria e depuração

| Mecanismo | Descrição |
|-----------|-----------|
| **Event log (P0.1)** | `recordGameEvent` — `IntentReceived`, `RollResolved`, `DeltaApplied`, `NarrationRequested`, `NarrationCompleted` |
| **Pipeline trace (P4.4)** | `telemetry/pipelineTrace.ts` — logs `[PipelineTrace]` JSON (`narration:dispatch`, stale abort, etc.) |
| **Admin replay** | `GET /api/admin/sessions/:sessionId/actions/:actionId/events` |
| `[ActionFlow]` logs | Estágios do WS: received, phase, queued, finalized |
| `actionObservabilityService` | traceId, intentHash, duração por fase |
| `telemetry/pipelineLatency.ts` | Latência mecânico vs narração; `json_repair_rate` |
| `ossPromptLog` | Bundle system+user por actionId |
| `logs/phase-debug/` | Snapshots JSON narrative/state em falhas |
| `ai/metrics.ts` | Métricas de pipeline por sessão |
| `GET /api/admin/ai-metrics` | OpenRouter + objeto `pipeline` (snapshot latências) |
| `OSS_TRACE_LOG=true` | Log verbose por traceId no pipeline OSS |

Scripts npm: `session:smoke` (pipeline local), `chaos:smoke` (invariantes P4), `ai:oss-smoke`, `ai:oss-benchmark`, `ai:oss-metrics`.

---

## 21. Variáveis de ambiente

### 21.1 Motor e pipeline

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `AI_ENGINE` | legacy no código; oss no Docker | `oss` ou `legacy` |
| `AI_PIPELINE_MODE` | narration_only | Ignora outros valores |
| `AI_DEFAULT_MODEL` | — | Modelo default se usuário não tiver |
| `AI_PROVIDER` | openrouter | Força gemini ou openrouter |
| `AI_OPENROUTER_ONLY` | — | Cadeia só OpenRouter |
| `AI_FAILOVER_CHAIN` | — | Lista custom de modelos |
| `AI_DISABLE_AUTO_FAILOVER` | false | Desliga failover |

### 21.2 OpenRouter

| Variável | Descrição |
|----------|-----------|
| `OPENROUTER_KEY1` … `N` | Pool de chaves |
| `OPENROUTER_KEYS` | Lista separada por vírgula |
| `OPENROUTER_PREFER_SERVER_KEYS` | true — prioriza servidor |
| `OPENROUTER_KEY_EMBEDDING` | Chave só para embeddings |
| `OPENROUTER_EMBEDDING_MODEL` | Override do modelo de embed |

### 21.3 OSS

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `OSS_MAX_API_ATTEMPTS` | 2 (1 efetivo com minimal) | Tentativas por turno |
| `OSS_STREAM_NARRATION` | false | Preview WS (`narrationStream`) |
| `OSS_PROMPT_CACHE` | true | Cache de system |
| `OSS_JSON_ONLY_REPAIR` | — | Mini-call repair |
| `OSS_TRACE_LOG` | false | Debug verbose |

**Sem env (sempre no código):** `OSS_MINIMAL_NARRATION`, `MECHANICAL_NARRATIVE_SPLIT` — não reintroduzir.

### 21.4 DM e narração

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DM_AUTO_ROLL` | false | Rolagem no servidor |
| `DM_LLM_CLASSIFY` | true | Classificador LLM; `false` desliga |
| `DM_CLASSIFY_MODEL` | opcional | Modelo do classificador |
| `NARRATION_BULL_CONCURRENCY` | 2 | Workers BullMQ no `server.ts` |
| `NARRATIVE_LEVEL` | standard | Tamanho da prosa (`narrativeLevel.ts`) |
| `REDIS_URL` | — | Obrigatório para fila; `mock` = síncrono em testes |
| `NARRATIVE_SNAPSHOT_EVERY_N_TURNS` | 3 | Refresh do snapshot Redis (P4.5) |
| `NARRATIVE_SNAPSHOT_TTL_SEC` | 3600 | TTL do snapshot |
| `PIPELINE_TRACE` | false | Logs `[PipelineTrace]` verbosos (P4.4) |

### 21.5 Memória e infra

| Variável | Descrição |
|----------|-----------|
| `QDRANT_ENABLED` | Ativa vetorial |
| `QDRANT_VECTOR_SIZE` | 2048 |
| `AI_EMBEDDING_PROVIDER` | openrouter |
| `REDIS_URL` | Cache homebrew / métricas |
| `GEMINI_API_KEY` | Legado |
| `ACTION_TIMEOUT_MS` | 120000 — timeout WS |
| `ACTION_FLOW_DEBUG` | logs ActionFlow |

### 21.6 Frontend (contrato)

| Variável | Descrição |
|----------|-----------|
| `NEXT_PUBLIC_WS_URL` | URL do WebSocket |
| `NEXT_PUBLIC_ACTION_TIMEOUT_MS` | Timeout cliente |
| `NEXT_PUBLIC_UI_V2` | GameplayScreen moderno |

---

## 22. Índice de arquivos no repositório

### 22.1 Orquestração e turno

| Arquivo | Função |
|---------|--------|
| `backend/src/services/narrarService.ts` | Turno completo |
| `backend/src/narration/phaseOrchestrator.ts` | Fases IA |
| `backend/src/narration/turnProcessor.ts` | Wrapper runNarrationAiPhases |
| `backend/src/narration/contextBuilder.ts` | Contexto em camadas |
| `backend/src/narration/persistence.ts` | Persistência |
| `backend/src/narration/motorStateBridge.ts` | Strip campos motor |
| `backend/src/websocket/webSocketServer.ts` | WS fino (roteamento) |
| `backend/src/action-pipeline/*` | Handlers `processAction` / `submitRollResult` |
| `backend/src/queue/narrationDispatch.ts` | Enfileirar + `actionSequence` + cancelamento |
| `backend/src/queue/narrationQueueCancel.ts` | Remove jobs obsoletos; WS `narrationCancelled` |
| `backend/src/queue/narrationJobProcessor.ts` | Worker: stale check, idempotência, `processPlayerTurn` |
| `backend/src/queue/narrationWorker.ts` | `startNarrationWorkers()` |
| `backend/src/services/actionSequenceService.ts` | `allocateActionSequence`, `getLatestActionSequence` |
| `backend/src/services/narrationIdempotencyService.ts` | Claim em `narration_completions` |
| `backend/src/services/narrativeSnapshotService.ts` | Snapshot Redis do contexto |
| `backend/src/services/restNarrationEnqueue.ts` | REST → mesma fila (P4.8) |
| `backend/src/telemetry/pipelineTrace.ts` | Trace E2E (P4.4) |
| `backend/src/events/recordGameEvent.ts` | Event log |
| `backend/src/entities/NarrationCompletion.ts` | Idempotência persistência |

### 22.2 DM

| Arquivo | Função |
|---------|--------|
| `backend/src/services/dm/dmTurnOrchestrator.ts` | Fluxo DM |
| `backend/src/services/dm/dmPromptBuilder.ts` | Prompts de fase DM |
| `backend/src/services/dm/freeActionClassifier.ts` | Heurística PT |
| `backend/src/services/dm/freeActionLlmClassifier.ts` | Classificador LLM |
| `backend/src/services/dm/skillActionSemantics.ts` | Correção de perícia |
| `backend/src/services/dm/autoRollService.ts` | Rolagem servidor |

### 22.3 OSS (ai-oss)

| Pasta/arquivo | Função |
|---------------|--------|
| `orchestration/narrationPipeline.ts` | Pipeline principal |
| `orchestration/narrationStream.ts` | Sink streaming |
| `prompts/promptDsl.ts` | DSL composePrompt |
| `prompts/promptComposer.ts` | Linhas user |
| `prompts/phaseTemplates.ts` | Fases exploration/combat/social |
| `prompts/system/format.ts` | System exploração |
| `prompts/system/combat.ts` | System combate |
| `prompts/narrativeQuality.ts` | Bloco qualidade |
| `schemas/narration.schema.ts` | Zod OSS completo |
| `schemas/minimalNarration.schema.ts` | Zod minimal (P0.3) |
| `config/ossMinimalNarration.ts` | Sempre `true` |
| `config/narrativeLevel.ts` | Nível narrativo (P2.2) |
| `schemas/combat.schema.ts` | Zod combate |
| `schemas/memory.schema.ts` | Fatos OSS |
| `schemas/effects.schema.ts` | Efeitos narrativos |
| `validators/narrationValidator.ts` | Validação Zod |
| `parser/jsonRecovery.ts` | Entrada parse |
| `parser/repairPass.ts` | Reparo JSON |
| `parser/localFieldRepair.ts` | Normalização campos |
| `parser/jsonOnlyRepair.ts` | Mini-call repair |
| `parser/narrationStreamExtract.ts` | Preview stream |
| `narrative/antiLoop.ts` | Anti-repetição |
| `combat/deterministicCombat.ts` | Combate + registry |
| `actions/registry.ts` | IDs de actionOptions |
| `context/contextBuilder.ts` | Cena OSS |
| `context/narrativeCharacterCard.ts` | Ficha compacta |
| `context/contextPrioritizer.ts` | Budget de contexto |
| `memory/compressor.ts` | Comprime log |
| `configs/narrative.ts` / `combat.ts` | Temperature/tokens |
| `providers/openRouterClient.ts` | Adapter |
| `providers/openRouterStream.ts` | Stream |
| `providers/OpenRouterManager.ts` | Pool de chaves |
| `core/engineSwitch.ts` | AI_ENGINE |
| `core/apiKeyResolve.ts` | Resolução de chave |
| `core/streamPolicy.ts` | Stream não canônico + gate com fila |
| `core/streamSwitch.ts` | OSS_STREAM |
| `telemetry/ossPromptLog.ts` | Log de prompts |
| `constants.ts` | Modelos |

### 22.4 Legado (ai + aiService)

| Arquivo | Função |
|---------|--------|
| `backend/src/services/aiService.ts` | getGameUpdate monolítico |
| `backend/src/ai/gameUpdate.ts` | Fachada |
| `backend/src/ai/promptAssembler.ts` | Mega-prompt |
| `backend/src/ai/promptSections.ts` | Seções |
| `backend/src/ai/instructions.ts` | System legado |
| `backend/src/ai/narrativeContract.ts` | Contrato saída |
| `backend/src/ai/responseValidator.ts` | Validação por fase |
| `backend/src/ai/providerFactory.ts` | Gemini vs OpenRouter |
| `backend/src/schemas/gameSchemas.ts` | Schemas principais |
| `backend/src/schemas/processActionSchema.ts` | WS entrada |
| `backend/src/schemas/validationSchemas.ts` | GenerationConfig, Settings |
| `backend/src/schemas/memorySchemas.ts` | NewFact |
| `backend/src/schemas/gameMasterResponseGenerativeSchema.ts` | Gemini structured |

### 22.5 Frontend (consumo da IA)

| Arquivo | Função |
|---------|--------|
| `src/hooks/newUseGameState.ts` | Orquestrador estado |
| `src/hooks/game/useGameActions.ts` | processAction |
| `src/hooks/game/useGameWebSocket.ts` | Handlers WS + mechanical/queued/cancelled + `actionSequence` |
| `src/hooks/game/slices/useGameActionPipelineRefs.ts` | `latestActionSequenceRef` (P4.1) |
| `src/hooks/game/turnPipelineStore.ts` | Fase do turno na UI |
| `src/hooks/game/useTurnPipeline.ts` | Hook da fase |
| `src/hooks/game/slices/*` | Slices de estado (F.2) |
| `src/lib/narrationTts.ts` | Voz/velocidade Piper no payload WS |
| `src/services/webSocketService.ts` | Conexão WS |
| `src/features/gameplay/GameplayScreen.tsx` | UI jogo |
| `src/components/DiceRollModal.tsx` | Dados 3D |

---

## 23. Diagramas de referência

### 23.1 Mapa mestre

```
JOGADOR ──► WebSocket (action-pipeline)
                │
                ├─ MOTOR / DM (síncrono) ──► mechanicalStateUpdate { actionSequence }
                │
                └─ dispatchNarrationToQueue
                       ├─ allocateActionSequence (+1)
                       ├─ cancelStaleNarrationJobs → narrationCancelled
                       └─ narrationQueued { actionSequence }
                            │
                            ▼
                    BullMQ worker (stale? abort)
                            │
                    processPlayerTurn
                            │
              buildNarrationContext (+ snapshot Redis)
                            │
              runNarrationAiPhases (OSS/legacy)
                            │
              tryClaimNarrationPersistence → persistNarrationTurn
                            │
              gameStateUpdate + narrationComplete { actionSequence } ──► Cliente
```

### 23.2 Pipeline OSS interno

```
composePrompt
    → OpenRouter (JSON)
    → parseOssJsonResponse
    → [jsonOnlyRepair?]
    → validateOssNarration
    → [antiLoop? retry]
    → mapOssNarrationToGameMasterShape
    → validateByPhaseFocus (narrative)
    → GameMasterResponse
```

### 23.3 O que a IA pode devolver (narration_only)

```
PERMITIDO                          PROIBIDO (descartado)
─────────                          ───────────────────
logEntries                         updatedCharacter
actionOptions                      combatState
systemLog                          playerRollRequest
memoryContext                      xpEvents, loot, shop
newFacts → SQL                     levelUpState, homebrew
```

---

## Glossário rápido

| Termo | Significado |
|-------|-------------|
| **OSS** | Pipeline OpenRouter com modelo gpt-oss-120b (pasta `ai-oss`) |
| **DM** | Camada de orquestração pré-IA (rolagem vs narração) |
| **Motor** | Regras D&D 5e autoritativas em `rules/` e serviços associados |
| **Intent** | Ação estruturada tipada (ataque, perícia, equipar, …) |
| **narration_only** | IA só narra; estado mecânico no servidor |
| **stateVersion** | Contador para sincronizar cliente e servidor (mecânico) |
| **actionSequence** | Contador **servidor** por sessão; ordena entrega de narração (P4.1) |
| **actionCursor** | Cursor **cliente** anti-replay de submit |
| **playerRollRequest** | Pedido de rolagem ao jogador (dados 3D) |
| **narration_queued** | Estado REST/WS: narração na fila; log final via WS |
| **GameMasterFlowInput** | Pacote de entrada para o LLM |
| **GameMasterResponse** | Pacote de saída para o cliente (após filtros) |

---

## 24. Sistema distribuído da narração (P4)

Detalhe expandido: **`ARQUITETURA_P4_DISTRIBUIDO.md`**.

| ID | Invariante | Onde |
|----|-----------|------|
| P4.1 | Narração obsoleta não entrega | `sessoes_ia.actionSequence`, worker abort, `latestActionSequenceRef` no cliente |
| P4.2 | Retry não duplica persistência | `narration_completions` + claim em `persistNarrationTurn` |
| P4.3 | Jobs obsoletos removidos | `narrationQueueCancel.ts`, WS `narrationCancelled` |
| P4.4 | Trace E2E | `pipelineTrace.ts` + event log |
| P4.5 | Snapshot narrativo | `narrativeSnapshotService.ts` (Redis) |
| P4.6 | Stream não canônico | `streamPolicy.ts` |
| P4.7 | Smoke de invariantes | `npm run chaos:smoke --prefix backend` |
| P4.8 | REST na fila | `restNarrationEnqueue.ts` + `actionService` |

**Roadmap ativo (P5):** `TODO-ARQUITETURA.md` · `ARQUITETURA_P5_RESILIENCIA.md`.

**Fora do escopo imediato:** Session Actor, homebrew capability graph, chaos com crash real de Redis/worker (pós-P5.1).

---

*Fim do documento. Para alterar comportamento da IA no gameplay:*

1. `AI_ENGINE`, `NARRATIVE_LEVEL`, `DM_LLM_CLASSIFY`
2. `queue/narrationJobProcessor.ts` (quando a narração roda)
3. `narrationPipeline.ts` + `ai-oss/schemas/` (formato JSON)
4. `dmTurnOrchestrator.ts` (classificação e prompt DM antes da fila)
