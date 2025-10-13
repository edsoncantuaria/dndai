
* **Objetivo:** mover toda a lógica do jogo para o backend, fazer o backend conversar com o Genkit/Google Gemini usando a API key criptografada do usuário, e enviar atualizações em tempo real ao frontend por WebSocket.

Sempre Atualizar integracao_backend.md com tudo que foi feito. Colocar testes e esperar retornar que todos os testes estão funcionando!

Um backend, por mais funcional que seja, é inútil se o frontend não estiver preparado para se comunicar com ele. É crucial documentar o estado de ambos os lados para termos uma visão clara do progresso.

* **Componentes principais:**

  1. Backend HTTP (Express) — API REST (autenticação, gerenciamento de usuário, endpoints administrativos).
  2. WebSocket Server (no mesmo processo Express ou ligado via servidor HTTP) — transporte tempo-real do jogo.
  3. Serviço de Jogo (orquestrador) — carrega/salva GameState, chama o serviço de IA e emite updates.
  4. Flow Server da IA (Genkit) — expõe flows (ex.: `gameMasterFlow`) para o serviço de jogo consumir (pode ser parte do backend ou process separado).
  5. Banco de dados MySQL (TypeORM) — persistência de Users, Characters, GameSessions, etc.
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
    /models            (Schemas do TypeORM e associações)
    /middlewares       (Autenticação, tratamento de erros)
    /database          (Configuração da fonte de dados - data-source)
    server.ts          (Ponto de entrada do servidor)
  /tests               (Testes unitários e de integração)
  ...
```

# Migração incremental — passos concretos (sem estimativas de tempo)

Vou descrever um caminho seguro em *fases*, do mínimo invasivo ao completo.

## Fase 0 — Reconstrução e Fundação (Concluído)

*   **[X] Escolha do ORM**: Após análise e dificuldades com a configuração do Sequelize com TypeScript, optamos por utilizar o **TypeORM**, devido à sua forte tipagem, suporte nativo a TypeScript com decoradores e uma comunidade robusta.
*   **[X] Estruturar o novo Backend**: Criar a estrutura de pastas com Express, TypeScript e TypeORM.
*   **[X] Documentação da API**: A especificação da API será mantida em um único arquivo **`openapi.yaml`** na raiz do projeto para simplificar o gerenciamento e a integração com ferramentas de visualização.
*   **[X] Configurar TypeORM e Modelos**: Definir os modelos `User`, `Character`, `GameSession`, `Log`, e `LicenseKey` usando decoradores do TypeORM. Configurar o `AppDataSource` para conexão com o banco de dados.
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

**Pré-requisito para Teste de Licença**: Para testar a ativação, adicione manualmente uma chave de licença ao seu banco de dados:
```sql
INSERT INTO license_keys (`key`) VALUES ('CHAVE-TESTE-01');
```

## Fase 2 - Refatoração do Backend de IA (Concluído)

*   **Objetivo**: Reconstruir a lógica de interação com a IA no backend, permitindo múltiplas sessões de jogo paralelas, cada uma com sua própria chave de API e contexto de Genkit.
*   **Documento de Planejamento**: Todos os detalhes e o passo a passo desta fase estão no novo arquivo mestre: **[backend_refactor.md](./backend_refactor.md)**.
*   **Status Atual**: Concluído. A API de narração está funcionando.

## Fase 3 — Frontend: Conexão com o Backend (Em Andamento)

*   **[X] Refatorar `AuthContext`**: Substituir toda a lógica de `localStorage` pela nova API REST de autenticação (`/api/auth/...`) e licença (`/api/licenses/...`).
*   **[ ] Criar Tela de Seleção de Personagem**: Após o login, o usuário será direcionado para uma tela que buscará seus personagens via `GET /api/characters` e os exibirá em "slots".
*   **[ ] Refatorar `GameStateContext`**:
    *   O `useGameState` deve ser completamente reescrito para interagir com a API do backend.
    *   A função `processPlayerAction` agora fará uma requisição `fetch` para `POST /api/narrar/:sessionId`.
    *   O hook deverá ser capaz de consumir e processar o stream de resposta, atualizando o estado do jogo (log, personagem, etc.) a cada chunk recebido.

## Fase 4 — WebSocket e Modo Multiplayer (Futuro)

*   **[ ] Implementar WebSocket Server**: Adicionar um servidor WebSocket ao processo do Express para comunicação em tempo real.
*   **[ ] Implementar Lógica de Sala**: Criar mecanismos para que os jogadores criem, entrem e saiam de salas de jogo.
*   **[ ] Sincronizar Estado do Jogo**: O servidor transmitirá todas as atualizações de estado (narração, ações de jogadores, mudanças em combate) para todos os clientes na mesma sala.
*   **[ ] Adaptar o Fluxo de Turnos**: Modificar a interação com a IA para gerenciar múltiplos jogadores, possivelmente com um sistema de turnos.

# Checklist final (executável)

* [X] Criar repo backend TS e configurar lint/tsconfig.
* [X] Configurar TypeORM e entidades (incluindo `LicenseKey`).
* [X] Implementar todos os `controllers`.
* [X] Implementar todos os `services`, incluindo `iaService` com streaming.
* [X] Implementar `authMiddleware`.
* [X] Configurar todas as rotas da API no `server.ts`.
* [ ] Adicionar Redis e implement redisService.
* [ ] Implementar WebSocket server e integração com gameService + Redis locks.
* [ ] Adicionar monitoramento e alertas.
* [ ] Planejar rollout progressivo com feature-flag.
