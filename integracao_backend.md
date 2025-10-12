
* **Objetivo:** mover toda a lógica do jogo para o backend, fazer o backend conversar com o Genkit/Google Gemini usando a API key criptografada do usuário, e enviar atualizações em tempo real ao frontend por WebSocket.

Sempre Atualizar integracao_backend.md com tudo que foi feito. Colocar testes e esperar retornar que todos os testes estão funcionando!

Usar o backend/README.md: Este novo arquivo fornecerá instruções passo a passo para configurar e iniciar o servidor backend, incluindo a configuração do banco de dados e as variáveis de ambiente.

Um backend, por mais funcional que seja, é inútil se o frontend não estiver preparado para se comunicar com ele. É crucial documentar o estado de ambos os lados para termos uma visão clara do progresso.

* **Componentes principais:**

  1. Backend HTTP (Express) — API REST (autenticação, gerenciamento de usuário, endpoints administrativos).
  2. WebSocket Server (no mesmo processo Express ou ligado via servidor HTTP) — transporte tempo-real do jogo.
  3. Serviço de Jogo (orquestrador) — carrega/salva GameState, chama o serviço de IA e emite updates.
  4. Flow Server da IA (Genkit) — expõe flows (ex.: `gameMasterFlow`) para o serviço de jogo consumir (pode ser parte do backend ou process separado).
  5. Banco de dados MySQL (Sequelize) — persistência de Users, Characters, GameSessions, etc.
  6. Redis — cache distribuído para `activeGameStates`, locks e pub/sub se for escalar múltiplas instâncias.
  7. Storage de segredos: `.env` + vault eventual (opcional).
  8. Criptografia utilitária para armazenar/descriptografar a google_api_key com seu crypto.

# Estrutura de diretórios sugerida

```
/backend
  /src
    /controllers       (Lógica de requisição/resposta)
    /services          (Lógica de negócios, interação com IA e BD)
    /routes            (Definição dos endpoints da API)
    /models            (Schemas do Sequelize e associações)
    /middlewares       (Autenticação, tratamento de erros)
    /config            (Configuração de banco de dados e Genkit)
    server.ts          (Ponto de entrada do servidor)
  /tests               (Testes unitários e de integração)
  ...
```

# Migração incremental — passos concretos (sem estimativas de tempo)

Vou descrever um caminho seguro em *fases*, do mínimo invasivo ao completo.

## Fase 0 — Reconstrução e Fundação

*   **[] Escolha do ORM**: Após análise, optamos por utilizar o **Sequelize** como ORM para este projeto, devido à sua maturidade, forte suporte da comunidade e por já estar integrado à estrutura inicial do novo backend. As migrações do banco de dados serão gerenciadas com o `sequelize-cli`.
*   **[] Estruturar o novo Backend**: Criar a estrutura de pastas com Express, TypeScript e Sequelize.
*   **[] Documentação da API**: A especificação da API será mantida em um único arquivo **`openapi.yaml`** na raiz do projeto para simplificar o gerenciamento e a integração com ferramentas de visualização.
*   **[] Configurar Sequelize e Modelos**: Definir os modelos `User`, `Character`, `GameSession`, `Log`, e `LicenseKey`. Configurar as associações e a conexão com o banco de dados.
*   **[] Implementar Middlewares Essenciais**: Criar `authMiddleware` para validação de JWT e `errorMiddleware` para tratamento de erros global.
*   **[] Configurar Rotas e Controllers Iniciais**: Criar a estrutura para as rotas da API (`auth`, `users`, `characters`, etc.) e seus respectivos controllers.
*   **[] Integrar Serviço de IA (Genkit)**: Isolar a lógica do Genkit em `iaService.ts`, garantindo que ele seja chamado pelos controllers, e implementar o streaming de respostas corretamente.

## Fase 1 — Autenticação, Licença e API de Usuário (Concluído)

*   **[] Implementar Endpoints de Autenticação**:
    *   `POST /api/auth/register`: Para registro de novos usuários.
    *   `POST /api/auth/login`: Para autenticação e obtenção de token JWT.
*   **[] Implementar Endpoints de Licença**:
    *   `POST /api/licenses/activate`: Ativa uma chave de licença para o usuário autenticado.
    *   `GET /api/licenses/status`: Verifica o status da licença do usuário.
*   **[] Implementar Endpoint de Usuário**:
    *   `GET /api/users/me`: Retorna os dados do usuário autenticado.

### Testes da Fase 1: API de Autenticação e Licença

