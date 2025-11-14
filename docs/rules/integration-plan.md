# Plano de Evolução – Motor Autoritativo & Contratos

## Objetivo
Transformar o backend na fonte de verdade para tudo que envolve regras (HP, recursos, slots, inventário, inimigos), deixando a IA apenas narrar. Todas as ações passam pelo motor → efeitos são aplicados e persistidos → a IA recebe o estado final para descrever a cena.

---

## 1. Persistência

### 1.1 Recursos do personagem
- [x] Criar `character_resources` (id, characterId, type, key, current, max, metadata).
- [x] Popular slots de magia e afins (Action Surge, Ki, etc.) com base na classe. (`tsx backend/src/scripts/syncCharacterResources.ts`)

### 1.2 Inimigos/NPCs
- [x] Criar `combat_entities` ligados a `CombatEncounter` com HP atual, máximo e metadados. (`backend/src/entities/CombatEntity.ts`, relação em `CombatEncounter.ts`)
- [x] Permitir registrar ações futuras (condições, efeitos) via `pendingEffects` + serviço `combatEntityService`. (`backend/src/services/combatEntityService.ts`)

### 1.3 Histórico/Delta (futuro)
- [x] Tabela `action_logs` + serviço `recordActionLog` para auditar deltas (actionId, stateVersion, payload). (`backend/src/entities/ActionLog.ts`, `backend/src/services/actionLogService.ts`)

---

## 2. Motor & Intents

### 2.1 Metadados nos roll requests
- [x] Guardar em cada `playerRollRequest`:
  - arma/magia usada
  - alvo(s)
  - fórmula de dano/cura
  - recursos a consumir (item, slot)
  (`RollRequest.metadata` → `PlayerRollRequest.metadata`, atualizado em `attack.ts`, `spellAttack.ts`, `skills.ts`, `damage.ts`)

- [x] `applyCharacterStateDelta` agora aplica HP, recursos e inventário (`characterStateService`, `characterResourceService`, `inventoryService`).
- [x] `applyEntityDelta`, `consumeInventoryItem`, `consumeResource` disponíveis via serviços (`combatEntityService`, `inventoryService`, `characterResourceService`).
- [x] Novos intents `damage`, `healing`, `consume-item` geram/consomem recursos e inventário com validação determinística.
- [x] Reprocessamento pós-rolagem para efeitos de dano/cura: `resolveStructuredRoll` aplica automaticamente os deltas antes de acionar a IA.
- Ao receber o resultado da rolagem:
  1. motor recalcula o efeito (acertou? dano final? alvo).
  2. aplica no banco (HP, slots, inventário, inimigos).
  3. incrementa `stateVersion`.
  4. envia `actionResolution` + `gameStateUpdate` com o estado novo.
  5. IA narra em cima disso.

### 2.3 Novos intents
- [x] Dano (após ataque bem-sucedido). (`damage` intent + auto follow-up em `ruleResolutionService`/`webSocketServer`)
- [x] Recuperação (poções, magias de cura). (`healing` intent reaproveita o mesmo pipeline e aplica deltas antes da IA)
- [x] Consumo de recursos (poções, flechas, pergaminhos). (`consume-item` intent + `inventoryService.consumeCharacterItem`)

---

## 3. Contratos (WS + REST)

### 3.1 WebSocket
- Já existe `actionAck/startLoading/actionResolution/gameStateUpdate`.
- Passar `stateDelta` e `updatedCharacter` com o estado persistido.

### 3.2 REST
- [x] Criar `POST /api/sessions/:id/actions` com o mesmo payload do WS.
- [x] Retornar `actionResolution` + `gameStateUpdate`.
- [x] Utilizar `stateVersion` para detectar desync / ETags (`stateVersionService`).

### 3.3 Timeouts/erros
- [x] WebSocket já emite `timeout`.
- [x] REST reutiliza o mesmo pipeline, retornando 409/422/504 conforme o erro (`actionService` + `errorMiddleware`).

---

## 4. IA & UI

### 4.1 Narrativa com hint
- [x] Motor fornece `stateDelta`/hints; IA usa isso para narrar (ex.: “Você perde 7 HP”).
- [x] Caso a IA “queira” discordar, o estado oficial continua sendo o do backend (stateHints no prompt).

### 4.2 Front/UX
- [x] Toasts/deltas para HP/slots/inventário implementados (GameScreen mostra badges/cues a cada delta).
- [x] Slots e inventário são renderizados a partir do estado atualizado do backend (após `stateDelta`, UI reflete os valores sem ação manual).

---

## 5. Observabilidade/Testes

- [x] Logs estruturados para cada delta aplicado (`actionId`, `stateVersion`, payload).
- [x] Métricas: quantidade de dano aplicado, slots consumidos, descasos válidos.
- Testes unitários/integrados para intents/deltas (ataque, magia, descanso, inventário).

---

## Sequência sugerida (concluída)

1. Criar e popular `character_resources` / `combat_entities`.
2. Ajustar `playerRollRequest` para guardar contexto (arma, alvo, dano).
3. Aplicar deltas automáticos no personagem (descanso, danos básicos).
4. Estender para inimigos e consumo de inventário/slots.
5. Criar endpoint REST equivalente ao `processAction`.
6. Integração IA (usar hints) e melhorias na UI.

## Etapas seguintes sugeridas

7. Observabilidade & testes – métricas, logs e suites automatizadas cobrindo combate/descanso/conjuração.
8. Hardening & DX – lint/tests no CI, seeds consistentes e ferramentas de desenvolvedor para depurar intents/deltas.
