# Melhorias Autoritativas do Motor

> Plano derivado da auditoria (`docs/rules/audit.md`) para consolidar as intervenções prioritárias. Cada item abaixo descreve o objetivo, ações sugeridas e um quadro de acompanhamento.

---

## 1. Sessões determinísticas e reaproveitamento seguro

- [x] Implementar lease/heartbeat por sessão (`sessaoId`, `characterId`, `userId`) para impedir clones enquanto o lease estiver ativo.
- [x] Persistir e validar `actionCursor` para garantir aplicação monótona de intents.
- [x] Ajustar `getOrCreateSessao` para diferenciar reabertura de criação e registrar tentativas duplicadas.
- [x] Instrumentar script de verificação (`npm run test-session-reuse`) em CI.

## 2. Pipeline de ação baseado em state machine

- [x] Formalizar fases (`RECEIVED → NORMALIZED → RULES → AI_SYNTHESIS → DELTA_APPLIED`) em `processAction`.
- [x] Persistir fase atual e bloquear avanço se algum passo falhar.
- [x] Descartar `playerRollRequest` da IA quando `suppressRollRequest=true` ou quando há `pendingRollRequest`.
- [x] Garantir idempotência com checkpoints por fase nos logs estruturados (`ActionFlow`).

## 3. Fila autoritativa de roll requests

- [x] Criar `rollQueue` por sessão para armazenar `{actionId, rollId, metadata}` ativos.
- [x] Só permitir novo roll quando o item anterior for resolvido (`submitRollResult`).
- [x] Fazer o adaptador `convertRollRequestToPlayerRoll` consumir a fila para manter coerência com `pendingAttack`.
- [x] Emitir métricas `dndai_roll_request_repeats_total` e `dndai_ai_roll_requests_unexpected_total`.

## 4. Cache versionado por sessão/estado

- [x] Padronizar chaves `session:<sessaoId>:<artefato>:v<stateVersion>`.
- [x] Persistir o `stateVersion` que originou cada payload dentro do próprio cache.
- [x] Logar invalidações quando o cache é recriado em menos de 60 s após limpeza.
- [x] Recuperar timeline/resumos diretamente do banco após invalidação, sem reinicializar `worldState`.

## 5. Observabilidade acionável

- [x] Centralizar logs estruturados `ActionFlow` com `phase`, `intentHash`, `rollQueueSize`.
- [x] Exportar métrica `dndai_action_retries_total` e alertar quando >0 em 5 min.
- [x] Traçar spans do WebSocket/REST até `ruleResolutionService` (OpenTelemetry/Prometheus).
- [x] Correlacionar métricas de roll com `actionId` para identificar “rolls fantasmas”.

## 6. Testes e cenários integrados

- [x] Automatizar scripts `scenario-attack`/novos cenários para reproduzir intents completos (sem IA).
- [x] Adicionar testes e2e garantindo `stateVersion` monótono e ausência de roll duplicado.
- [x] Rodar cenários no CI e anexar artefatos (`backend/logs/scenario-tests/*.json`) como evidência.
- [x] Expandir `rules.integration.spec.ts` com casos de intent concorrente e fallback de IA ignorado.

## 7. Contratos WS/REST alinhados

- [x] Revisar `docs/rules/contracts.md` para refletir o pipeline em fases e a fila de rolls.
- [x] Introduzir schema version por contrato e validar no gateway (recusar clientes desatualizados).
- [x] Garantir que WebSocket e REST compartilhem o mesmo DTO (`processActionRequest`) para evitar intents divergentes.
- [x] Documentar erros autoritativos (ex.: `ConflictError`, `RollPendingError`) com exemplos de payload.

## 8. IA e Narração disciplinadas

- [x] Enriquecer `stateHintsBuilder` com indicadores de contexto (pendências, condições), evitando pedidos vagos da IA.
- [x] Inserir guard rails no `narrarService` para cortar instruções fora do escopo (mudança de cena, NPC extra) sem autorização do motor.
- [x] Treinar prompt de fallback explicitando que a IA nunca dispara rolagens – apenas descreve o desfecho informado pelo motor.
- [x] Logar e anexar respostas da IA que forem descartadas para análise posterior (dataset de correções).

## 9. UI/Frontend coerente com o motor

- [x] Atualizar Game UI para refletir fases da ação (ex.: spinner “Validando regras”, “Aguardando rolagem”).
- [x] Bloquear botões enquanto houver `pendingRollRequest` em aberto e exibir instruções claras ao jogador.
- [x] Sincronizar log narrativo com `stateVersion`: cada entrada deve carregar `stateVersion` aplicado para evitar duplicatas em tempo real.
- [x] Implementar reconciliação leve: ao reconectar, buscar `GET /api/sessoes/:id` + diff dos últimos logs em vez de reenviar intents.

## 10. Backend e aplicação de deltas

- [x] Isolar `stateDeltaApplier` em serviço único com validações (não aceitar `stateVersion` regressivo ou delta vazio).
- [x] Gravidade diferenciada para deltas fora de ordem (`warn`) vs. conflitantes (`error` + bloqueio da sessão).
- [x] Introduzir feature flag para aplicar deltas provenientes apenas do motor, rejeitando qualquer delta sem `authoritativeSignature`.
- [x] Registrar snapshot compacto antes/depois de cada delta em `action_logs` para facilitar auditoria e rollback.