Esta seção descreve os testes manuais (usando Postman, Insomnia ou `curl`) para garantir que a Fase 1 foi implementada corretamente.

#### 1. Registrar um Novo Usuário
- **Endpoint**: `POST /api/auth/register`
- **Ação**: Enviar um JSON com `username`, `email` e `password`.
- **Exemplo com `curl`**:
  ```bash
  curl -X POST http://localhost:8071/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "tester",
    "email": "test@example.com",
    "password": "password123"
  }'
  ```
- **Resposta Esperada (Sucesso)**:
  - **Status**: `201 Created`
  - **Corpo**: `{ "message": "Usuário registrado com sucesso!", "userId": <id_do_usuario> }`

- **Ação (Erro)**: Tentar registrar com o mesmo email novamente.
- **Resposta Esperada (Erro)**:
  - **Status**: `409 Conflict`
  - **Corpo**: `{ "message": "E-mail já cadastrado." }`

#### 2. Fazer Login
- **Endpoint**: `POST /api/auth/login`
- **Ação**: Enviar o `email` e `password` do usuário recém-criado.
- **Exemplo com `curl`**:
  ```bash
  curl -X POST http://localhost:8071/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
  ```
- **Resposta Esperada (Sucesso)**:
  - **Status**: `200 OK`
  - **Corpo**: `{ "token": "<seu_jwt_aqui>", "userId": <id_do_usuario> }`
- **Observação**: Guarde o valor do `token` para os próximos testes.

#### 3. Obter Dados do Usuário Autenticado
- **Endpoint**: `GET /api/users/me`
- **Ação**: Fazer uma requisição `GET` com o token JWT no cabeçalho.
- **Exemplo com `curl`**:
  ```bash
  # Substitua <seu_jwt_aqui> pelo token obtido no passo 2
  curl -X GET http://localhost:8071/api/users/me \
  -H "Authorization: Bearer <seu_jwt_aqui>"
  ```
- **Resposta Esperada (Sucesso)**:
  - **Status**: `200 OK`
  - **Corpo**: `{ "id": <id_do_usuario>, "username": "tester", "email": "test@example.com", ... }`

#### 4. Testar a Ativação de Licença

**Pré-requisito**: Adicionar uma chave de licença no banco de dados manualmente.
- Conecte-se ao seu banco de dados MySQL/MariaDB e execute:
  ```sql
  INSERT INTO license_keys (`key`, `is_active`, `expires_at`, `createdAt`, `updatedAt`) VALUES ('CHAVE-TESTE-01', 0, '2099-12-31 23:59:59', NOW(), NOW());
  ```

- **Ação 1: Ativar a licença**
  - **Endpoint**: `POST /api/licenses/activate`
  - **Exemplo com `curl`**:
    ```bash
    curl -X POST http://localhost:8071/api/licenses/activate \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <seu_jwt_aqui>" \
    -d '{ "key": "CHAVE-TESTE-01" }'
    ```
  - **Resposta Esperada**:
    - **Status**: `200 OK`
    - **Corpo**: `{ "message": "Licença ativada com sucesso!" }`

- **Ação 2: Verificar o status da licença**
  - **Endpoint**: `GET /api/licenses/status`
  - **Exemplo com `curl`**:
    ```bash
    curl -X GET http://localhost:8071/api/licenses/status \
    -H "Authorization: Bearer <seu_jwt_aqui>"
    ```
  - **Resposta Esperada**:
    - **Status**: `200 OK`
    - **Corpo**: `{ "isActive": true, "key": "CHAVE-TESTE-01", "expires_at": "2099-12-31T23:59:59.000Z" }`

## Fase 2 — API de Personagens e Início do Jogo (Concluído)

*   **[] Implementar Endpoints CRUD para Personagens**:
    *   `POST /api/characters`: Cria um novo personagem para o usuário autenticado.
    *   `GET /api/characters`: Lista todos os personagens do usuário.
    *   `GET /api/characters/:id`: Obtém os detalhes de um personagem específico.
    *   `PUT /api/characters/:id`: Atualiza um personagem.
    *   `DELETE /api/characters/:id`: Deleta um personagem.
*   **[] Implementar Endpoints da Sessão de Jogo**:
    *   `POST /api/game-sessions/action`: Endpoint principal para o jogo, que recebe a ação do jogador e retorna o stream da IA.
    *   `GET /api/game-sessions/character/:characterId`: Busca a sessão de jogo mais recente de um personagem.

### Testes da Fase 2: Personagens e Jogo

