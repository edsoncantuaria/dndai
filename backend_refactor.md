
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
    *   Ajustar `package.json` com as dependências: `express`, `dotenv`, `typeorm`, `mysql2`, `@google/generative-ai`, `genkit`.
    *   Criar `tsconfig.json` para o projeto TypeScript.
    *   Criar `.env.example` com as variáveis de ambiente necessárias (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PORT`).

*   **[X] Implementar Camada de Dados com TypeORM**:
    *   Criar `data-source.ts` para a configuração da conexão com o MySQL.
    *   Definir as entidades `SessaoIA` e `SessionLog` em `src/entities/`.
        *   `SessaoIA`: `id`, `nome`, `apiKey`, `createdAt`, `updatedAt`.
        *   `SessionLog`: `id`, `sessionId`, `prompt`, `response`, `timestamp`.

*   **[X] Criar Endpoints CRUD para Sessões**:
    *   Definir rotas em `src/routes/` e lógica nos `src/controllers/` para:
        *   `POST /api/sessoes`: Criar uma nova sessão de jogo.
        *   `GET /api/sessoes/:id`: Obter detalhes de uma sessão (incluindo seus logs).
        *   `PUT /api/sessoes/:id`: Atualizar uma sessão (ex: mudar o nome ou a chave).
        *   `DELETE /api/sessoes/:id`: Deletar uma sessão.

### **Fase 2.2: Integração com Genkit e Narração (Concluído)**

*   **[X] Criar `aiService.ts`**:
    *   Implementar um `Map` para cachear as instâncias de Genkit.
    *   Criar uma função `getOrCreateAiInstance(sessionId, apiKey)` que:
        1.  Verifica se uma instância para o `sessionId` já existe no cache.
        2.  Se sim, a retorna.
        3.  Se não, cria uma nova instância do Genkit usando a `apiKey` fornecida, a armazena no cache com a `sessionId` como chave e a retorna.

*   **[X] Implementar o Endpoint de Narração**:
    *   Criar `narrarController.ts` e `narrarRoutes.ts`.
    *   O endpoint `POST /api/narrar/:sessionId` deverá:
        1.  Receber o `prompt` do jogador no corpo da requisição.
        2.  Usar o `sessionId` para obter os dados da sessão do banco (incluindo a `apiKey`).
        3.  Chamar `aiService.getOrCreateAiInstance()` para obter a instância correta do Genkit.
        4.  Executar o prompt na instância de Genkit para obter a `response`.
        5.  Salvar o `prompt` e a `response` na tabela `session_logs`.
        6.  Retornar a `response` para o frontend.

### **Fase 2.3: Testes e Documentação Final (Em Andamento)**

*   **[X] Atualizar `README.md` do Backend**: Instruções detalhadas sobre como rodar o servidor e usar a API.
*   **[X] Testar Endpoints via `curl`**: Adicionar exemplos práticos para testar a criação de sessão e o fluxo de narração.
*   **[ ] Tratamento de Erros Aprimorado**: Garantir que todos os endpoints tenham um tratamento de erro robusto e mensagens claras.

---

## Testando a API (Fase 2.1 e 2.2)

Você pode usar `curl` ou uma ferramenta como Postman/Insomnia para testar os endpoints. **Lembre-se de substituir `seu_token_jwt_aqui` por um token válido obtido no login.**

#### **1. Criar uma nova sessão de jogo (`POST /api/sessoes`)**

```bash
curl -X POST http://localhost:8071/api/sessoes \
-H "Content-Type: application/json" \
-H "Authorization: Bearer seu_token_jwt_aqui" \
-d '{
  "nome": "A Caverna do Dragão Esquecido",
  "apiKey": "SUA_CHAVE_DE_API_DO_GOOGLE_AI"
}'
```
**Resposta Esperada:**
```json
{
    "message": "Sessão criada com sucesso!",
    "sessao": {
        "nome": "A Caverna do Dragão Esquecido",
        "apiKey": "SUA_CHAVE_DE_API_DO_GOOGLE_AI",
        "userId": 1,
        "logs": [],
        "id": 1,
        "createdAt": "...",
        "updatedAt": "..."
    }
}
```
> Anote o `"id"` da sessão criada (ex: `1`).

#### **2. Enviar um prompt para a IA narrar (`POST /api/narrar/:sessionId`)**

Use o `id` da sessão da etapa anterior.

```bash
# Substitua :sessionId pelo seu ID (ex: 1)
curl -X POST http://localhost:8071/api/narrar/1 \
-H "Content-Type: application/json" \
-H "Authorization: Bearer seu_token_jwt_aqui" \
-d '{
  "prompt": "Eu entro na taverna com uma cara amarrada, sento no balcão e peço a bebida mais forte que tiverem."
}'
```
**Resposta Esperada:**
```json
{
    "response": "O taverneiro, um homem corpulento com um olho de vidro, te encara por um instante antes de pegar uma garrafa escura de debaixo do balcão. Ele serve um líquido âmbar em um copo sujo e o desliza em sua direção. 'Por sua conta e risco, forasteiro', ele resmunga. O cheiro de álcool forte e algo vagamente medicinal preenche o ar. O que você faz?"
}
```

#### **3. Obter detalhes da sessão (com logs) (`GET /api/sessoes/:id`)**
```bash
# Substitua :id pelo seu ID de sessão
curl -X GET http://localhost:8071/api/sessoes/1 \
-H "Authorization: Bearer seu_token_jwt_aqui"
```

#### **4. Deletar a sessão (`DELETE /api/sessoes/:id`)**
```bash
# Substitua :id pelo seu ID de sessão
curl -X DELETE http://localhost:8071/api/sessoes/1 \
-H "Authorization: Bearer seu_token_jwt_aqui"
```

---

Ao concluir este plano, teremos um backend totalmente funcional, desacoplado e pronto para ser a base da experiência multiplayer do "Crônicas de Aventuras".
