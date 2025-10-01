
* **Objetivo:** mover toda a lógica do jogo para o backend, fazer o backend conversar com o Genkit/Google Gemini usando a API key criptografada do usuário, e enviar atualizações em tempo real ao frontend por WebSocket.

Sempre Atualizar integracao_backend.md com tudo que foi feito.

Usar o backend/README.md: Este novo arquivo fornecerá instruções passo a passo para configurar e iniciar o servidor backend, incluindo a configuração do banco de dados e as variáveis de ambiente.

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
    /entities          (TypeORM entities)
    /services
      authService.ts
      gameService.ts        <-- orchestrador / load + save + WS handler
      geminiService.ts      <-- inicializa genkit/flows (or separate aiServer)
      redisService.ts
    /ws
      webSocketServer.ts
    /routes
      auth.ts
      license.ts
      user.ts
      admin.ts
    /utils
      crypto.ts
      logger.ts
    server.ts
  ormconfig.ts or data-source.ts
```

# Migração incremental — passos concretos (sem estimativas de tempo)

Vou descrever um caminho seguro em *fases*, do mínimo invasivo ao completo. Você disse que hoje não existe DB/WS — vamos migrar incrementalmente para reduzir riscos.

## Fase 0 — Preparação (concluído)

*   **[X] Criar repositório backend** (Node + TypeScript + ts-node).
*   **[X] Configurar TypeORM** com MySQL local (arquivo `data-source.ts`). Manter `synchronize: true` por enquanto.
*   **[X] Criar entidades básicas**: `User`, `Character`, `GameSession`, `LicenseKey`.
*   **[X] Adicionar utilitário de criptografia** (seu `crypto.ts` já ok).

## Fase 1 — API REST mínima + Autenticação e Ativação de Licença (Concluído)

*   **[X] Implementar endpoint de registro (`/register`):**
    *   Aceita `username`, `email`, `password`.
    *   Valida os dados e cria um novo `User` sem licença.
*   **[X] Implementar endpoint de login (`/login`):**
    *   Aceita `login` (pode ser username ou email) e `password`.
    - Retorna um `token` JWT contendo o `userId`, além de `isLicenseActive`.
*   **[X] Implementar endpoint de ativação de licença (`/api/activate-license`):**
    *   Valida a chave no banco de dados: verifica se existe, se não está em uso e se não está expirada.
    - Se a chave for válida, associa-a ao `userId` e marca-a como `isActive: true`.
*   **[X] Endpoint `/api/user/google-key` para o usuário salvar/atualizar sua `google_api_key` (será criptografada e armazenada no DB).**
    -   `POST`: Salva ou atualiza a chave da API do Google, criptografando-a.
    -   `GET`: Recupera a chave da API do Google de forma segura.

### Testes da Fase 1: Backend (Autenticação e Configuração)

Esta seção descreve os testes manuais para garantir que a Fase 1 foi implementada corretamente.

1.  **[X] Rodar o servidor**
    *   **Verificação:** O servidor inicia sem erros e se conecta ao TypeORM.

2.  **[X] Tentar cadastrar um novo usuário**
    *   **Verificação:** O usuário é criado no banco de dados e uma mensagem de sucesso é retornada.

3.  **[X] Criar uma chave de licença no banco de dados**
    *   **Verificação:** A chave é inserida corretamente na tabela `license_keys`.

4.  **[X] Tentar logar com o novo usuário**
    *   **Verificação:** O login é bem-sucedido, retorna um token, `userId` e `isLicenseActive: false`.

5.  **[X] Ativar a licença do usuário**
    *   **Verificação:** A licença é ativada. Um novo login retorna `isLicenseActive: true`.

6.  **[X] Salvar a Chave da API do Google**
    *   **Verificação:** A chave é criptografada e salva no banco de dados para o usuário correto.

### Testes da Fase 1: Frontend (UI/UX)

1.  **[X] Teste de Registro e Login**
    *   **Verificação:** O usuário consegue se registrar, recebe um toast de sucesso e é redirecionado para o login. O login funciona e leva para a tela de ativação.

2.  **[X] Teste de Ativação de Licença**
    *   **Verificação:** O usuário insere uma chave válida, recebe um toast de sucesso e avança para a tela de chave de API.

3.  **[X] Teste de Inserção da Chave de API**
    *   **Verificação:** O usuário insere a chave, recebe um toast de sucesso e é levado para a tela principal de criação de personagem.

4.  **[X] Teste de Logout e Persistência de Sessão**
    *   **Verificação:** Atualizar a página mantém o usuário logado. O botão de logout funciona e redireciona para a tela de autenticação.

## Fase 2 — Serviço da IA isolado (Genkit flow server) (Concluído)

*   **[X] Implementar `geminiService.ts` no backend.** Este serviço define o `gameMasterFlow` usando Genkit.
*   **[X] Usar `@genkit-ai/express`**: O `server.ts` usa o `expressHandler` para expor o `gameMasterFlow` de forma segura. Um `context` provider é usado para extrair o `userId` do corpo da requisição e carregar a chave de API do usuário dinamicamente para cada chamada.
*   **[X] Criar Endpoint de Jogo**: O `server.ts` agora tem o endpoint `/api/game-master` para receber as ações do jogo e executar o `gameMasterFlow`.
*   **[X] Endpoint de Teste**: Foi criado um endpoint `/api/test-ai` que permite ao frontend validar a conectividade com a API do Google através do backend, garantindo que a chave de API do usuário está funcionando corretamente.

### Testes da Fase 2: Backend (Serviço de IA)

1.  **[X] Preparar Dados de Teste**
    *   **Como fazer:**
        1.  No seu cliente de banco de dados, garanta que você tem um usuário com uma licença ativa e uma chave de API válida do Google AI Studio salva e criptografada (você já fez isso na Fase 1). Anote o `userId` desse usuário.
    *   **Ver se retorna:** Confirme que o registro do usuário no DB possui um valor no campo `google_api_key_encrypted`.

2.  **[X] Testar o Endpoint `/api/game-master` com uma Ação Válida**
    *   **Como fazer:**
        1.  Use `curl` ou uma ferramenta de API para enviar uma requisição `POST` para `http://localhost:8071/api/game-master`.
        2.  O corpo (body) da requisição deve ser um JSON contendo `userId` e `input`. Substitua `<SEU_USER_ID>` pelo ID do seu usuário de teste.
    *   **Exemplo de `curl`:**
        ```bash
        curl -X POST -H "Content-Type: application/json" -d '{
          "userId": <SEU_USER_ID>,
          "input": {
            "character": { "name": "Herói de Teste", "level": 1, "hp": { "current": 10, "max": 10 }, "attributes": { "strength": 14 } },
            "playerAction": "A aventura começa. Onde eu estou?",
            "gameLog": [],
            "combatState": { "isActive": false, "round": 0, "turn": 0, "combatants": [] }
          }
        }' http://localhost:8071/api/game-master
        ```
    *   **Ver se retorna:**
        *   Uma resposta JSON bem-sucedida (status 200).
        *   O JSON retornado deve ser um objeto `GameMasterResponse` válido, contendo, no mínimo, uma `logEntries` com a narração inicial da aventura e um `actionOptions` com as próximas escolhas para o jogador.

