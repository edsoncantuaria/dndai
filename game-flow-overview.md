# Visão Geral do Fluxo de Jogo em "Crônicas de Aventuras"

Este documento detalha o ciclo completo de uma interação no jogo, desde a ação do jogador até a atualização da interface, explicando como os dados fluem entre o frontend, o backend e a Inteligência Artificial.

## O Ciclo de Jogo: Passo a Passo

O jogo opera em um ciclo de requisição e resposta. Cada ação do jogador inicia um novo ciclo.

### 1. Ação do Jogador (Frontend - `ActionOptions.tsx`, `SkillItem.tsx`)

Tudo começa com você, o jogador.

-   **Ação Sugerida:** Você clica em um dos botões de ação (`actionOptions`) fornecidos pela IA.
-   **Ação de Perícia:** Você clica no botão "Usar" de uma perícia na sua ficha de personagem. Uma janela modal (`SkillCheckModal`) aparece para você descrever sua intenção.
-   **Ação Personalizada:** Você digita sua própria ação no campo de texto e clica em "Enviar".

Independentemente da origem, a ação é consolidada em uma **string de texto** (ex: "Eu ataco o goblin com minha espada" ou "Eu tento usar Furtividade para passar pelos guardas.") e enviada para a função `processPlayerAction` no hook `newUseGameState.ts`.

### 2. Preparação da Requisição (Frontend - `newUseGameState.ts`)

O hook `newUseGameState` prepara a chamada para o backend:

1.  A ação do jogador é adicionada ao log local com o tipo `action`, para que apareça imediatamente na tela.
2.  A função `GameService.processPlayerAction` é chamada, enviando:
    -   O `sessionId` da aventura atual.
    -   A `string` da ação do jogador (`prompt`).
    -   A sua `apiKey` do Google AI, que é obtida do `SettingsContext`.
    -   O `combatState` atual, se um combate estiver ativo.

### 3. Chamada de API para o Backend (Frontend -> Backend)

-   `gameService.ts` usa o `apiClient` para fazer uma requisição `POST` para o endpoint `/api/narrar/:sessionId` no servidor backend.
-   O token de autenticação (JWT) é automaticamente incluído nos headers para segurança.

### 4. Processamento no Backend (`narrarController.ts` -> `narrarService.ts`)

1.  **Controlador (`narrarController.ts`):** O controlador recebe a requisição, valida os dados (ID da sessão, prompt, etc.) e passa tudo para o serviço `narrarService`.

2.  **Serviço (`narrarService.ts`):** Esta é a principal orquestração no backend.
    -   Carrega os dados completos do personagem e da sessão do banco de dados (MySQL/TypeORM).
    -   Constrói um objeto otimizado para a IA, contendo o estado atual do personagem, histórico recente, estado do mundo e qualquer conteúdo homebrew instalado.
    -   Chama o `aiService.getGameUpdate` para se comunicar com a IA do Google.

### 5. Interação com a IA (`aiService.ts` e Prompts)

1.  **Formatação do Prompt:** O `aiService` pega os dados e os formata em um prompt detalhado para a IA, seguindo as regras definidas nos arquivos de prompt (`regrasBase.ts`, `regrasCombate.ts`, etc.). A regra mais importante é que a IA **SEMPRE** deve responder com um objeto JSON que siga um schema específico (`GameMasterResponseSchema`).

2.  **Chamada para a IA:** O serviço envia o prompt para o modelo Genkit configurado (ex: `gemini-2.5-flash`).

3.  **Resposta da IA:** A IA processa todo o contexto e a ação do jogador e retorna sua resposta, que pode ser uma narração, um pedido de rolagem de dados, ou ambos.

### 6. Saneamento e Persistência (Backend - `narrarService.ts`)

Esta é a etapa mais crítica para evitar os bugs que vimos anteriormente.

1.  **Prioridade Máxima: Pedido de Rolagem:** O serviço verifica **primeiro** se a resposta da IA contém um `playerRollRequest`.
    -   **Se sim:** A função **retorna imediatamente** para o frontend, enviando apenas o objeto `playerRollRequest` e as `actionOptions` (como "Cancelar Ação"). Nada mais é processado ou salvo. Isso garante que os pedidos de rolagem de dados nunca sejam perdidos.

2.  **"Saneamento" dos Logs:** Se não houver pedido de rolagem, o serviço "limpa" o campo `logEntries`:
    -   Ele garante que cada entrada seja um objeto válido. Se a IA retornar uma string JSON (ex: `"{\"type\":\"narration\"...}"`), ele faz o "parse" para o formato de objeto correto.
    -   Ele remove quaisquer tags HTML (`<p>`, `<b>`, etc.) do conteúdo da narração para garantir que apenas texto puro seja enviado.

3.  **Persistência no Banco de Dados:**
    -   **Logs de Narração:** O serviço percorre as `logEntries` saneadas e salva cada narração individualmente no banco, com seu tipo (`narration`, `insight`, etc.) e o conteúdo de texto limpo.
    -   **Log de Estado:** Em seguida, ele salva um **único log de estado** separado (`type: 'state'`), cujo conteúdo é o **objeto JSON completo e bruto** da resposta da IA (`GameMasterResponse`). É este log que será usado para restaurar o jogo.
    -   **Atualização do Personagem:** Se a resposta da IA contiver um `updatedCharacter`, o serviço atualiza as tabelas correspondentes do personagem no banco de dados.

### 7. Resposta para o Frontend (Backend -> Frontend)

-   O backend envia a `GameMasterResponse` completa e saneada de volta para o frontend.

### 8. Atualização da Interface (Frontend - `newUseGameState.ts`)

1.  **Recebimento da Resposta:** A função `handleApiResponse` no hook `newUseGameState` recebe os dados.
2.  **Atualização do Estado:**
    -   **Narração:** As `logEntries` (agora limpas) são adicionadas ao estado do log, e o componente `NewNarrativeLog` as renderiza na tela. O componente verifica o `type` de cada log:
        -   `action`: Mostra a ação do jogador com um ícone.
        -   `narration`: Mostra o parágrafo de texto da história, sem nenhum rótulo.
        -   `roll`: Renderiza uma caixa especial mostrando o resultado da rolagem.
        -   `system`, `insight`: Mostram mensagens de sistema ou pensamentos do personagem de forma estilizada.
    -   **Opções de Ação:** O estado `actionOptions` é atualizado, e os novos botões aparecem.
    -   **Rolagem de Dados:** Se um `playerRollRequest` foi recebido, o estado `playerRollRequest` é definido, o que aciona a exibição do `DiceRollModal`.
    -   **Outros Estados:** `combatState`, `levelUpState`, etc., são atualizados conforme necessário, fazendo com que seus respectivos componentes (como o `NewCombatTracker`) apareçam ou se atualizem.

### Fluxo de Restauração de Sessão

Ao clicar em "Continuar Aventura":

1.  `loadGameSession` busca **todos** os logs da sessão no backend.
2.  Ela filtra e exibe imediatamente todos os logs que **não** são do tipo `state`. É por isso que seu histórico de narração aparece corretamente.
3.  Ela encontra o **último** log do tipo `state`, faz o `JSON.parse` de seu conteúdo (que é a `GameMasterResponse` completa) e chama `handleApiResponse` com esses dados.
4.  `handleApiResponse` então restaura as `actionOptions` e todos os outros estados da UI, **pulando a adição de logs** para evitar duplicação.

Este fluxo garante que o jogo seja restaurado para o ponto exato em que foi deixado, de forma rápida e sem requisições desnecessárias à IA.
