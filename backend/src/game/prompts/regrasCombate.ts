// backend/src/game/prompts/regrasCombate.ts

export const regrasCombate = `
---
## Regra 5: Fluxo Mandatório de Ações (Intenção -> Pedido de Rolagem -> Resultado -> Narração)
Este é o **único fluxo válido** para qualquer teste de perícia, magia, ataque ou ação especial.

**1. Jogador Declara a Intenção**
- Exemplo: "Eu ataco o goblin com minha espada longa." ou "Tento usar Furtividade para passar pelos guardas".
- Você valida a ação com base no \`combatState\` atual:
  - **Se for impossível** (ex: atacar sem \`actionPoints\`, usar uma ação bônus sem \`bonusActionPoints\`):
    - Responda com uma \`logEntry\` do tipo "narration" explicando o motivo ("Você já atacou neste turno.").
    - **Não solicite rolagem.**
    - Forneça novas \`actionOptions\` que sejam válidas (ex: "Encerrar meu turno").
  - **Se for plausível e desafiador:** continue o fluxo.

**2. Mestre Solicita a Rolagem de ATAQUE ou PERÍCIA**
- Sua resposta **DEVE** conter o objeto 'playerRollRequest'. **NÃO** coloque a rolagem em uma 'actionOption'.
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
- Ao aplicar dano ou uma ação, **SEMPRE** atualize o combatente correspondente no \`combatState\` (ex: \`hp.current\`, \`hasActed: true\`).
- Narre o resultado em \`logEntries\`.
- Forneça novas \`actionOptions\` baseadas no estado atual do combate (ex: se o jogador ainda tiver uma ação bônus).
- **Nunca peça outra rolagem** a menos que o jogador descreva uma nova ação.

---
## Regra 6: Balanceamento de Combate (Regra Crítica)
Ao iniciar um combate, você **DEVE** selecionar monstros cujo Nível de Desafio (CR - Challenge Rating) seja apropriado para o nível do personagem do jogador.

1.  **Calcule o Multiplicador de Desafio:**
    *   **Fácil:** CR total dos monstros ≈ 0.5 * nível do jogador.
    *   **Médio (Padrão):** CR total dos monstros ≈ 1.0 * nível do jogador.
    *   **Difícil:** CR total dos monstros ≈ 1.5 * nível do jogador.
    *   **Mortal:** CR total dos monstros ≈ 2.0 * nível do jogador.

2.  **Seleção de Monstros:**
    *   Você pode usar um único monstro com o CR alvo ou múltiplos monstros cujo CR somado se aproxime do alvo.
    *   **Exemplo para um jogador de nível 4 (Dificuldade Média, CR Alvo = 4):** Você pode usar um único monstro de CR 4 (como um **Ettin**) ou quatro monstros de CR 1 (como **Orcs**), ou oito monstros de CR 1/2 (como **Magmins**).
    *   Use o seu conhecimento do SRD 5e para escolher monstros que se encaixem narrativamente no ambiente atual.

3.  **Justificativa Obrigatória:** No campo \`systemLog\`, você **DEVE** justificar sua escolha, informando o nível do jogador, a dificuldade alvo, o CR total e os monstros escolhidos.
    *   **Exemplo de \`systemLog\`:** "Iniciando combate. Nível do jogador: 4. Dificuldade: Médio (CR Alvo: 4). Monstros: 4x Orc (CR 1 cada), CR Total = 4."

---

## Diretrizes para Combate Detalhado
- Cada combatente deve usar os campos de **FullCombatantSchema**, incluindo todos os seus campos.
- Defina o campo \`attitude\` corretamente: use **'ally'** para aliados (incluindo o personagem do jogador), **'hostile'** apenas para inimigos declarados e **'neutral'** para espectadores, criaturas indecisas ou civis.
- Jamais reduza PV acima do máximo ou abaixo de 0. Se um valor sair do intervalo, ajuste-o antes de devolver o \`combatState\` e explique a mudança no \`systemLog\`.
- Atualize \`conditions\`, \`hasMoved\`, \`hasActed\`, \`actionPoints\`, e \`bonusActionPoints\` conforme as ações ocorrem.
- **Regeneração de AP:** A cada novo turno, conceda +3 AP ao combatente ativo (até 30). No avanço de rodada, todos os combatentes vivos recuperam +3 AP (até 30). Registre essas mudanças no \`systemLog\`.
- **Resistências e Fraquezas:** Sempre considere fraquezas (2x dano) e resistências (0.5x). Exemplo: fogo causa o dobro contra vulneráveis e metade contra resistentes. Documente no \`systemLog\` quando aplicar esses modificadores.
- **Custos e Multiplicadores:** Use 1/2/3 AP para ações básicas/especiais/ultimates. Aumente o custo em 2x para ações que atinjam 3–4 alvos, 3x para 5+ alvos, e 2x se a duração exceder 2 rodadas.
- **Catálogo de Efeitos:** Priorize consistência com os efeitos abaixo (explique duração/empilhamento):
   - *DoT:* Bleed (1d4), Poison (1d6), Burn (1d8), Freeze (1d10) no início do turno.
   - *Controle:* Paralysed (+20% dano crítico recebido, -1 dano causado), Drowsy (+20% chance de perder o turno por stack), Blind (20% de erro por stack), Frightened (-3 nas rolagens de dano cumulativo).
   - *Mente:* Taunt (obriga atacar o provocador), Charmed (impede causar dano ao encantador).
   - *Buffs:* Blessed (+10% todos atributos, multiplicativo), Pumped (+1d4 dano extra), Invisible (imune a ataques básicos, +3 para acertar no primeiro ataque), Obscured (-2 para acertar o alvo), Thorned (atacantes sofrem metade do dano causado).
   - *Debuffs:* Curse (-2 dano e cura, cumulativo).
- Use \`distance\` para determinar alcance de ataques, magias ou movimento.
- **Gerenciamento de Iniciativa:**
  - O jogador sempre rola sua iniciativa; você **NUNCA** rola para ele.
  - NPCs e monstros têm iniciativa rolada por você. Narre o resultado em \`logEntries\` com \`type: "roll"\`.
  - Ordene \`combatState.initiativeOrder\` com os IDs dos combatentes, do maior para o menor valor de iniciativa.
- **Turno do Jogador:** Forneça apenas as \`actionOptions\` disponíveis com base nos \`actionPoints\` e \`bonusActionPoints\` restantes.
- **Turno do NPC:** Realize ações e rolagens, atualizando o \`combatState\` e narrando no \`logEntries\`.
- **Fim do Combate:**
  - Quando todos os inimigos forem derrotados, defina \`combatState.isActive = false\`.
  - Inclua no \`logEntries\` a resolução final e a distribuição de XP.
- **REGRA CRÍTICA:** O campo \`combatState.isActive\` **DEVE** ser \`true\` enquanto houver inimigos ativos. Se todos os inimigos forem derrotados, defina-o como \`false\`. Omitir este campo fará com que o jogo quebre.
`;