3.  **[X] Testar o Endpoint com um `userId` Inválido**
    *   **Como fazer:** Envie a mesma requisição do teste anterior, mas use um `userId` que não existe no banco de dados (ex: 999).
    *   **Ver se retorna:** Uma resposta de erro (401 ou 500) e uma mensagem indicando que "A chave de API do Google do usuário não foi encontrada ou é inválida".

## Fase 3 — API de Personagens & Orquestrador de Jogo (Backend)

*   **[X] Criar Entidades de Dados com Soft Delete**:
    *   Adicionar as colunas `is_active` (boolean, default `true`), `deleted_at` (timestamp, nullable) e colunas de tempo de jogo (`last_played_at`, `total_play_time_seconds`) às entidades `User`, `Character` e `GameSession`.
    *   Toda operação de exclusão agora será um *soft delete*, atualizando `is_active` para `false` e preenchendo `deleted_at`.

*   **[ ] Implementar Endpoints REST para Personagens**:
    *   **`GET /api/characters`**: Retorna uma lista de todos os personagens *ativos* associados ao `userId` (obtido do token JWT). As informações retornadas devem ser suficientes para preencher os "save slots" (nome, nível, classe, etc.).
    *   **`POST /api/characters/create`**: Recebe os dados de um novo personagem (saída do wizard de criação) e cria uma nova entrada `Character` no banco de dados associada ao `userId`.
    *   **`DELETE /api/character/:id`**: Realiza um *soft delete* no personagem especificado. Garante que apenas o dono do personagem possa deletá-lo.

