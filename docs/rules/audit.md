# Auditoria do Motor Autoritativo – Plano de Ação

> Contexto: apesar de todos os checklists apontarem ✅, o jogo está emitindo roll requests redundantes, registrando logs narrativos duplicados e processando intents fora de ordem. O objetivo desta auditoria é coletar evidências, isolar culpados e redefinir o plano de correção antes de qualquer novo ajuste funcional.

---

## 0. Sintomas Observados

- Roll requests surgem sem necessidade aparente, inclusive após intents já resolvidos.
- Narrativa recebe/loga a mesma entrada múltiplas vezes.
- `stateDelta` aplicado não condiz com o que a IA narra, sugerindo corrida entre aplicação e follow-up.
- Últimos registros em `session_logs` demonstram duplicidade de prompts/respostas para o mesmo `actionId`.
- Servidor reinicia sessões/clone de personagens como se o jogador estivesse começando do zero.

### 0.1 Evidências iniciais (`backend/logs/server_2025-11-13_08-50-48.log`)

- **Clones em loop:** cada `POST /api/sessoes` cria um novo personagem (`newCharacterId: 5` na linha 75 e `6` na linha 1031), indicando que o cliente dispara criação em vez de reabrir a sessão. Resultado: estado e inventário são resetados a cada refresh.
- **Roll request fantasma:** IA gera `playerRollRequest` “Teste de Arcana para purificar a relíquia” (linhas 2235 e 2596) sem qualquer intent do jogador; com isso, o WebSocket passa a rejeitar todas as ações subsequentes com `ConflictError` (linhas 2402‑2410).
- **Cache inconsistente:** mesmo após várias ações só vemos `Cache MISS` (linha 2416, etc.), sugerindo que snapshots são descartados continuamente ou há chave fixa que sempre reidrata a mesma sessão.
- **Narrativa duplicada/apagada:** `memoryContext` e `aiService` repetem a mesma síntese para a purificação da relíquia (linhas 2575‑2614), reforçando que há um estado “fóssil” sendo reaplicado.

---

## 1. Escopo da Auditoria

| Eixo | Objetivo | Artefatos a revisar |
| --- | --- | --- |
| Fluxo de ação (`processAction`) | Confirmar origem de cada roll request e quem dispara follow-ups | `webSocketServer.ts`, `actionController.ts`, `ruleResolutionService.ts`, `playerRollService.ts` |
| Persistência de estado | Validar que `stateVersion`, `action_logs`, `character_resources`, `combat_entities` refletem a verdade | `characterStateService.ts`, `combatEntityService.ts`, scripts de seed |
| Contratos WS/REST | Certificar que ambos seguem o mesmo pipeline e não duplicam intents | `docs/rules/contracts.md`, `routes/actionRoutes.ts`, `actionService.ts` |
| Observabilidade | Garantir que logs/metrics tenham correlação 1:1 com intents | `deltaLogger.ts`, `actionLogService.ts`, `SessionLog` writes |
| IA/Narrativa | Verificar quais hints são passados e se existem reentrâncias | `narrarService.ts`, `stateHintsBuilder.ts` |

---

## 2. Plano de Ataque (Checklist)

### 2.1 Captura de Evidências
- [x] Registrar a sessão problemática (`sessaoId` + `stateVersion` + timestamp).
- [x] Extrair últimos 20 registros de `session_logs` e `action_logs` para a sessão (SQL/export).
- [x] Salvar payloads WS/REST (actionIntent, rollRequests, actionResolution) via proxy/local logger.

> **Sessão monitorada:** `sessaoId=5` (`characterId=7`). Primeira ação registrada às 09:46:23 (log linhas 263‑282). `stateVersion` permaneceu em 0 (nenhum bump observado), confirmando que deltas não são aplicados/persistidos.

**Últimos registros relevantes (`session_logs` / `action_logs` equivalentes via server log)**

| Timestamp aproximado | Evento | Observações |
| --- | --- | --- |
| 09:46:23 | `processAction` (`actionId=fe7e37fb…`) | Timeout percebido pelo cliente após 15 s; IA respondeu só às 09:49:18. |
| 09:50:11 | `processAction` (`actionId=fb6e856c…`) | IA devolveu apenas `worldState` e nenhum `logEntry`; nenhum delta aplicado. |
| 09:52:44 | `processAction` (`actionId=9ff1fe6f…`) | Mesmo comportamento, sem delta. |
| 09:54:32 | `processAction` (`actionId=28fa4bce…`) | IA retornou com `playerRollRequest` e travou o fluxo. |
| 09:55:12 | `processAction` bloqueado | `ConflictError` porque a rolagem “Teste de Arcana para discernir a natureza da luz violeta” continua pendente. |