#### 1. Criar um Novo Personagem
- **Endpoint**: `POST /api/characters`
- **Ação**: Enviar os dados de um personagem em JSON (um objeto `stats` complexo).
- **Exemplo com `curl`**:
  ```bash
  # Substitua <seu_jwt_aqui>
  curl -X POST http://localhost:8071/api/characters \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <seu_jwt_aqui>" \
  -d '{
    "name": "Aragorn",
    "level": 1,
    "stats": { "strength": 16, "dexterity": 14 }
  }'
  ```
- **Resposta Esperada**:
  - **Status**: `201 Created`
  - **Corpo**: Um objeto JSON representando o personagem criado, incluindo `id`, `userId`, `name`, `level` e `stats`. **Guarde a `id` do personagem para o próximo teste.**

#### 2. Listar Personagens
- **Endpoint**: `GET /api/characters`
- **Exemplo com `curl`**:
  ```bash
  curl -X GET http://localhost:8071/api/characters \
  -H "Authorization: Bearer <seu_jwt_aqui>"
  ```
- **Resposta Esperada**:
  - **Status**: `200 OK`
  - **Corpo**: Um array contendo o(s) personagem(ns) criado(s). `[ { "id": <id_personagem>, "name": "Aragorn", ... } ]`

#### 3. Interagir com a IA (Streaming)
- **Endpoint**: `POST /api/game-sessions/action`
- **Ação**: Enviar a `characterId` do personagem criado e uma ação para a IA.
- **Exemplo com `curl` (com a flag `-N` para não bufferizar a saída)**:
  ```bash
  # Substitua <seu_jwt_aqui> e <id_personagem_aqui>
  curl -X POST -N http://localhost:8071/api/game-sessions/action \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <seu_jwt_aqui>" \
  -d '{
    "characterId": <id_personagem_aqui>,
    "playerAction": "Eu olho ao redor da taverna.",
    "gameLog": []
  }'
  ```
- **Resposta Esperada**:
  - **Status**: `200 OK`
  - **Headers**: `Content-Type: application/json; charset=utf-8`
  - **Corpo**: Um fluxo contínuo de objetos JSON. Cada pedaço (`chunk`) que chega será uma parte da narração da IA, que deve ser processado em tempo real pelo frontend.

## Fase 3 — Frontend: Conexão com o Backend (Em Andamento)

*   **[ ] Refatorar `AuthContext`**: Substituir toda a lógica de `localStorage` pela nova API REST de autenticação (`/api/auth/...`) e licença (`/api/licenses/...`).
*   **[ ] Criar Tela de Seleção de Personagem**: Após o login, o usuário será direcionado para uma tela que buscará seus personagens via `GET /api/characters` e os exibirá em "slots".
*   **[ ] Refatorar `GameStateContext`**:
    *   O `useGameState` deve ser completamente reescrito para interagir com a API do backend.
    *   A função `processPlayerAction` agora fará uma requisição `fetch` para `POST /api/game-sessions/action`.
    *   O hook deverá ser capaz de consumir e processar o stream de resposta, atualizando o estado do jogo (log, personagem, etc.) a cada chunk recebido.

## Fase 4 — WebSocket e Modo Multiplayer (Futuro)

*   **[ ] Implementar WebSocket Server**: Adicionar um servidor WebSocket ao processo do Express para comunicação em tempo real.
*   **[ ] Implementar Lógica de Sala**: Criar mecanismos para que os jogadores criem, entrem e saiam de salas de jogo.
*   **[ ] Sincronizar Estado do Jogo**: O servidor transmitirá todas as atualizações de estado (narração, ações de jogadores, mudanças em combate) para todos os clientes na mesma sala.
*   **[ ] Adaptar o Fluxo de Turnos**: Modificar a interação com a IA para gerenciar múltiplos jogadores, possivelmente com um sistema de turnos.

# Checklist final (executável)

* [X] Criar repo backend TS e configurar lint/tsconfig.
* [X] Configurar Sequelize e entidades (incluindo `LicenseKey`).
* [X] Implementar todos os `controllers`.
* [X] Implementar todos os `services`, incluindo `iaService` com streaming.
* [X] Implementar `authMiddleware`.
* [X] Configurar todas as rotas da API no `server.ts`.
* [ ] Adicionar Redis e implement redisService.
* [ ] Implementar WebSocket server e integração com gameService + Redis locks.
* [ ] Adicionar monitoramento e alertas.
* [ ] Planejar rollout progressivo com feature-flag.

