# Contrato IA × Motor de Regras

Este documento descreve **o que entra e o que sai** de cada turno no modo padrão `AI_PIPELINE_MODE=narration_only`.

## Princípio

| Camada | Responsabilidade |
|--------|------------------|
| **Motor (backend)** | Combate, HP, AC, inventário, equipar, carga, loot, loja, magias (slots), XP, level-up, rolagens (dados 3D), viagem, intents estruturados |
| **IA (Mestre)** | Prosa, atmosfera, NPCs falando, consequências já resolvidas, `actionOptions` jogáveis |
| **Jogador** | Escolhe opções, usa ficha, rola no 3D quando o motor pedir — não “comanda” a IA para alterar regras |

O jogador **não manipula a IA** para ganhar itens ou mudar HP. Texto livre é classificado; mecânica passa pelo motor.

---

## O que o jogador envia (entrada)

| Canal | Payload | Uso |
|-------|---------|-----|
| WebSocket `processAction` | `prompt`, `intent?`, `combatState`, `apiKey` | Ação livre ou intent (skill-check, attack, equip, travel…) |
| WebSocket `submitRollResult` | `rolls[]`, `requestId` | Resultado dos **dados 3D** após `playerRollRequest` |
| Ficha / UI | Intents tipados | Equipar, loot, loja, magias — sem passar pela IA |

Montagem do prompt (`createPrompt` em `promptAssembler.ts`):

- `character` — snapshot **somente leitura** (atributos, inventário resumido, magias, relações)
- `gameLog` — últimos eventos
- `combatState` — resumo do combate ativo (motor)
- `stateHints` — deltas do motor (`[Motor]`, rolagem, elenco)
- `storySummary`, `timelineFacts`, região, memória em camadas
- `playerAction` — texto do jogador ou instrução de fase DM

---

## O que a IA recebe (system + user)

**System** (`instructions.ts` + `narrativeContract.ts`):

- Papel de **mestre narrador**
- JSON **apenas** com chaves permitidas (modo narração)
- Proibição de `playerRollRequest`, `updatedCharacter`, `combatState`, etc.

**User** (prompt montado):

- Contrato de saída + exemplo JSON
- Contexto do personagem e cena
- Blocos `[Motor]` / `[Mestre — rolagem]` quando já houve teste

---

## O que a IA deve devolver (saída)

### Schema Zod: `NarrativePhaseResponseSchema`

```json
{
  "logEntries": [{ "type": "narration|system|...", "content": "..." }],
  "actionOptions": [{ "text": "...", "action": "...", "skill": "..." }],
  "systemLog": "opcional",
  "memoryContext": { "summary": "...", "references": [] },
  "newFacts": []
}
```

Após validação, `enforceNarrativeOnlyResponse` remove qualquer chave extra (`_meta`, `updatedCharacter`, …).

### Schema Gemini estruturado (se habilitado)

`NARRATIVE_PHASE_GENERATIVE_SCHEMA` — só `logEntries`, `actionOptions`, `systemLog`.

OpenRouter usa `response_format: json_object` + o mesmo contrato no prompt.

---

## O que o cliente recebe (após o backend)

1. `stripMotorOwnedFields` — remove lixo de estado da IA  
2. `enforceNarrativeOnlyResponse` — contrato narrativo  
3. Reconciliação de **combate** (motor) — HP real no banco  
4. `attachMotorProgressionToResponse` — level-up por XP (motor), não pela IA  
5. `progressionFeed` / `levelUpState` só quando o **motor** detecta subida de nível  

Campos típicos na resposta HTTP/WS:

| Campo | Origem |
|-------|--------|
| `logEntries`, `actionOptions` | IA |
| `playerRollRequest` | **Motor** (dados 3D) |
| `combatState` | Motor (projetado do encontro) |
| `updatedCharacter` | Motor / persistência — **não** da IA em narration_only |
| `levelUpState` | Motor (`progressionMotorService`) |
| `progressionFeed` | Motor + narrativa de XP |

---

## Fluxos por sistema

### Rolagem