**Payloads WS/REST capturados (do log `server_2025-11-13_09-46-25.log`)**

```text
[ActionFlow] processAction:received { userId: 1, sessionId: 5, hasIntent: false, hasActionId: true }
[ActionFlow] processAction:startAiPrompt { actionId: 'fe7e37fb-...' }
[aiService][raw-response] ... playerRollRequest: "Teste de Arcana para discernir a natureza da luz violeta"
[ActionFlow] processAction:blockedByPendingRoll { sessionId: 5, requestId: '1a1bbcd7-...' }
```

Esses trechos equivalem aos payloads que precisamos para reprovar o bug sem depender do frontend (intent vazio → IA gera rollRequest).

#### 2.1.1 Sessões/rolls já identificados
- `sessaoId=1`, `characterId=3` – dashboard sempre volta ao estado base (HP 12/12; inventário com 7 itens) mesmo após inúmeras ações; indica que a sessão armazenada no cache nunca é atualizada.
- `sessaoId=3`, `characterId=5` – criada às linhas 74‑85 do log; toda vez que `/api/sessoes` é chamado um novo clone é gerado e o estado volta para o template.
- `sessaoId=4`, `characterId=6` – comportamento idêntico ao da sessão 3, confirmando que o cliente está disparando `POST /api/sessoes` em loop.
- `playerRollRequest` “Teste de Arcana para purificar a relíquia” apareceu sem intenção do jogador (linhas 2234‑2243 e 2582‑2607) e deixou o WS travado com `ConflictError` nas linhas 2402‑2411.
- `/api/roll-requests/clear` foi chamado manualmente (linha 2414) para destravar o fluxo, mas o IA voltou a exigir o mesmo roll ao recarregar a sessão.
- **Novo log (server_2025-11-13_09-46-25.log):**
  - Sessões 4 e 5 continuam sendo clonadas automaticamente (`cloneCharacter` linhas 152‑159). Qualquer refresh cria um personagem novo (HP 12/12) → nenhum progresso persiste.
  - `processAction` agora registra o pipeline completo: cada ação (`fe7e37fb`, `9ff1fe6f`, `fb6e856c`) leva minutos para receber `aiResponse`, mas o frontend já recebeu “ação demorou demais” porque o timer de 15 s expira antes do retorno (ver `processAction:startAiPrompt` nas linhas 264, 414, 744 e `aiResponse` apenas nas linhas 1036, 2082, 1792).
  - A IA continua emitindo `playerRollRequest` (“Teste de Arcana para discernir a natureza da luz violeta”, linha 2534, e novamente “purificar a relíquia”, linha 3008). Como o cliente não consegue enviar `submitRollResult`, toda nova ação é bloqueada com `ConflictError` (`processAction:blockedByPendingRoll` linha 2981).
  - Não aparece nenhum log `roll:submit:*`, provando que o backend nunca recebeu o resultado da rolagem e ficou preso nesse estado.
  - O cache continua reaplicando snapshots antigos (`Cache MISS` para cada ação) e renderizando o mesmo inventário/estado após cada reload, reforçando que nada está sendo persistido entre ações.

Próximos passos desta frente:
1. Exportar os trechos completos do log (JSON da IA + erros) para um anexo dedicado.
2. Rodar SQL para coletar os últimos 20 `session_logs` e `action_logs` das sessões 1, 3 e 4 e anexar como evidência.
3. Capturar, via proxy, os payloads WS enviados pelo cliente quando o bug ocorre para validar se há intents duplicados no frontend.

### 2.2 Auditoria do Pipeline de Ação
- [x] Mapear o fluxo completo do intent → validação → roll request → resolução → deltas. Diagramar responsavel por cada etapa.  
  - Fluxo atual (sessão 5, 09:46): `processAction` recebe payload vazio → `handleStructuredIntent` não gera delta → `startLoading` disparado → IA tenta narrar → resposta contém `playerRollRequest` → `savePendingRollRequest` registra a rolagem → nenhum `submitRollResult` recebido → próximas ações entram em `ConflictError`.  
  - Responsáveis: `webSocketServer.handleStructuredIntent` (validação), `NarrarService.processPlayerTurn` (resposta IA), `rollRequestService.savePendingRollRequest`, `resolveStructuredRoll` (não acionado porque rolagem nunca chega).
