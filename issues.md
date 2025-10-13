# Histórico de Problemas e Soluções

Este arquivo rastreia os problemas relatados pelos usuários e as correções aplicadas.

---

### **ISSUE-1: Logs do histórico ficam em branco ao retomar um jogo salvo**

-   **Problema:** Ao carregar uma sessão de jogo existente, a tela de jogo era exibida, mas a área de logs da aventura permanecia vazia, perdendo todo o contexto da história para o jogador.
-   **Causa Raiz:** A função `loadGameSession` no hook `useNewGameState.ts` buscava corretamente os dados da sessão (incluindo o array de `logs`) do backend, mas nunca atualizava o estado `log` do React com esses dados. Ela limpava o estado antigo, mas não aplicava o novo.
-   **Correção (Aplicada):** A função `loadGameSession` foi modificada para, após uma busca bem-sucedida, chamar explicitamente `setLog(sessionDetails.logs)`. Isso garante que o histórico de logs do servidor seja carregado no estado do componente, exibindo corretamente a aventura ao jogador.

---

### **ISSUE-2: Inventário aparece vazio ao carregar um jogo**

-   **Problema:** Ao retomar uma aventura, o inventário do personagem era exibido como se estivesse vazio, embora os itens ainda existissem no banco de dados.
-   **Causa Raiz:** A função `buildFrontendCharacter` em `src/utils/characterUtils.ts`, responsável por converter os dados do personagem do backend para o formato utilizado pelo frontend, não estava mapeando corretamente os dados dos itens. A estrutura `itemData` não estava sendo mesclada ao objeto principal do item.
-   **Correção (Aplicada):** A lógica de mapeamento dentro de `buildFrontendCharacter` foi corrigida. Agora, ela extrai e mescla corretamente o `itemData` (que contém os detalhes completos do item) com as informações de quantidade e ID, garantindo que o `inventory` no estado do frontend seja populado com os dados completos e corretos de cada item.

---

### **ISSUE-3: Jogo não inicia automaticamente após criação de personagem ou ao continuar uma sessão**

-   **Problema:** Depois de criar um novo personagem e iniciar uma aventura, ou ao continuar uma sessão existente, o jogo ficava em uma tela de carregamento ou simplesmente não exibia a primeira narração do Mestre, exigindo uma ação manual do jogador para começar.
-   **Causa Raiz:** A lógica no componente `GameContainer.tsx` que deveria acionar o início da aventura (`startGame`) foi quebrada durante refatorações anteriores. A verificação para determinar se era uma sessão verdadeiramente nova (sem logs) e a chamada subsequente para `startGame` não estavam sendo executadas de forma consistente.
-   **Correção (Aplicada):** A função `handleNewGameFromVault` no `GameContainer.tsx` foi atualizada. Agora, após criar e carregar uma nova sessão, ela verifica explicitamente se o histórico de logs (`loadedData.logs`) está vazio. Se estiver, ela chama a função `startGame()` do hook `useNewGameState`, que por sua vez envia o prompt inicial para a IA, iniciando a aventura corretamente.
