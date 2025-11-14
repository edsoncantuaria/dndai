# Status Geral – Motor & Contratos

Este checklist acompanha o progresso dos artefatos descritos em `overview.md`, `engine.md` e `integration-plan.md`. Utilize as colunas para saber o que já está pronto (✅), em andamento (🟡) ou pendente (⬜️).

## 1. Motor de Regras (engine.md)

| Componente | Status | Observações |
| --- | --- | --- |
| Catálogos SRD carregados em memória | ✅ | JSON sincronizados via dnd5eapi + serviço `catalog.ts`. |
| Normalizadores → `RulesCharacterState` | ✅ | Snapshot agrega atributos, recursos, condições e inventário para o motor. |
| Módulo `character.ts` (atributos, proficiências) | ✅ | Funções básicas implementadas. |
| Módulo `combat.ts` (ataques, condições) | ✅ | Novo módulo calcula vantagem/desvantagem via condições e fornece DC de concentração. |
| Módulo `spells.ts` | ✅ | Agora valida slots disponíveis, expõe `buildSpellSlotCost` e auxiliares de ataque/CD. |
| Módulo `rest.ts` | ✅ | Descansos restauram recursos/slots conforme refresh e mantêm HP/benefícios. |
| Módulo `skills.ts` | ✅ | Tabelas de dificuldade → DC padrão e metadados retornados nas validações. |
| Orquestrador `processAction` | ✅ | Intents de dano/cura/consumo e roll-follow-up aplicam deltas antes da IA. |
| Tipagens principais (`RulesCharacterState`, `ActionIntent`, `ValidationResult`) | ✅ | Definidas conforme proposta; ajustar conforme novos deltas. |
| Testes automatizados por módulo | ⬜️ | Suites Jest ainda não criadas. |

## 2. Persistência (integration-plan.md)

| Item | Status | Observações |
| --- | --- | --- |
| Tabela `character_resources` criada | ✅ | Entidade + relação com `Character`. Falta seed de dados por classe. |
| Popular slots/recursos automáticos | ✅ | Serviço + script `syncCharacterResources` preenchem slots e recursos de classe via SRD. |
| Tabela `combat_entities` para NPCs/inimigos | ✅ | Nova entidade + serviço `combatEntityService` armazenam HP, AC, metadata e efeitos agendados. |
| Histórico de deltas (`action_logs`) | ✅ | Entidade + `recordActionLog` registram actionId/stateVersion/delta em `action_logs`. |
| Controle de inventário consumível (`character_items.quantity`) | ✅ | Serviço `inventoryService.consumeCharacterItem` decrementa/remover itens com logging. |

## 3. Motor & Intents (integration-plan.md)

| Item | Status | Observações |
| --- | --- | --- |
| Guardar metadados em `playerRollRequest` (arma, alvo, dano) | ✅ | `RollRequest.metadata` agora propaga arma/magia, alvos, dano e custos para `playerRollRequest`. |
| `applyCharacterStateDelta` com HP/recursos | ✅ | HP, recursos e inventário aplicados com logging (`characterStateService`). |
| `applyEntityDelta` para NPCs/inimigos | ✅ | `applyEntityDeltaWithLog` integra `combat_entities` ao mesmo fluxo de deltas (via `applyResultingStateDelta`). |
| Novos intents (dano, cura, consumo de item) | ✅ | Intents `damage`, `healing`, `consume-item` expostos no motor e contratos WS. |
| Reprocessamento pós-rolagem (calcular dano final e persistir) | ✅ | Ataques agora disparam automaticamente rolagens de dano e aplicam deltas antes da narração (`resolveStructuredRoll`). |

## 4. Contratos (contracts.md)

| Item | Status | Observações |
| --- | --- | --- |
| WebSocket `processAction` com `stateDelta` | ✅ | `actionResolution/gameStateUpdate` já carregam HP, recursos, inventário e NPCs atualizados (ver contratos.md). |
| `stateVersion` persistido/validado | ✅ | `SessaoIA` armazena versão e sincroniza com cliente. |
| Endpoint REST `POST /sessions/:id/actions` | ✅ | Rota `actionRoutes` + `actionController/actionService` replicam o fluxo do WS. |
| Timeouts/erros no REST | ✅ | Mesmo contrato do WS com códigos 409/422/504 documentados em `contracts.md`. |
| Contrato para NPC/entity updates | ✅ | `contracts.md` descreve `updatedEntities` (encounterId, entityId, hp, hpMax). |

## 5. IA & UI

| Item | Status | Observações |
| --- | --- | --- |
| Hints de `stateDelta` para `NarrarService` | ✅ | `stateHints` levam HP/slots/dano ao prompt, garantindo narração alinhada ao delta aplicado. |
| UI exibindo badges/deltas (HP, slots) | ✅ | GameScreen agora destaca perda/ganho de HP e slots consumidos com toasts/badges e cues. |
| Bloqueio de comandos indisponíveis | ✅ | Painéis validados (ataque, magias, inventário) respeitam turno/rolagens pendentes. |

## 6. Observabilidade & Testes

| Item | Status | Observações |
| --- | --- | --- |
| Logs estruturados de deltas aplicados | ✅ | `deltaLogger` grava JSON (actionId/stateVersion/payload) a cada stateDelta. |
| Métricas (dano total, slots consumidos) | ✅ | `deltaMetricsService` exporta contadores via `/metrics`. |
| Testes integrados (combate, descanso, conjuração) | ✅ | `backend/src/__tests__/rules.integration.spec.ts` cobre combat modifiers, rest resources e utilidades de conjuração. |

## Como usar
- Atualize esta tabela sempre que completar uma etapa do plano.
- Itens em 🟡 requerem follow-up imediato para evitar regressões no fluxo narrativo.
- Quando um item for concluído, mova-o para ✅ e linke PR/commit relevante.