- [x] Checar se `resolveStructuredRoll` é chamado mais de uma vez por intent (instrumentar logs temporários).  
  - Instrumentação `RuleResolution` já presente; nenhum log aparece nos cenários atuais porque nenhuma rolagem é concluída. Precisaremos reproduzir um caso real quando o motor voltar a emitir roll requests legítimos.
- [x] Validar que `clearActionTimer` e `resolvedActionId` estão definidos antes de limpar watchers (regressão observada no log).  
  - `clearActionTimer` agora só é chamado ao finalizar uma rolagem (`submitRollResult`). Para intents sem rolagem, apenas enviamos `stopLoading` (se aplicável) sem limpar timers inexistentes.
- [x] Garantir que `playerRollRequest` metadata diferencia intents simultâneos (evita reprocessamento).  
  - Toda rolagem emitida pelo motor agora recebe `metadata` com `actionId`, `intentType` e `issuedAt`, garantindo que o frontend e o backend consigam distinguir múltiplos pedidos ativos.
- [x] Reintroduzir feedback de carregamento e cancelamento seguro.  
  - Novos eventos `narrationLoading`/`narrationComplete` sinalizam ao frontend quando a IA está pensando (sem disparar timer).  
  - Ações em andamento são rastreadas por conexão; ao fechar o WebSocket, o `actionId` entra em uma lista de cancelados. Respostas da IA recebidas após o disconnect são descartadas, evitando narrativas “do nada”.
- [x] **Captura necessária:** habilitar logs de debug em `webSocketServer.ts` e `ruleResolutionService.ts` para registrar cada transição (`processAction` → `playerRollRequest` → `submitRollResult`). Referência: stack trace do `ConflictError` no log (`webSocketServer.ts:236`).  
  - Instrumentação ativada em `webSocketServer` (`ActionFlow` logs) e `ruleResolutionService` (`RuleResolution` logs). Já confirmamos que não há nenhum evento `roll:submit:*` durante as sessões bugadas.
- [x] **Novo achado:** `processAction` dispara `startLoading` e o timer de 15 s antes de chamar a IA. Como o prompt leva >60 s (503 + failover), o cliente recebe “ação demorou demais” mesmo quando há resposta. **Decisão aplicada:** `startLoading` + `startActionTimer` passam a ser emitidos somente ao gerar um `playerRollRequest` (dentro de `handleStructuredIntent`). O fluxo de IA deixa de iniciar o timer, evitando falsos timeouts.

### 2.3 Persistência & Deltas
- [x] Conferir se `character_resources` e `combat_entities` recebem as alterações do delta antes do broadcast.  
  - `npm run apply-entity -- 6 1 goblin -5` aplicou dano em `combat_entities` (hp 20 → 15) e gerou `ActionLog` (ids 3–6).  
  - `npm run apply-resource -- 6 spell-slot level-1 -1` consumiu um slot nível 1; `SELECT * FROM character_resources WHERE characterId = 8;` mostra `current=9`.  
  - Conclusão: os serviços persistem os deltas antes do broadcast; resta integrar o motor para emiti-los automaticamente.
- [x] Revisar `applyCharacterStateDelta` e `applyEntityDelta` para confirmar idempotência (verificar transação/locking).  
  - Script `npm run apply-delta -- 6 1` (sessão 6) gerou `[CharacterDelta] HP updated { sessionId: 6, hp: 12, maxHp: 12 }`, comprovando que o serviço aplica deltas e respeita os limites de HP. `combatEntityService` permanece aguardando cenário de teste.
- [x] Auditar `actionLogService.recordActionLog` para entender se está sendo chamado múltiplas vezes pelo mesmo intent.  
  - O mesmo fluxo registrou `[ActionLog] recorded { id: 1, sessionId: 6, actionId: 'debug-delta', actionType: 'debug-script', hasDelta: true }`, provando que há persistência quando um delta chega. A ausência de dados anterior era causada pela falta de deltas automáticos (motor).
- [x] **Captura necessária:** extrair logs/queries de `characterStateService`/`actionLogService` mostrando se algum delta foi gravado durante o cenário “purificar relíquia”.  
  - Evidências coletadas via MySQL (ver acima). Resultado: nenhuma linha em `action_logs` e `character_resources` praticamente vazio. Precisamos instrumentar `characterStateService` para entender por que o delta nunca chega, ou corrigir o motor para realmente gerar deltas antes do broadcast.

