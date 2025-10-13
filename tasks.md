# Próximas Tarefas e Melhorias para "Crônicas de Aventuras"

Este documento descreve os próximos grandes recursos e melhorias arquitetônicas planejadas para o projeto, com o objetivo de evoluir a plataforma.

**Nota sobre a Estrutura de Diretórios:**
- **Caminho do Frontend:** `/home/user/studio/`
- **Caminho do Backend:** `/home/user/studio/backend`

---

## TASK-1: Reestruturação Completa do Frontend para Integração com o Backend (Em Planejamento)

- **Problema:** O frontend atual ainda opera com muitas lógicas do design original (estado gerenciado no cliente, `localStorage`), o que o impede de aproveitar todo o potencial do novo backend (banco de dados persistente, gerenciamento de sessões, personagens reutilizáveis). A interface e o fluxo de dados não refletem a nova arquitetura de servidor.
- **Objetivo:** Refatorar completamente a aplicação frontend para se tornar um cliente puro do backend, onde o servidor é a única fonte da verdade para o estado do jogo. Isso resultará em uma experiência mais robusta, persistente e escalável.
- **Solução Proposta:** Uma reestruturação faseada, componente por componente, para substituir a lógica local por chamadas de API.

### Fases da Reestruturação do Frontend:

1.  **Fundação e Gerenciamento de Estado:**
    *   **Substituir `useGameState`:** Criar um novo contexto React (`GameSessionContext`) que não armazena o estado do jogo, mas sim gerencia a sessão ativa (`sessionId`, `characterId`) e fornece funções que interagem diretamente com o `gameService`.
    *   **Refatorar `gameService.ts`:** Garantir que todas as funções (obter personagem, enviar ação, etc.) estejam alinhadas com os endpoints do backend e tratem as respostas corretamente.

2.  **Revisão do Fluxo de Jogo (GameContainer e Menus):**
    *   **Tela de Sessões:** A tela principal (`GameContainer`) deve listar as sessões de jogo (`SessaoIA`) obtidas do backend, permitindo que o jogador continue uma aventura existente.
    *   **Cofre de Personagens:** Criar uma nova tela dedicada para visualizar os personagens (`Character`) associados à conta do usuário.
    *   **Fluxo "Nova Aventura":** O botão "Nova Aventura" levará o jogador ao "Cofre de Personagens" para escolher um herói. Iniciar uma aventura com um personagem criará uma nova sessão (`SessaoIA`) no backend, associada àquele personagem.

3.  **Componentes de Jogo (Ficha, Inventário, Diário):**
    *   **Ficha de Personagem (`CharacterSheet`):** Modificar o componente para exibir os dados do personagem (`character`) que agora vêm diretamente do objeto da sessão carregada, sem cálculos no frontend. As ações (como usar uma perícia) devem chamar o `gameService`.
    *   **Inventário (`Inventory`):** O inventário deve ser apenas uma visualização dos `items` do personagem no backend. Ações como "equipar" ou "usar" enviarão um `playerAction` para o backend, que retornará o estado atualizado do inventário.
    *   **Diário e Relacionamentos (`Journal`, `Relationships`):** Estes componentes passarão a renderizar os dados dos arrays `journal` e `relationships` do objeto de personagem, que são persistidos no banco de dados.

4.  **Combate e Ações:**
    *   **Tracker de Combate (`CombatTracker`):** O componente deve refletir fielmente o `combatState` recebido do backend a cada turno.
    *   **Opções de Ação (`ActionOptions`):** As ações do jogador (`processPlayerAction`) enviarão o `prompt` e o `combatState` atual para o backend. O frontend então aguardará a resposta completa do backend (novas `logEntries`, `updatedCharacter`, novo `combatState`, etc.) para re-renderizar a tela.

---

## TASK-2: Streaming de Respostas da IA via Cloud Function (Pausado)

-   **Status:** Esta tarefa está em espera até que a reestruturação completa do frontend (TASK-1) seja concluída.
-   **Problema:** Atualmente, o frontend espera que o backend processe toda a resposta do Genkit/Gemini antes de exibi-la. Em narrações longas, isso pode causar uma pausa perceptível (1-3 segundos), quebrando a imersão.
-   **Solução Proposta:**
    1.  **Refatorar a Lógica da IA:** Mover o `gameMasterFlow` do backend do Express para uma **Google Cloud Function** dedicada.
    2.  **Habilitar Streaming:** Configurar o fluxo no Genkit para que ele retorne a resposta da IA em tempo real, palavra por palavra (`stream`).
    3.  **Conexão Direta do Frontend:** Modificar o `gameService.ts` no frontend para chamar diretamente essa nova Cloud Function.
    4.  **Atualizar a UI:** Implementar a lógica no frontend para renderizar a resposta da IA à medida que os "pedaços" de texto chegam, criando um efeito de "digitação" em tempo real.

---

## TASK-3: Implementação de WebSockets para Modo Multiplayer (Pausado)

-   **Status:** Esta tarefa está em espera até que a reestruturação completa do frontend (TASK-1) seja concluída.
-   **Problema:** A arquitetura atual de requisição/resposta (HTTP) só funciona para um jogador. Não há como o servidor "empurrar" atualizações para múltiplos clientes simultaneamente, o que é um requisito para o multiplayer.
-   **Solução Proposta:**
    1.  **Adicionar Servidor WebSocket:** Integrar um servidor WebSocket (usando uma biblioteca como `ws`) ao backend Express.js existente.
    2.  **Gerenciamento de Salas:** Criar uma lógica no servidor para gerenciar "salas" de jogo. Os jogadores poderão criar, entrar e sair dessas salas.
    3.  **Sincronização de Estado:** Quando um jogador realizar uma ação, o backend processará, salvará no banco de dados e, em vez de responder apenas a um cliente, ele **transmitirá** a atualização de estado (nova narração, mudança no combate, etc.) via WebSocket para **todos os jogadores** conectados na mesma sala.
    4.  **Adaptar o Frontend:** O frontend precisará estabelecer e manter uma conexão WebSocket com o servidor e "ouvir" por essas atualizações para re-renderizar a interface em tempo real para todos os jogadores do grupo.

---
