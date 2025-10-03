
* **Objetivo:** mover toda a lógica do jogo para o backend, fazer o backend conversar com o Genkit/Google Gemini usando a API key criptografada do usuário, e enviar atualizações em tempo real ao frontend por WebSocket.

Sempre Atualizar integracao_backend.md com tudo que foi feito.

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

## Fase 0 — Reconstrução e Fundação (Concluído)

*   **[X] Estruturar o novo Backend**: Criar a estrutura de pastas com Express, TypeScript e Sequelize.
*   **[X] Configurar Sequelize e Modelos**: Definir os modelos `User`, `Character`, `GameSession`, `Log`, e `LicenseKey`. Configurar as associações e a conexão com o banco de dados.
*   **[X] Implementar Middlewares Essenciais**: Criar `authMiddleware` para validação de JWT e `errorMiddleware` para tratamento de erros global.
*   **[X] Configurar Rotas e Controllers Iniciais**: Criar a estrutura para as rotas da API (`auth`, `users`, `characters`, etc.) e seus respectivos controllers.
*   **[X] Integrar Serviço de IA (Genkit)**: Isolar a lógica do Genkit em `iaService.ts`, garantindo que ele seja chamado pelos controllers, e implementar o streaming de respostas corretamente.

## Fase 1 — Autenticação, Licença e API de Usuário (Concluído)

*   **[X] Implementar Endpoints de Autenticação**:
    *   `POST /api/auth/register`: Para registro de novos usuários.
    *   `POST /api/auth/login`: Para autenticação e obtenção de token JWT.
*   **[X] Implementar Endpoints de Licença**:
    *   `POST /api/licenses/activate`: Ativa uma chave de licença para o usuário autenticado.
    *   `GET /api/licenses/status`: Verifica o status da licença do usuário.
*   **[X] Implementar Endpoint de Usuário**:
    *   `GET /api/users/me`: Retorna os dados do usuário autenticado.

### Testes da Fase 1: API de Autenticação e Licença

Esta seção descreve os testes manuais (usando Postman, Insomnia ou `curl`) para garantir que a Fase 1 foi implementada corretamente.

1.  **[ ] Tentar Registrar um Novo Usuário (`POST /api/auth/register`)**
    *   **Requisição:** Enviar `username`, `email` e `password`.
    *   **Verificação:** Receber uma resposta `201 Created` com a mensagem de sucesso. Verificar no banco de dados se o usuário foi criado com a senha hasheada.

2.  **[ ] Tentar Registrar com Dados Inválidos**
    *   **Requisição:** Tentar registrar com um email já existente. Depois, tentar com um nome de usuário já existente.
    *   **Verificação:** Receber uma resposta de erro `409 Conflict` em ambos os casos.

3.  **[ ] Tentar Fazer Login (`POST /api/auth/login`)**
    *   **Requisição:** Enviar `email` e `password` corretos.
    *   **Verificação:** Receber uma resposta `200 OK` contendo `token` e `userId`.

4.  **[ ] Preparar uma Chave de Licença**
    *   **Como Fazer:** Inserir manualmente uma chave de licença válida e não ativa na tabela `license_keys` do banco de dados (ex: `key: 'CHAVE-TESTE-01', is_active: false, expires_at: '2099-12-31'`).

5.  **[ ] Verificar Status da Licença (Sem Licença)**
    *   **Requisição:** Fazer uma chamada `GET /api/licenses/status` com o token JWT do usuário.
    *   **Verificação:** Receber uma resposta `404 Not Found` indicando que nenhuma licença foi encontrada.

6.  **[ ] Ativar a Licença (`POST /api/licenses/activate`)**
    *   **Requisição:** Enviar a chave (`'CHAVE-TESTE-01'`) no corpo da requisição, com o token JWT do usuário no cabeçalho.
    *   **Verificação:** Receber uma resposta `200 OK`. Verificar no banco de dados se `license_keys.is_active` é `true` e se o `userId` foi associado corretamente.

7.  **[ ] Verificar Status da Licença (Com Licença)**
    *   **Requisição:** Fazer uma chamada `GET /api/licenses/status` novamente.
    *   **Verificação:** Receber uma resposta `200 OK` com `isActive: true`.

## Fase 2 — API de Personagens e Início do Jogo (Concluído)

*   **[X] Implementar Endpoints CRUD para Personagens**:
    *   `POST /api/characters`: Cria um novo personagem para o usuário autenticado.
    *   `GET /api/characters`: Lista todos os personagens do usuário.
    *   `GET /api/characters/:id`: Obtém os detalhes de um personagem específico.
    *   `PUT /api/characters/:id`: Atualiza um personagem.
    *   `DELETE /api/characters/:id`: Deleta um personagem.
*   **[X] Implementar Endpoints da Sessão de Jogo**:
    *   `POST /api/game-sessions/action`: Endpoint principal para o jogo, que recebe a ação do jogador e retorna o stream da IA.
    *   `GET /api/game-sessions/character/:characterId`: Busca a sessão de jogo mais recente de um personagem.

### Testes da Fase 2: Personagens e Jogo

1.  **[ ] Criar um Novo Personagem (`POST /api/characters`)**
    *   **Requisição:** Com um token de usuário válido, enviar os dados de um personagem (nome, nível, estatísticas JSON) no corpo.
    *   **Verificação:** Receber uma resposta `201 Created` com os dados do personagem criado. Verificar se o registro foi salvo corretamente na tabela `characters`.

2.  **[ ] Listar Personagens (`GET /api/characters`)**
    *   **Requisição:** Fazer uma chamada `GET` com o token do usuário.
    *   **Verificação:** Receber uma resposta `200 OK` com a lista de personagens pertencentes àquele usuário.

3.  **[ ] Iniciar Interação com a IA (`POST /api/game-sessions/action`)**
    *   **Requisição:** Com um token válido, enviar um corpo contendo `character` (objeto JSON), `playerAction` (string), e `gameLog` (array).
    *   **Verificação:** Receber uma resposta `200 OK` com o `Content-Type` de `text/plain; charset=utf-8`. O corpo da resposta deve ser um stream de chunks JSON que chegam em tempo real, representando a narração do mestre de jogo.

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
