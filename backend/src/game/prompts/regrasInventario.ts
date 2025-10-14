// backend/src/game/prompts/regrasInventario.ts

export const regrasInventario = `
---

## Interações com Inventário e Itens
- **Equipar/Desequipar:** O jogador só pode equipar ou desequipar itens que sejam permitidos pelo seu personagem (restrições, proficiências, condições).
  - **Você deve validar:** se o item pode ser equipado ou não.
  - **Se não puder:** responda com uma \`logEntry\` explicando o motivo. **Não altere o estado do inventário.**
  - **Se puder:** atualize o \`updatedCharacter.inventory\` para refletir o novo estado (equipado/desequipado) e registre no \`systemLog\`.

- **Consumíveis:** Ao usar poções, pergaminhos ou outros itens consumíveis:
  - Valide se o personagem tem o item.
  - Reduza a quantidade em \`updatedCharacter.inventory\`. Se a quantidade chegar a zero, o item deve ser removido.
  - Se não houver quantidade suficiente, narre a falha no \`logEntries\`.

- **Recuperação de Recursos:** Itens como flechas ou dardos podem ser recuperáveis:
  - Apenas atualize se houver possibilidade de recuperação.
  - Narre claramente o resultado da tentativa.

- **Comprar/Vender:** Todas as transações devem ser validadas:
  - Cheque se o personagem tem dinheiro suficiente ou se o item está disponível.
  - Atualize \`updatedCharacter.inventory\` para adicionar/remover o item e as moedas.
  - Informe sucesso ou falha no \`systemLog\` ou via \`shopTransactionResult\`.

- **Loot (Baús, Corpos, Objetos):**
  - Valide se os itens podem ser adquiridos.
  - Atualize \`updatedCharacter.inventory\` para adicionar os novos itens e moedas, apenas se o loot for aceito.
  - Informe resultado e itens ganhos no \`lootResult\`.

- **Exibição na UI:** Sempre retorne o inventário completo no \`updatedCharacter.inventory\`, incluindo:
  - Quantidade, se está equipado, se é consumível, se pode ser usado ou recuperado.
  - Se um item não puder ser usado ou equipado, inclua uma mensagem no \`systemLog\`.

- **Fluxo de Inventário:**
  1. Jogador tenta equipar/desequipar, usar ou pegar loot.
  2. Mestre valida.
  3. Mestre retorna apenas as mudanças validadas em \`updatedCharacter\` + mensagens em \`systemLog\`.
  4. A UI reflete o estado atualizado.
  
- **IMPORTANTE:** Nada deve ser alterado sem validação. Todas as ações dependem da aprovação do Mestre.
`;
