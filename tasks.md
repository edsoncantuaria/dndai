# Próximas Tarefas e Melhorias para "Crônicas de Aventuras"

Este documento descreve os próximos grandes recursos e melhorias arquitetônicas planejadas para o projeto, com o objetivo de evoluir a plataforma.

**Nota sobre a Estrutura de Diretórios:**
- **Caminho do Frontend:** `/home/user/studio/`
- **Caminho do Backend:** `/home/user/studio/backend`

---

## ✅ TASK-1: Reestruturação da Plataforma Cliente-Servidor (Em Planejamento)

- **Problema:** O frontend atual ainda opera com muitas lógicas do design original (estado gerenciado no cliente, `localStorage`), o que o impede de aproveitar todo o potencial do novo backend (banco de dados persistente, gerenciamento de sessões, personagens reutilizáveis). A interface e o fluxo de dados não refletem a nova arquitetura de servidor.
- **Objetivo:** Refatorar completamente a aplicação frontend para se tornar um cliente puro do backend, onde o servidor é a única fonte da verdade para o estado do jogo. O backend também será aprimorado para ser mais robusto, seguro e testável. Isso resultará em uma experiência mais rápida, estável e escalável.
- **Solução Proposta:** Uma reestruturação faseada, componente por componente, para substituir a lógica local por chamadas de API e adotar melhores práticas de arquitetura em ambas as pontas da aplicação.

### Fase 1.1: Melhorias na Arquitetura do Backend

*   **[ ] Implementar Validação de Dados com Zod:**
    *   **Tarefa:** Em cada controller do backend (ex: `characterController.ts`), usar o Zod para criar schemas que validam o `req.body` de todas as requisições `POST` e `PUT`.
    *   **Justificativa:** Garante que dados malformados ou maliciosos nunca cheguem à nossa lógica de negócios ou ao banco de dados, tornando a API mais segura e previsível.

*   **[ ] Criar Camada de Serviço (Service Layer):**
    *   **Tarefa:** Criar novos serviços (ex: `characterService.ts`, `sessionService.ts`) na pasta `backend/src/services`. Mover a lógica de banco de dados (TypeORM) e as interações complexas dos controllers para esses serviços.
    *   **Justificativa:** Desacopla a lógica da API (Express) da lógica de negócios. Os controllers se tornam mais simples (apenas validam e chamam serviços), e a lógica principal pode ser reutilizada e testada de forma isolada.

*   **[ ] Adotar Logs Estruturados:**
    *   **Tarefa:** Substituir os `console.log` e `console.error` por uma biblioteca de logging estruturado (como `pino` ou `winston`), configurando-a para produzir saídas em JSON.
    *   **Justificativa:** Essencial para a depuração em um ambiente de produção. Permite filtrar e pesquisar logs por sessão, usuário, tipo de erro, etc., tornando a identificação de problemas muito mais eficiente.

### Fase 1.2: Refatoração do Gerenciamento de Estado no Frontend

*   **[ ] Adotar Ferramenta de Gerenciamento de Estado do Servidor:**
    *   **Tarefa:** Integrar uma biblioteca como `React Query` ou `SWR` ao projeto (adicionar ao `package.json`). Envolver o `_app.tsx` com o provider da biblioteca.
    *   **Justificativa:** Automatiza o cache, a revalidação e a sincronização dos dados do servidor, eliminando a necessidade de gerenciar manualmente estados de `isLoading` e `error` e tornando a UI mais rápida e responsiva.

*   **[ ] Criar um Contexto de Sessão Focado (`SessionContext`):**
    *   **Tarefa:** Criar um novo `SessionContext` que armazena apenas o `sessionId` ativo e o `characterId` associado. O antigo `GameStateContext` será descontinuado.
    *   **Justificativa:** Simplifica o estado global. Os componentes usarão o `sessionId` para buscar seus próprios dados de forma independente via React Query, melhorando a performance e a modularidade.

*   **[ ] Centralizar o Acesso à API (`apiClient.ts`):**
    *   **Tarefa:** Criar um único `apiClient.ts` que exporta uma instância configurada do `axios` ou um wrapper do `fetch`. Todos os serviços (`authService`, `gameService`) usarão este cliente.
    *   **Justificativa:** Centraliza a lógica de API, permitindo a fácil implementação de interceptadores para tratamento de erros (ex: token expirado, redirecionar para login) e adição automática de headers de autenticação em um único lugar.

### Fase 1.3: Reconstrução dos Componentes e Fluxos de UI

*   **[ ] Refatorar Menus e Navegação (`GameContainer`):**
    *   **Tarefa:** A tela principal passará a usar React Query para buscar e exibir a lista de sessões de jogo do usuário (`/api/sessoes`). O `GameContainer` deixará de gerenciar o estado do jogo.
    *   **Justificativa:** Alinha o fluxo inicial com a nova arquitetura, onde o servidor é a fonte da verdade.

*   **[ ] Implementar o "Cofre de Heróis":**
    *   **Tarefa:** Criar uma nova página/rota dedicada (`/characters`) que busca e exibe a lista de personagens do usuário (`/api/characters`). O fluxo de "Nova Aventura" levará para esta tela.
    *   **Justificativa:** Completa a visão de personagens reutilizáveis, uma das principais vantagens do novo backend.

*   **[ ] Adaptar Componentes de Jogo (Ficha, Inventário, etc.):**
    *   **Tarefa:** Modificar `CharacterSheet`, `Inventory`, `NewJournal`, etc., para que eles usem hooks do React Query para buscar seus dados específicos, baseando-se no `characterId` obtido do `SessionContext`. As ações do usuário (equipar, usar item) se tornarão "mutações" do React Query que chamam a API.
    *   **Justificativa:** Transforma os componentes em visualizadores de dados reativos e independentes.

### Fase 1.4: Otimização da Experiência de Jogo

*   **[ ] Implementar Streaming de Respostas via HTTP:**
    *   **Tarefa:** Modificar o `narrarController` no backend para usar a `streamGameMasterTurn` e enviar a resposta em pedaços (`res.write(chunk)`). No frontend, adaptar o `gameService` para ler esse stream de resposta com a `ReadableStream` API.
    *   **Justificativa:** Melhora drasticamente a percepção de velocidade. O jogador verá o texto da IA aparecendo em tempo real, em vez de esperar por uma resposta completa, aumentando a imersão.

*   **[ ] Dividir Componentes Grandes:**
    *   **Tarefa:** Analisar componentes complexos como `CharacterSheet` e `NewCharacterCreation` e dividi-los em subcomponentes menores e mais focados (ex: `AttributeDisplay`, `SkillsList`, `Stepper`).
    *   **Justificativa:** Melhora a legibilidade, a manutenção e a performance, permitindo que apenas as partes necessárias da UI sejam re-renderizadas.

---

## TASK-2: Streaming Avançado e Multiplayer (Pausado)

-   **Status:** Em espera. A reestruturação da TASK-1 é um pré-requisito.
-   **Sub-tarefas Planejadas:**
    *   **[ ]** Migrar a lógica de IA para uma Cloud Function para escalabilidade.
    *   **[ ]** Implementar um servidor WebSocket no backend Express.
    *   **[ ]** Criar sistema de salas de jogo (criação, entrada, saída).
    *   **[ ]** Sincronizar o estado do jogo entre múltiplos clientes via WebSockets.
    *   **[ ]** Adaptar a UI e o fluxo de turnos para uma experiência cooperativa.
---
