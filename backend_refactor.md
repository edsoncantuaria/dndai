# Como o Backend foi Melhorado: Mais Inteligente, Resiliente e Eficiente

Este documento detalha as melhorias cruciais implementadas no backend para resolver problemas de instabilidade, melhorar a lógica do jogo e otimizar o desempenho.

## Antes: Uma Arquitetura Frágil

O sistema original sofria de vários problemas:

1.  **Confiança Cega na IA:** O backend aceitava a resposta da IA sem questionar. Se a IA retornasse um JSON mal formatado, com campos faltando (como `actionOptions`) ou com dados em um formato inesperado (como um array de caracteres em vez de um objeto), o sistema quebrava. Isso causava erros de validação Zod, crashes e uma péssima experiência de usuário.

2.  **Lógica de Jogo Implícita:** As "regras" para a IA eram muito vagas. Não havia uma instrução clara sobre *quando* solicitar uma rolagem de dados. Isso levava a IA a pedir rolagens para ações triviais ou, pior, a não pedir rolagens para ações que claramente exigiam uma, quebrando a mecânica principal do jogo.

3.  **Uso Ineficiente de Tokens:** Em cada turno, o backend enviava o JSON completo de *todo* o conteúdo homebrew "instalado" para a IA. Com apenas alguns itens customizados, isso já aumentava drasticamente o tamanho do prompt, arriscando estourar o limite de tokens da IA e aumentando os custos de cada chamada.

## Depois: Uma Arquitetura Robusta e Inteligente

As melhorias foram focadas em tornar o backend mais defensivo, explícito e eficiente.

### 1. Validação e Auto-Reparo da Resposta da IA

**Como Está Agora:**
No arquivo `backend/src/services/aiService.ts`, a resposta da IA passa por um processo rigoroso de validação e, se necessário, auto-reparo.

1.  **Validação com Zod:** A resposta é imediatamente validada contra o `GameMasterResponseSchema`.
2.  **Primeira Falha (Erro de Formato):** Se a resposta não for um JSON válido, em vez de quebrar, o serviço faz uma **segunda chamada** para a IA com uma instrução de correção: *"Sua resposta anterior não era um JSON válido. Por favor, corrija o formato."*
3.  **Segunda Falha (Falta de Opções):** Se a resposta for um JSON válido, mas faltarem as cruciais `actionOptions` (deixando o jogador preso), o serviço faz uma **chamada de auto-reparo**: *"A aventura não pode parar. Forneça 2-4 opções de ação para o jogador..."*. Essa nova resposta com as opções é então mesclada com a resposta original.

**Por que Melhorou?**
O sistema não é mais passivo. Ele ativamente se defende contra as "alucinações" da IA. Isso reduz drasticamente a chance de o jogo travar ou apresentar erros, criando uma experiência muito mais estável e fluida.

### 2. "Senso de Justiça" Explícito para a IA

**Como Está Agora:**
O principal arquivo de prompt da IA, `backend/src/game/prompts/regrasBase.ts`, foi atualizado com uma regra explícita e imutável sobre rolagens de dados, apelidada de **"O Senso de Justiça"**.

-   **Instrução Clara:** A IA é instruída a **NÃO** pedir rolagens para ações triviais (como examinar um item) e a **SEMPRE** pedir rolagens para ações desafiadoras com consequências interessantes para a falha.
-   **Fluxo de Dano Detalhado:** Em `regrasCombate.ts`, o fluxo de combate agora detalha o ciclo obrigatório: **Intenção do Jogador -> Pedido de Rolagem de Ataque -> (se acertar) -> Pedido de Rolagem de DANO -> Narração Final**. Isso força a IA a nunca rolar o dano pelo jogador, preservando a mecânica central do jogo.

**Por que Melhorou?**
O comportamento da IA torna-se mais previsível e alinhado com as regras de um RPG de mesa. O jogo se sente mais "justo" e mecânico, evitando interrupções na imersão causadas por rolagens desnecessárias ou pela IA "roubando" o momento do jogador de rolar seu próprio dano.

### 3. Otimização Radical do Conteúdo Homebrew

**Como Está Agora:**
A lógica de preparação de dados em `backend/src/services/narrarService.ts` foi completamente alterada.

-   **Envio de Resumos, Não de Dados Completos:** Em vez de enviar o JSON completo de cada item homebrew, o backend agora envia para a IA apenas um resumo contendo o **nome** e o **tipo** de cada item (ex: `{ "name": "(H) Espada Vorpal", "type": "item" }`).

**Por que Melhorou?**
Essa é uma otimização massiva. O tamanho do prompt enviado para a IA é drasticamente reduzido. Isso:
-   **Economiza Tokens:** Reduz o custo de cada chamada à API da IA.
-   **Evita Erros de Limite:** Impede que o jogo quebre quando o jogador tiver uma grande coleção de conteúdo homebrew.
-   **Mantém o Contexto:** A IA ainda sabe quais itens customizados estão disponíveis e pode referenciá-los pelo nome, sem precisar de todos os detalhes técnicos em cada turno.

Em suma, essas três melhorias transformaram o backend de um simples intermediário para um verdadeiro **orquestrador inteligente**, que valida, corrige, instrui e otimiza a comunicação com a IA, resultando em um jogo mais estável, justo e escalável.