*   **[ ] Refatorar o Orquestrador do Jogo (sem WebSocket ainda)**:
    *   **`POST /api/game/action`**: Este endpoint será o principal para o jogo.
        *   Aceitará `{ characterId, action }`.
        *   Carregará o `GameState` completo do personagem a partir do banco de dados (a última `GameSession` ativa).
        *   Chamará o `gameMasterFlow` (da Fase 2) com o estado carregado.
        *   Receberá a resposta da IA, processará as atualizações, e salvará um **novo** `GameSession` no banco de dados.
        *   Atualizará as estatísticas do personagem (`last_played_at`, `total_play_time_seconds`).
        *   Retornará o `GameMasterResponse` completo para o frontend.

## Fase 4 — Frontend: Menu de Slots e Integração com API de Personagens

*   **[ ] Remover Lógica de `localStorage`**: Substituir todas as chamadas a `localStorage` para salvar/carregar por chamadas à nova API REST.
*   **[ ] Criar Tela de Seleção de Personagem**:
    *   Ao logar, o usuário verá uma nova tela (estilo Zelda/Final Fantasy) que faz uma chamada a `GET /api/characters`.
    *   Renderizar "slots" com os dados de cada personagem retornado.
    *   Slots vazios terão um botão "Criar Novo".
    *   Slots preenchidos exibirão informações (Nome, Nível, etc.) e botões para "Jogar" e "Apagar".
    *   Implementar um botão "Continuar" principal que carrega o personagem com o `last_played_at` mais recente.

*   **[ ] Integrar o Fluxo de Jogo**:
    *   A ação "Jogar" em um slot de personagem levará o jogador à tela de jogo.
    *   O `useGameState` do frontend será refatorado para usar o endpoint `POST /api/game/action` para cada ação do jogador, em vez de chamar o serviço Gemini diretamente.

## Fase 5 — WebSocket server + protocolo de mensagens

* Implementar WebSocket server (no mesmo processo Express ou processo separado):

  * Autenticação na conexão (JWT e `characterId` na query string). Validar que `characterId` pertence ao user do token.
  * Associar ws connection com `userId` e `characterId`.
  * Mensagens esperadas do cliente: `playerAction`, `rollResult`, `resync`, `heartbeat`.
  * Mensagens enviadas ao cliente: `startProcessing`, `logUpdate`, `playerRollRequest`, `characterUpdate`, `combatStateUpdate`, `fullResponse`, `error`, `stopProcessing`.
* Processamento:

  * Ao receber `playerAction`, orquestrador:

    1. Acquire Redis lock `lock:character:{id}`.
    2. Carrega `GameState` (cache Redis -> DB fallback).
    3. Envia input ao AI flow (passando userId para obter user apiKey no flow).
    4. Recebe stream (ou resposta completa) -> publica updates via WS ao cliente (e via Redis pub/sub para outras instâncias, se necessário).
    5. Atualiza cache DB; release lock.
* **Reconexão**: quando cliente reconecta, servidor revalida token e re-associa, então envia `fullState`.

### Exemplo mínimo WebSocket (ws)

```ts
// webSocketServer.ts (esqueleto)
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { handleGameAction } from '../services/newGameService';

export function setupWebSocket(server: http.Server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url?.split('?')[1]);
    const token = params.get('token');
    const characterId = params.get('characterId');

    const payload = jwt.verify(token, process.env.JWT_SECRET) as any;
    const userId = payload.userId;

    ws.on('message', async (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === 'playerAction') {
         await handleGameAction(data.payload, userId, characterId, (update) => ws.send(JSON.stringify(update)));
      }
    });
  });
}
```

## Fase 6 — Hardening / produção

* Mudar `synchronize: true` para usar migrations quando entrar em produção (recomendado, mas você pediu manter; se mantiver, documente riscos).
* Políticas de rotação de secrets (env + vault).
* Rate limits para uso da API do Google por usuário (evitar abuso).
* Monitoramento (Prometheus + Grafana) e logging (ELK / Loki) para observar latência do AI e erros.
* Autoscaling e Redis cluster se precisar escalar.

# Checklist final (executável)

* [X] Criar repo backend TS e configurar lint/tsconfig.
* [X] Configurar TypeORM e entidades.
* [X] Implementar util crypto e testes.
* [X] Implementar auth com registro/login/ativação de licença.
* [X] Implementar gemini/ai server (genkit flows).
* [ ] Implementar gameService REST (sem WS) e testes.
* [ ] Adicionar Redis e implement redisService.
* [ ] Implementar WebSocket server e integração com gameService + Redis locks.
* [ ] Adicionar monitoramento e alertas.
* [ ] Planejar rollout progressivo com feature-flag.


# Observações, mudanças...


```