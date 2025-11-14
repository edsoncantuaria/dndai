# Contratos Front ↔ Backend ↔ IA

## WebSocket – `processAction`

### Payload Atual (DTO compartilhado com REST)

```json
{
  "type": "processAction",
  "contractVersion": 1,
  "sessionId": 123,
  "prompt": "Eu ataco o goblin.",
  "combatState": { "...": "..." },
  "useAiHomebrew": true,
  "model": "gemini-2.5",
  "actionId": "uuid-v4",
  "clientStateVersion": 7,
  "clientInstanceId": "frontend-tab-XYZ",
  "actionCursor": 42,
  "intent": {
    "type": "weapon-attack",
    "payload": {
      "weaponIndex": "longsword",
      "targetArmorClass": 13
    }
  }
}
```

- `contractVersion` **obrigatório** → clientes que enviarem valor diferente de `1` recebem `CONTRACT_VERSION_MISMATCH` (HTTP 426 ou erro WS).
- `clientInstanceId` identifica o lease da sessão (previne clones).
- `actionCursor` deve ser monotônico e reflete o último intent aplicado no cliente.

### Intents suportados

| Intent | Objetivo | Principais campos |
| --- | --- | --- |
| `weapon-attack` | Validar jogada de ataque corpo a corpo/à distância. | `weaponIndex`, `targetArmorClass`, `targetId`, `targetKind`. |
| `spell-attack` | Jogada de ataque mágico consumindo slots. | `spellIndex`, `ability`, `slotLevel`, `targetArmorClass`. |
| `skill-check` | Teste de perícia com DC ou dificuldade (`medium`, `hard`, ...). | `skillIndex`, `ability`, `dc`, `difficulty`. |
| `rest` | Descanso curto ou longo, restaurando recursos elegíveis. | `restType: "short" | "long"`. |
| `damage` | Aplicar dano direto (ex.: área, armadilha). | `damageFormula`, `modifier`, `target`. |
| `healing` | Cura por magia/item. | `healFormula`, `modifier`, `target`. |
| `consume-item` | Consumir itens/recursos de inventário. | `itemId`/`itemIndex`, `quantity`. |

Se o `intent` não for enviado, o backend ainda aceita o fluxo legacy controlado pela IA, mas sem garantias de validação SRD.

### Respostas

1. **`actionAck`** – confirma recepção.
2. **`startLoading { actionId }`** – indica processamento e ativa timeout (15 s).
3. **`actionResolution`** – resultado do motor/IA, com **pipeline em fases** (`RECEIVED → NORMALIZED → RULES → AI_SYNTHESIS → DELTA_APPLIED`). Logs `ActionFlow` indicam cada fase e o tamanho atual da `rollQueue`. A resposta sempre traz `stateVersion` e pode incluir:
   - `stateDelta`: efeitos determinísticos (HP, recursos, inventário, descanso).
   - `updatedCharacter`: espelho resumido (HP atual, slots/recursos alterados).
   - `updatedEntities`: array `{ encounterId, entityId, hp, hpMax }` para NPCs/inimigos.
   - `playerRollRequest`: quando `status === "needs_roll"`.
   ```json
   {
     "type": "actionResolution",
     "payload": {
       "actionId": "uuid-v4",
       "stateVersion": 8,
       "status": "needs_roll",
       "rule": "weapon-attack",
       "rollRequest": { ... },
       "stateDelta": {
         "pendingAttack": { "weapon": "Espada Longa", "damageFormula": "1d8+3" }
       }
     }
   }
   ```
   - `status: "needs_roll"` → motor exigiu `rollRequest`.
   - `status: "accepted"` → motor/IA aplicou resultado (opcional `result`, `stateDelta`).
   - `status: "rejected"` → motivo em `result.systemLog`.
4. **`gameStateUpdate`** – payload completo com `stateVersion`, `updatedCharacter` (HP, slots, inventário), `updatedEntities` (lista `{ encounterId, entityId, hp, hpMax }`), `playerRollRequest` (quando aplicável) e logs. Após dano/cura automático, o estado chega já persistido. Quando `playerRollRequest` existe, o backend envia apenas entradas `system` (ex.: “O motor aguarda sua rolagem...”) e `actionOptions = []` – o cliente deve bloquear novas intents até que `submitRollResult` conclua o ciclo.
5. **`stopLoading { actionId }`** – encerra spinner (também emitido em caso de timeout).

### Timeouts

Após 15 s sem `actionResolution`, o servidor envia:

```json
{ "type": "timeout", "payload": { "actionId": "uuid-v4" } }
```

O cliente remove o `actionId` pendente e alerta o usuário para reenviar.

## `submitRollResult`

```json
{
  "type": "submitRollResult",
  "sessionId": 123,
  "requestId": "roll-789",
  "apiKey": "...",
  "clientStateVersion": 7,
  "result": {
    "dice": [15],
    "modifier": 5,
    "total": 20
  }
}
```

Recebe o mesmo pipeline (`startLoading` → `actionResolution` → `gameStateUpdate`). Se for um ataque:

1. Jogada de ataque (`attack` roll) → `actionResolution` com `attackOutcome`.
2. Se acertar, o backend envia novo `playerRollRequest` de `damage`.
3. Ao receber o dano, aplica os deltas (HP, slots, inventário) **antes** de chamar a IA, e `gameStateUpdate` já traz o estado final.

## Erros comuns

- `STATE_DESYNC`: `clientStateVersion` difere do servidor → front deve recarregar a sessão.
- `409 pending roll`: existe `playerRollRequest` não resolvido.
- `timeout`: backend não conseguiu concluir; usuário deve reenviar ou recarregar.

## Integração IA

- O motor valida intents antes de acionar a IA.
- `actionResolution.result` (quando presente) traz os dados que a IA usou para narrar.
- `stateDelta` permite aplicar efeitos (ex.: descanso validado) mesmo sem resposta textual.

## REST – `POST /api/sessions/:id/actions`

Endpoint equivalente ao WebSocket. Payload (o mesmo DTO, exceto `sessionId` que vem da rota):

```json
{
  "contractVersion": 1,
  "prompt": "Eu ataco o goblin.",
  "intent": { "...": "opcional" },
  "combatState": null,
  "apiKey": "chave-do-usuario",
  "clientStateVersion": 7,
  "actionId": "opcional",
  "useAiHomebrew": true
}
```

Resposta:

```json
{
  "actionResolution": { ... },
  "gameStateUpdate": { ... }
}
```

> Automação: `npm run test-rest-action -- <sessaoId>` assina um JWT com `JWT_SECRET` e chama esse endpoint. Em 13/11 o backend respondeu com `status 200` e preservou o `actionId` enviado (`rest-test-1763072284690`). Quando há `playerRollRequest` pendente, o endpoint retorna 409 (“Há rolagens pendentes”), igual ao WS.

### Timeouts/Erros REST

| Código | Descrição |
| --- | --- |
| 426 `CONTRACT_VERSION_MISMATCH` | Cliente desatualizado (enviar `contractVersion: 1`). |
| 409 `STATE_DESYNC` | `clientStateVersion` divergente. |
| 409 `pending roll` | Existe `playerRollRequest` não resolvido (use `npm run clean-roll` em dev). |
| 422 | Intent rejeitada pelo motor (mensagem detalhada no corpo). |
| 504 | Tempo limite atingido durante IA/validação (após mover o timer para `needs_roll`, não reproduzido). |
| 500 | Falha interna (ex.: exceções da IA, delta inválido, SRD ausente). |

O cliente deve reaplicar o mesmo fluxo do WebSocket: resolver `playerRollRequest` via `submitRollResult`, tratar `updatedEntities`, etc.

> Teste complementar: `npm run test-state-version -- <sessaoId>` lê `stateVersion` antes/depois. Após limpar as rolagens pendentes (`npm run clean-roll`), o teste confirmou que o REST incrementa o `stateVersion` apenas quando a ação é aceita (ex.: 5 → 6).

### Erros autoritativos (payloads)

```json
{ "type": "error", "payload": { "code": "STATE_DESYNC", "message": "Seu estado está desatualizado.", "expectedVersion": 42 } }
```

```json
{ "type": "error", "payload": { "code": "CONTRACT_VERSION_MISMATCH", "message": "Atualize o cliente para contractVersion 1." } }
```

```json
{ "type": "error", "payload": { "code": "ROLL_PENDING", "message": "Há rolagens pendentes para esta sessão." } }
```

## Próximos passos

- Expor endpoint REST equivalente para `submitRollResult` (se for necessário uso fora do WS).
- Emitir webhooks ou eventos quando múltiplos NPCs forem atualizados.
- Distribuir exemplos de erros autoritativos (409, 426 etc.) no guia de integração.
+ Distribuir exemplos de erros autoritativos (409, 426 etc.) no guia de integração.