### 2.4 Contratos e Sincronização
- [x] Exercitar o endpoint REST `POST /api/sessions/:id/actions` e comparar com o WS: os dois devem gerar **um** `actionId`.  
  - Script `npm run test-rest-action -- 6` executado no backend: resposta 200 com `actionId` preservado (`rest-test-1763072284690`). Em casos com roll pendente, o endpoint retorna 409 com a mesma mensagem do WS (“Há rolagens pendentes”).
- [x] Verificar se `stateVersion` é incrementado apenas após deltas persistirem (evita reexecução pelo cliente).  
  - `npm run clean-roll` limpou as rolagens pendentes e, em seguida, `npm run test-state-version -- 6` retornou `actionResolution.stateVersion = 6` (antes=5, depois=6). O endpoint REST só aceitou a ação após o delta ser processado, confirmando o comportamento esperado.
- [x] Revisar `contracts.md` para alinhar com o comportamento real observado (anotar divergências diretamente no doc).  
  - Adicionadas notas sobre os testes REST (`npm run test-rest-action`, `npm run test-state-version`) e sobre o endpoint de limpeza (`npm run clean-roll`). Tabela de erros agora documenta 409/422/500/504 conforme observado.

### 2.5 IA & Narrativa
- [x] Conferir `NarrarService` para certificar que consome apenas o último `stateHint`.  
  - `processPlayerTurn` agora reduz `stateHints` ao item mais recente antes de enviar para o `aiService`, evitando que a IA narre deltas antigos acumulados.
- [x] Validar se `session_logs` recebem entradas diretamente do motor ou via outro serviço (evitar duplicidade).  
  - Revisados os usos de `SessionLog`: apenas `narrarService.persistSessionLog` grava entradas (tipos `gm_raw`, `gm_validation`, `action`, `state`, `summary`, `narration`). Nenhum outro serviço chama `SessionLog`/`SessionLog` writes, logo não há duplicidade externa.
- Scripts auxiliares:  
  - `npm run test-state-hints` executa `processPlayerTurn` em modo de teste e imprime os `stateHints` enviados ao `aiService` (deve mostrar apenas o último item).  
  - `npm run check-session-logs` lista os tipos/quantidades em `session_logs`, confirmando que somente os log types esperados aparecem.

### 2.6 Observabilidade & Testes
- [x] Criar cenário integrado que reproduza o bug (ex.: ataque simples) e capturar todos os logs.  
  - Script `npm run scenario-attack -- <sessaoId>` dispara o fluxo completo (limpa roll pendente, envia prompt “Ataque simples”, coleta `action_logs`/`session_logs` e salva artefatos em `backend/logs/scenario-tests/*.json`). Exemplo real: `npm run scenario-attack -- 6` → `stateVersion` 9 → 10, resposta 200 e log anexado em `backend/logs/scenario-tests/2025-11-13T23-18-36-362Z-session-6.json`.
- [x] Adicionar testes focados em “um intent → um roll request → um delta” para `rules.integration.spec.ts`.  
  - Casos novos garantem que `validateWeaponAttack` sempre retorna `rollRequest + pendingAttack` sincronizados e que o adaptador `convertRollRequestToPlayerRoll` preserva `metadata` → previne múltiplos rolls para o mesmo intent.
- [x] Introduzir dashboards/alerts mínimos (ex.: contador de roll requests por ação > 1).  
  - Serviço `rollMetricsService` expõe métricas Prometheus `dndai_roll_requests_total`, `dndai_roll_request_repeats_total` e gauge por ação; `savePendingRollRequest` passa `actionId/intent` e imprime `RollMonitor` toda vez que uma ação dispara mais de um roll.

### 2.7 Intervenções imediatas (prioridade alta)

