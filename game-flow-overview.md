# Visão Geral do Fluxo de Jogo em "Crônicas de Aventuras"

Este documento detalha o ciclo completo de uma interação no jogo, desde a ação do jogador até a atualização da interface, explicando como os dados fluem entre o frontend, o backend e a Inteligência Artificial.

## O Ciclo de Jogo: Passo a Passo

O jogo opera em um ciclo de requisição e resposta. Cada ação do jogador inicia um novo ciclo.

### 1. Ação do Jogador (Frontend)

Tudo começa com você, o jogador. A ação pode ser:

-   **Ação Sugerida:** Clicar em um dos botões de `actionOptions` (`ActionOptions.tsx`).
-   **Ação de Perícia:** Clicar em "Usar" em uma perícia na ficha (`SkillItem.tsx`), o que abre o `SkillCheckModal`.
-   **Ação Personalizada:** Digitar uma ação e enviar.

Independentemente da origem, a ação é consolidada em uma **string de texto** (ex: "Eu tento usar Furtividade para passar pelos guardas.") e enviada para a função `processPlayerAction` no hook orquestrador `newUseGameState.ts`.

**Exemplo de código (`SkillCheckModal.tsx` -> `newUseGameState.ts`):**
A função `handleSkillCheckSubmit` formula a ação: `Eu tento usar ${skillName}: ${description}` e chama `processPlayerAction`.

### 2. Preparação da Requisição (Frontend - `newUseGameState.ts`)

O hook `newUseGameState.ts` agora atua como um **orquestrador**:

1.  Ele chama `addLogEntry` do hook `useGameLog.ts` para exibir sua ação imediatamente na tela.
2.  Ele chama `GameService.processPlayerAction`, enviando o `sessionId`, a `string` da ação, sua `apiKey` e o `combatState` atual (gerenciado pelo `useInteractionManager.ts`).

### 3. Chamada de API para o Backend (Frontend -> Backend)

-   `gameService.ts` faz uma requisição `POST` para o endpoint `/api/narrar/:sessionId` no servidor backend.
-   O token de autenticação (JWT) é incluído para segurança.

### 4. Processamento no Backend (`narrarController.ts` -> `narrarService.ts`)

1.  **Controlador (`narrarController.ts`):** Valida os dados da requisição e os repassa.
2.  **Serviço (`narrarService.ts`):** O cérebro do backend.
    -   Carrega os dados completos do personagem e da sessão do banco de dados.
    -   Constrói um objeto otimizado para a IA, contendo apenas as informações essenciais para economizar tokens.
    -   Chama o `aiService.getGameUpdate` para se comunicar com a IA.

### 5. Interação com a IA (`aiService.ts` e Prompts)

1.  **Formatação do Prompt:** O `aiService` formata um prompt detalhado para a IA, seguindo as regras rigorosas definidas em `regrasBase.ts`, `regrasCombate.ts` e `regrasInventario.ts`. A regra mais importante é que a IA **SEMPRE** deve responder com um objeto JSON que siga o `GameMasterResponseSchema`.

2.  **Chamada e Validação:** A chamada para a IA é feita. Aqui entra a **primeira camada de blindagem**:
    *   Se a IA retornar um JSON malformado, o `aiService` faz uma **segunda chamada** pedindo para a IA corrigir o formato.
    *   Se o JSON for válido, mas faltar o campo crucial `actionOptions`, o serviço faz uma **chamada de auto-reparo** focada apenas em obter as opções de ação.

### 6. Saneamento e Persistência (Backend - `narrarService.ts`)

Esta é a etapa mais crítica para a estabilidade.

1.  **Prioridade Máxima: Pedido de Rolagem:** O serviço verifica **primeiro** se a resposta da IA contém um `playerRollRequest`.
    -   **Se sim:** A função **retorna imediatamente** para o frontend, enviando apenas o `playerRollRequest` e as `actionOptions` (como "Cancelar Ação"). Nada mais é processado ou salvo. Isso garante que os pedidos de rolagem de dados nunca sejam perdidos.

2.  **Saneamento dos Logs:** Se não houver pedido de rolagem, o serviço "limpa" o campo `logEntries`:
    *   Ele garante que cada entrada seja um objeto válido. Se a IA retornar uma string JSON (ex: `"{\"type\":\"narration\"...}"`), ele faz o "parse" para o formato de objeto correto.
    -   Ele remove quaisquer tags HTML (`<p>`, `<b>`, etc.) do conteúdo da narração para garantir que apenas texto puro seja enviado.

3.  **Persistência no Banco de Dados:**
    -   **Logs de Narração:** O serviço percorre as `logEntries` saneadas e salva cada narração individualmente no banco, com seu tipo (`narration`, `insight`, etc.) e o conteúdo de texto limpo.
    -   **Log de Estado:** Em seguida, ele salva um **único log de estado** separado (`type: 'state'`), cujo conteúdo é o **objeto JSON completo e bruto** da resposta da IA (`GameMasterResponse`). É este log que será usado para restaurar o jogo.
    -   **Atualização do Personagem:** Se a resposta da IA contiver um `updatedCharacter`, o serviço atualiza as tabelas correspondentes do personagem no banco de dados.

### 7. Resposta para o Frontend (Backend -> Frontend)

-   O backend envia a `GameMasterResponse` completa e saneada de volta para o frontend.

### 8. Atualização da Interface (Frontend)

1.  **Recebimento da Resposta (`newUseGameState.ts`):** A função `handleApiResponse` no hook orquestrador recebe os dados.
2.  **Distribuição do Estado:** O `newUseGameState` distribui os dados para os hooks especializados:
    *   `logState.addLogEntries` é chamado para adicionar as novas narrações ao log.
    *   `characterState.updateCharacter` é chamado para atualizar o personagem.
    *   `interactionState.setRequest({ type: 'roll', ... })` é chamado se houver um pedido de rolagem. Isso faz o `DiceRollModal` aparecer.
    *   `interactionState.setActionOptions` atualiza os botões de ação.
    *   Outros estados (`combatState`, `shopState`, etc.) são atualizados, fazendo com que seus respectivos componentes (como o `NewCombatTracker`) reajam.

### Fluxo de Restauração de Sessão

Ao clicar em "Continuar Aventura":

1.  `loadGameSession` busca **todos** os logs da sessão no backend.
2.  Ele filtra e exibe imediatamente todos os logs que **não** são do tipo `state` no `NewNarrativeLog`.
3.  Ele encontra o **último** log do tipo `state`, faz o `JSON.parse` de seu conteúdo (que é a `GameMasterResponse` completa) e chama `handleApiResponse` com esses dados.
4.  `handleApiResponse` então restaura as `actionOptions` e todos os outros estados da UI, **pulando a adição de logs** para evitar duplicação.

Este fluxo garante que o jogo seja restaurado para o ponto exato em que foi deixado, de forma rápida e sem requisições desnecessárias à IA.
