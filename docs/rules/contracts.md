# Contratos Front ↔ Backend ↔ IA

## WebSocket – `processAction`

### Payload Atual

```json
{
  "type": "processAction",
  "sessionId": 123,
  "prompt": "Eu ataco o goblin.",
  "combatState": { "...": "..." },
  "useAiHomebrew": true,
  "model": "gemini-2.5",
  "actionId": "uuid-v4",
  "clientStateVersion": 7,
  "intent": {
    "type": "weapon-attack",
    "payload": {
      "weaponIndex": "longsword",
      "targetArmorClass": 13
    }
  }
}
```

### Intents suportados

- `weapon-attack`: ataque com arma equipada.
- `skill-check`: teste de perícia (ex.: `perception`) com CD opcional.
- `spell-attack`: ataque mágico informando a magia e habilidade.
- `rest`: descanso curto/longos (bloqueado durante combate).

Se o intent estiver ausente, o backend delega toda a lógica à IA (fluxo legacy).

### Respostas

1. **`actionAck`** – confirma recepção.
2. **`startLoading { actionId }`** – indica processamento e ativa timeout (15 s).
3. **`actionResolution`** – resultado do motor/IA (com `stateDelta` opcional indicando efeitos sugeridos, ex.: dano calculado, descanso validado).
   ```json
   {
     "type": "actionResolution",
     "payload": {
       "actionId": "uuid-v4",
       "stateVersion": 8,
       "status": "needs_roll",
       "rule": "weapon-attack",
       "rollRequest": { ... } | null,
       "result": { ... } | null,
       "stateDelta": { ... } | null
     }
   }
   ```
   - `status: "needs_roll"` → motor exigiu `rollRequest`.
   - `status: "accepted"` → motor/IA aplicou resultado (opcional `result`, `stateDelta`).
   - `status: "rejected"` → motivo em `result.systemLog`.
4. **`gameStateUpdate`** – payload completo (logs, personagem, `stateVersion`).
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

Recebe o mesmo pipeline (`startLoading` → `actionResolution` → `gameStateUpdate`).

## Erros comuns

- `STATE_DESYNC`: `clientStateVersion` difere do servidor → front deve recarregar a sessão.
- `409 pending roll`: existe `playerRollRequest` não resolvido.
- `timeout`: backend não conseguiu concluir; usuário deve reenviar ou recarregar.

## Integração IA

- O motor valida intents antes de acionar a IA.
- `actionResolution.result` (quando presente) traz os dados que a IA usou para narrar.
- `stateDelta` permite aplicar efeitos (ex.: descanso validado) mesmo sem resposta textual.

## Próximos passos

- Persistir `stateVersion` em todos os endpoints REST e na carga inicial.
- Enviar `stateDelta` concretos (HP, recursos) conforme o motor passar a mutar o estado.
- Produzir respostas REST equivalentes para automações fora do WebSocket.