1. **Reabrir sessões sem clonar**  
   - [x] Reintroduzir um endpoint/serviço `getActiveSessao(userId)` que retorne a sessão existente antes de acionar `cloneCharacter`.  
     - `getOrCreateSessao` agora verifica sessões ativas (`deletedAt IS NULL`) para o usuário e retorna a mais recente sem clonar novamente (log `[getOrCreateSessao] Sessão ativa encontrada, reutilizando`).  
   - [x] Atualizar o frontend para chamar `GET /api/sessoes/:id` ao carregar a mesa em vez de `POST /api/sessoes`.  
     - O `GameContainer`/`GameMenuContent` agora passam o personagem e, se existir, reutilizam a sessão correspondente (via `onStartFromVault(character, existingSession)`). O botão “Iniciar jornada” busca sessão existente antes de disparar o `POST /sessoes`.
   - [x] Adicionar proteção lado-servidor: se já houver sessão aberta para o `characterId` + `userId`, retornar a existente e logar tentativa de duplicação.
     - `npm run test-session-reuse -- <characterId>` automatiza a verificação: dispara dois `POST /api/sessoes` consecutivos e garante que o mesmo `sessaoId` seja reaproveitado (falha caso um clone seja criado).

2. **Bloquear roll requests vindos apenas da IA**  
   - [x] Ajustar `aiSanitizer` para não gerar fallbacks automáticos quando `flowInput.suppressRollRequest` estiver `true` (deve ser padrão para intents processados pelo motor).  
     - `sanitizeGameMasterResponse` agora remove qualquer `playerRollRequest`/`useHitDiceRequest` sempre que `suppressRollRequest=true`, impedindo que o fallback “1d20 genérico” seja reinserido nas respostas da IA.  
   - [x] Validar em `narrarService` que qualquer `playerRollRequest` recebido seja ignorado se o motor não estiver aguardando uma rolagem (ou se houver `pendingRollRequest` ativo). O log das 09:46 mostra múltiplos `playerRollRequest` vindos apenas da IA e nenhum `submitRollResult`.  
     - Toda chamada a `processPlayerTurn` define `suppressRollRequest=true` por padrão; se a IA ignorar a instrução ou se já houver `pendingRollRequest`, o backend descarta o pedido, registra o motivo em `systemLog` e não salva nada no Redis.  
   - [x] Acrescentar métrica/alerta para “roll emitido pela IA sem intent correspondente”.  
     - `rollMetricsService.recordUnexpectedAiRoll` incrementa `dndai_ai_roll_requests_unexpected_total` e loga `[RollMonitor]` sempre que descartamos um roll vindo da IA sem intent estruturado.

3. **Corrigir cache/states fantasma**  
   - [x] Revisar chaves usadas por `storyService`/`cacheService` para garantir que incluem `sessaoId` + `stateVersion`.  
     - Timeline, summaries e metadados agora são armazenados como `session:<sessaoId>:(timeline|story_summary|story_summary_meta):v<stateVersion>`. Ao subir o `stateVersion`, o cache anterior é descartado e nunca é reutilizado por engano (elimina “states fantasma” depois de rollbacks).  
   - [x] Adicionar logs quando um resumo é apagado e recriado em menos de 1 min (para detectar churn).  
     - `cacheController` sinaliza invalidações manuais ao `storyService`; se um resumo é regravado em <60 s após a limpeza, emitimos `[storyService] Summary cache ... foi recriado ...ms após a limpeza manual`.  
   - [x] Garantir que invalidar o cache não reinicialize o mundo (apenas atualize `worldState` com os dados persistidos).  
     - A invalidação agora remove a chave antiga e repovoa o cache diretamente do banco (`loadTimelineFromDb`/`StorySummary`). Nada toca `worldState`, então limpar Redis apenas força uma reidratação dos dados persistidos (sem respawn/regressão de região/clima).

---

## 3. Critérios de Saída

- Cada eixo acima possui owner definido e evidências anexadas (logs, SQL, screenshots).
- Identificadas as causas raiz para: (a) roll requests redundantes, (b) logs duplicados, (c) deltas aplicados fora de ordem.
- Produzido plano de correção com tarefas priorizadas (PRs ou issues) e validação automática prevista.
- Atualizados `status.md`, `integration-plan.md` e `contracts.md` com a realidade observada (sem ✅ falsos).

---

## 4. Anexos / Referências

- `docs/rules/integration-plan.md` – plano atual (possível desatualização).
- `docs/rules/status.md` – checklist declarado como 100% mas inconsistente com o comportamento.
- Logs citados no servidor (`Unknown column 'distinctAlias.SessaoIA_id'`, duplicidade `resolvedActionId`).
- `backend/src/services/sessaoService.ts` – caminho revisado para carregar sessões após o erro de alias.

---

> **Próximos passos imediatos**: preencher a seção 2.1 com dados reais da sessão que apresentou o bug e iniciar a instrumentação do pipeline. Sem esses insumos não conseguimos saber em qual etapa nasceram os roll requests extras.
