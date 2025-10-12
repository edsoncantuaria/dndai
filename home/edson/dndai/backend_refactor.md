# Refatoração do Backend: Rumo a uma Plataforma de RPG com Múltiplas Sessões

* **Objetivo:** Substituir a lógica de jogo do frontend por um backend Node.js robusto. Este backend gerenciará múltiplas sessões de jogo, cada uma com sua própria instância de IA (Genkit/Gemini) e persistência de dados em um banco de dados MySQL, utilizando TypeORM.

Este documento servirá como nosso guia mestre para a Fase 2 da migração do backend.

---

## **Visão Geral da Arquitetura**

O novo backend será uma API RESTful construída com Express.js, responsável por:

1.  **Gerenciamento de Sessões**: Um endpoint para criar, recuperar, atualizar e deletar sessões de jogo (`SessaoIA`). Cada sessão terá sua própria chave de API do Google Gemini, permitindo que os jogadores usem suas próprias credenciais.
2.  **Orquestração da IA**: Um serviço dedicado (`aiService`) que cria e gerencia instâncias isoladas do Genkit para cada sessão. Isso garante que a IA de uma sessão não interfira com outra.
3.  **Cache de Instâncias**: Para evitar a sobrecarga de reinicializar o Genkit a cada requisição, as instâncias de IA serão mantidas em um cache in-memory (um `Map` simples).
4.  **Narração**: O endpoint principal `/api/narrar/:sessionId` receberá o prompt do jogador, encontrará a instância de IA correta (ou a criará), obterá a resposta e a retornará.
5.  **Persistência de Logs**: Todas as interações (prompts do jogador e respostas da IA) serão salvas em uma tabela `session_logs`, vinculada à sessão correspondente.
6.  **Segurança e Configuração**: As chaves de API serão armazenadas de forma segura (neste caso, no banco de dados, associadas a cada sessão) e a configuração geral será gerenciada por um arquivo `.env`.

### **Estrutura de Diretórios Planejada**

```
/backend
  /src
    /controllers       # Lógica de requisição/resposta (ex: narrarController.ts)
    /database          # Configuração do TypeORM (data-source.ts) e migrações
    /entities          # Modelos de dados do TypeORM (SessaoIA.ts, SessionLog.ts)
    /middlewares       # Middlewares customizados (ex: errorMiddleware.ts)
    /routes            # Definição dos endpoints da API (ex: narrarRoutes.ts)
    /services          # Lógica de negócios (ex: aiService.ts)
    /utils             # Funções utilitárias (opcional)
    server.ts          # Ponto de entrada do servidor Express
  .env.example         # Exemplo de arquivo de configuração
  package.json
  tsconfig.json
```

---

## **Fases da Implementação**

### **Fase 2.1: Estrutura e Gerenciamento de Sessões (Concluído)**

*   **[X] Configurar o Projeto Node.js**:
    *   Ajustado `package.json` com as dependências: `express`, `dotenv`, `typeorm`, `mysql2`, `@google/generative-ai`, `genkit`.
    *   Criado `tsconfig.json` para o projeto TypeScript.
    *   Criado `.env.example` com as variáveis de ambiente necessárias.

*   **[X] Implementar Camada de Dados com TypeORM**:
    *   Criado `data-source.ts` para a configuração da conexão com o MySQL.
    *   Definido as entidades `SessaoIA` e `SessionLog` em `src/entities/`, com relacionamentos adequados.
    *   Vinculado `SessaoIA` a um `User` para garantir propriedade.

*   **[X] Criar Endpoints CRUD para Sessões**:
    *   Definido rotas em `src/routes/sessoesRoutes.ts` e lógica nos `src/controllers/sessoesController.ts` para:
        *   `POST /api/sessoes`: Criar uma nova sessão de jogo para o usuário autenticado.
        *   `GET /api/sessoes`: Listar todas as sessões do usuário autenticado.
        *   `GET /api/sessoes/:id`: Obter detalhes de uma sessão específica.
        *   `DELETE /api/sessoes/:id`: Deletar uma sessão.

### **Fase 2.2: Integração com Genkit e Narração**

*   **[ ] Criar `aiService.ts`**:
    *   Implementar um `Map` para cachear as instâncias de Genkit.
    *   Criar uma função `getOrCreateAiInstance(sessionId, apiKey)` que:
        1.  Verifica se uma instância para o `sessionId` já existe no cache.
        2.  Se sim, a retorna.
        3.  Se não, cria uma nova instância do Genkit usando a `apiKey` fornecida, a armazena no cache com a `sessionId` como chave e a retorna.

*   **[ ] Implementar o Endpoint de Narração**:
    *   Criar `narrarController.ts` e `narrarRoutes.ts`.
    *   O endpoint `POST /api/narrar/:sessionId` deverá:
        1.  Receber o `prompt` do jogador no corpo da requisição.
        2.  Usar o `sessionId` para obter os dados da sessão do banco (incluindo a `apiKey`).
        3.  Chamar `aiService.getOrCreateAiInstance()` para obter a instância correta do Genkit.
        4.  Executar o prompt na instância de Genkit para obter a `response`.
        5.  Salvar o `prompt` e a `response` na tabela `session_logs`.
        6.  Retornar a `response` para o frontend.

### **Fase 2.3: Testes e Documentação Final**

*   **[ ] Atualizar README.md**:
    *   Adicionar instruções detalhadas de como clonar, instalar dependências, configurar o `.env` e rodar o servidor.
    *   Incluir exemplos de como usar o `curl` ou Postman para testar todos os endpoints (`/api/sessoes` e `/api/narrar/:sessionId`).
*   **[ ] Tratamento de Erros**: Garantir que todos os endpoints tenham um tratamento de erro robusto, retornando mensagens claras em caso de falha (ex: sessão não encontrada, chave de API inválida).

---

Ao concluir este plano, teremos um backend totalmente funcional, desacoplado e pronto para ser a base da experiência multiplayer do "Crônicas de Aventuras".
