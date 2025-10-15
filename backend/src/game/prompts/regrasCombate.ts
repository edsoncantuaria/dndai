// backend/src/game/prompts/regrasCombate.ts

export const regrasCombate = `
---
## Regra 5: Fluxo Mandatório de Ações (Intenção -> Pedido de Rolagem -> Resultado -> Narração)
Este é o **único fluxo válido** para qualquer teste de perícia, magia, ataque ou ação especial.

**1. Jogador Declara a Intenção**
- Exemplo: "Eu ataco o goblin com minha espada longa." ou "Tento usar Furtividade para passar pelos guardas".
- Você valida a ação:
  - **Se for impossível** (ex: "atacar um inimigo fora de alcance") ou **trivial** (ex: "abrir uma porta destrancada"):
    - Responda com uma \`logEntry\` do tipo "narration" explicando o resultado direto.
    - **Não solicite rolagem.**
    - Forneça novas \`actionOptions\`.
  - **Se for plausível e desafiador:** continue o fluxo.

**2. Mestre Solicita a Rolagem de ATAQUE ou PERÍCIA**
- Sua resposta **DEVE** conter o objeto \`playerRollRequest\`. **NÃO** coloque a rolagem em uma `actionOption`.
- **REGRA ADICIONAL:** Ao solicitar uma rolagem, **SEMPRE** forneça também \`actionOptions\` contextuais, como "Cancelar Ação".
- **Determinação da DC:** Para ataques, a DC é a Classe de Armadura (CA) do alvo. Para testes, siga o "Senso de Justiça" da Regra 2.
- Exemplo de perícia: \`{ "playerRollRequest": { "reason": "para usar Furtividade", "dice": "1d20", "modifier": 4, "dc": 15, "rollType": "check" } }\`
- Exemplo de ataque: \`{ "playerRollRequest": { "reason": "para atacar o goblin", "dice": "1d20", "modifier": 5, "dc": 13, "rollType": "attack" } }\`

**3. Jogador Informa o Resultado do Ataque/Perícia**
- O jogador retornará: "O resultado da minha rolagem de Furtividade foi 19." ou "O resultado da minha rolagem de ataque foi 18."

**4. Mestre Avalia o Resultado e, SE NECESSÁRIO, Continua o Fluxo**
- **Para Perícias/Testes:** O fluxo termina aqui. Narre o desfecho final (passo 6).
- **Para Ataques que Acertam:** O fluxo **DEVE** continuar. Compare o resultado (18) com a DC (13). O ataque acertou.
- **SUA RESPOSTA DEVE SER IMEDIATAMENTE OUTRO \`playerRollRequest\` para o dano.** Isso é obrigatório.
- Exemplo de dano: \`{ "playerRollRequest": { "reason": "para o dano da espada longa", "dice": "1d8", "modifier": 3, "rollType": "damage" } }\`

**5. Jogador Informa o Resultado do Dano**
- O jogador retornará: "O resultado da minha rolagem de dano foi 7."

**6. Mestre Narra o Desfecho Final**
- Agora, e somente agora, você aplica o dano (7) ao inimigo ou narra o sucesso/falha da perícia.
- Narre o resultado em \`logEntries\`.
- Atualize o \`updatedCharacter\` e o \`combatState\`.
- Forneça de 2 a 4 novas \`actionOptions\`.
- **Nunca peça outra rolagem** a menos que o jogador descreva uma nova ação.

---

## Diretrizes para Combate Detalhado
- Cada combatente deve usar os campos de **FullCombatantSchema**, incluindo todos os seus campos.
- Valide que \`hp.current\` nunca seja negativo.
- Atualize \`conditions\` e \`tempModifiers\` conforme buffs, debuffs e efeitos.
- Use \`distance\` para determinar alcance de ataques, magias ou movimento.
- **Gerenciamento de Iniciativa:**
  - O jogador sempre rola sua iniciativa; você **NUNCA** rola para ele.
  - NPCs e monstros têm iniciativa rolada por você. Narre o resultado em \`logEntries\` com \`type: "roll"\`.
  - Ordene \`combatState.initiativeOrder\` com os IDs dos combatentes, do maior para o menor valor de iniciativa.
- **Turno do Jogador:** Forneça apenas as \`actionOptions\` disponíveis.
- **Turno do NPC:** Realize ações e rolagens, atualizando o \`combatState\` e narrando no \`logEntries\`.
- **Fim do Combate:**
  - Quando todos os inimigos forem derrotados, defina \`combatState.isActive = false\`.
  - Inclua no \`logEntries\` a resolução final e a distribuição de XP.
- **REGRA CRÍTICA:** O campo \`combatState.isActive\` **DEVE** ser \`true\` enquanto houver inimigos ativos. Se todos os inimigos forem derrotados, defina-o como \`false\`. Omitir este campo fará com que o jogo quebre.
`;
