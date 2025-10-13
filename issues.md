# Histórico de Problemas e Soluções

Este arquivo rastreia os problemas relatados pelos usuários e as correções aplicadas.

---

### **ISSUE-1: Logs do histórico ficam em branco ao retomar um jogo salvo**

-   **Problema:** Ao carregar uma sessão de jogo existente, a tela de jogo era exibida, mas a área de logs da aventura permanecia vazia, perdendo todo o contexto da história para o jogador.
-   **Causa Raiz:** A função `loadGameSession` no hook `useNewGameState.ts` buscava corretamente os dados da sessão (incluindo o array de `logs`) do backend, mas nunca atualizava o estado `log` do React com esses dados. Ela limpava o estado antigo, mas não aplicava o novo.
-   **Correção (Aplicada):** A função `loadGameSession` foi modificada para, após uma busca bem-sucedida, chamar explicitamente `setLog(sessionDetails.logs)`. Isso garante que o histórico de logs do servidor seja carregado no estado do componente, exibindo corretamente a aventura ao jogador.