1. Intent ou classificador → `validateSkillCheck` / ataque  
2. `needs_roll` → `playerRollRequest` → **DiceRollModal 3D**  
3. `submitRollResult` → motor aplica CD → `narrateAfterPlayerRoll` → IA narra sucesso/falha  

### Combate

- Iniciativa, dano, condições: motor (`combatStateService`)  
- IA: descreve o beat; `combatState` no prompt é leitura  

### Inventário / loot / loja

- Intents: `equip-item`, `drop-item`, `claim-loot`, etc.  
- IA: descreve vitrine, peso, sensação — compra/equipar na UI  

### Magias

- Lançar/consumir: intents + ficha  
- IA não gasta slots  

### Homebrew

- `useAiHomebrew`: IA pode **mencionar** homebrew instalado; criação persistente via fluxo homebrew, não JSON do turno  

### Level-up

- XP e nível: tabela D&D em `progressionMotorService`
- `levelUpState.isPending` abre `LevelUpModal` — jogador confirma HP/escolhas na ficha
- IA só narra o marco depois  

### Combate (entrar / sair)

| Evento | Quem decide |
|--------|-------------|
| **Entrar** | Primeiro `combatState.isActive=true` válido do cliente é persistido via `reconcileCombatStateUpdate` (bootstrap) |
| **Durante** | Motor aplica dano por rolagens/intents; cliente pode enviar **apenas redução** de PV em hostis (`mergeClientHostileHpHints`) |
| **Sair** | Motor: nenhum hostil com PV>0 **ou** jogador derrotado (`evaluateCombatAutoEnd`) |
| **Pós-vitória** | `awardMotorXpToCharacter` + `stageMotorLootOffer` (claim-loot na ficha) |

A IA **não** altera `combatState` em `narration_only`.

### Loot

- Pendente em `sessoes_ia.pendingLootOffer`
- Coleta: intent `claim-loot` → `inventoryMotorService`
- Ao fim de combate: loot gerado pelo motor, não pela IA

### Loja

- Catálogo em `character.worldState.motorShopState` (`shopMotorService`)
- Bloqueada com `combatState.isActive`
- Intents: `open-shop`, `buy-item`, `sell-item`, `close-shop` (UI: `ShopModal` + `motorIntents.ts`)

### Missões e encontros

- `quest-complete` — XP pela tabela de nível (`questMotorService`)
- `start-encounter` — inicia combate persistido (`startEncounterService`)

---

## Variáveis de ambiente

```bash
AI_PIPELINE_MODE=narration_only   # obrigatório para produção
DM_AUTO_ROLL=false                # dados 3D no cliente
DM_CLASSIFY_FREE_ACTION=true
DM_LLM_CLASSIFY=true
```

---

## Arquivos de referência

| Arquivo | Função |
|---------|--------|
| `backend/src/ai/narrativeContract.ts` | Contrato + limpeza de saída |
| `backend/src/ai/instructions.ts` | System instruction por modo |
| `backend/src/ai/promptAssembler.ts` | Montagem do user prompt |
| `backend/src/schemas/gameSchemas.ts` | Zod `NarrativePhaseResponseSchema` |
| `backend/src/narration/motorStateBridge.ts` | Strip de campos do motor |
| `backend/src/narration/phaseOrchestrator.ts` | Só fase narrativa em narration_only |
| `backend/src/services/progressionMotorService.ts` | Level-up por XP |
| `backend/src/services/dm/dmTurnOrchestrator.ts` | Fluxo mestre + pós-rolagem |

---

## Anti-padrões (causavam “jogo quebrado”)

1. System instruction pedia `GameMasterResponse` completo + `regrasCombate` pedindo `playerRollRequest` da IA  
2. Modelos free injetavam `_meta`, `updatedCharacter`, HP errado  
3. Sanitizer criava rolagens fantasmas ou IA pedia rolagem duplicada  
4. Level-up só via `updatedCharacter.level` da IA  
5. Jogador pedia “me dê 1000 de ouro” na prosa e o modelo obedecia no JSON  

Mitigações atuais: contrato narrativo, strip duplo, motor autoritativo, opções sanitizadas, level-up por XP no servidor.
