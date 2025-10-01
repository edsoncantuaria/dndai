
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

## Fase 1 — API REST mínima + Autenticação e Ativação de Licença (Revisado e Concluído)

*   **[X] Implementar endpoint de registro (`/register`):**
    *   Aceita `username`, `email`, `password`.
    *   Valida os dados e cria um novo `User` sem licença.
*   **[X] Implementar endpoint de login (`/login`):**
    *   Aceita `login` (pode ser username ou email) e `password`.
    *   Valida as credenciais.
    *   Retorna um `token` JWT contendo o `userId`, além de `isLicenseActive`.
*   **[X] Implementar endpoint de ativação de licença (`/api/activate-license`):**
    *   O frontend chamará este endpoint se `isLicenseActive` for `false` após o login.
    *   Aceita `userId` e `licenseKey`.
    *   Valida a chave no banco de dados: verifica se existe, se não está em uso e se a data de expiração (`expiresAt`) é futura em relação à data atual do servidor.
    - Se a chave for válida, associa-a ao `userId`, marca-a como `isActive: true` e salva.
    - Retorna sucesso ou falha na ativação.
*   **[X] Endpoint `/api/user/google-key` para o usuário salvar/atualizar sua `google_api_key` (será criptografada e armazenada no DB).**
    -   `POST`: Salva ou atualiza a chave da API do Google, criptografando-a.
    -   `GET`: Recupera a chave da API do Google de forma segura para ser usada nas chamadas da IA (requer autenticação adequada).

### Preparação e Status do Frontend

*   **Situação Atual:** O frontend foi atualizado para se comunicar com a nova API de backend. Foi criado um fluxo completo de autenticação.
*   **O que foi implementado no frontend:**
    1.  **Contexto de Autenticação (`AuthContext`)**: Gerencia o estado do usuário (`userId`, `isAuthenticated`, `isLicenseActive`, `hasApiKey`), armazena o token de sessão no `localStorage` e fornece funções de `login`, `register`, `logout`, `activateLicense` e `saveApiKey`.
    2.  **Serviço de API (`authService`)**: Centraliza as chamadas `fetch` para todos os endpoints de autenticação e gerenciamento de chaves do backend, incluindo o token JWT no cabeçalho `Authorization`.
    3.  **Componentes de UI de Autenticação**:
        *   `AuthForm`: Uma tela principal para alternar entre login e registro.
        *   `LoginForm` e `RegisterForm`: Formulários para entrada de dados.
        *   `LicenseActivationForm`: Aparece após o login se o usuário não tiver uma licença ativa.
        *   `ApiKeyForm`: Aparece após a ativação da licença se o usuário ainda não tiver configurado sua chave de API do Google.
    4.  **Fluxo de Aplicação (`page.tsx`)**: O componente principal da aplicação agora verifica o estado de autenticação antes de renderizar o jogo. Ele guia o usuário através do login, ativação de licença e configuração da chave de API antes de permitir o acesso ao contêiner do jogo.
*   **Próximos Passos no Frontend:** Com o fluxo de autenticação e configuração concluído, o próximo grande passo é refatorar a lógica do jogo para se comunicar via WebSockets com o backend (Fases 3, 4 e 5), em vez de executar a lógica da IA no cliente.

## Fase 2 — Serviço da IA isolado (Genkit flow server)

*   **[ ] Implementar `geminiService.ts` no backend.** Este serviço definirá o `gameMasterFlow` usando Genkit.
*   **[ ] Chave de API Dinâmica**: O fluxo deve buscar a chave de API do usuário (criptografada no banco de dados) para cada chamada, garantindo que as requisições sejam feitas com as credenciais do usuário.
*   **[ ] Testes de Conexão**: Inicialmente, testaremos a chamada ao flow com dados estáticos para validar que a lógica da chave de API e a chamada ao Gemini estão funcionando corretamente.

### Snippet de inicialização (exemplo simplificado com genkit express)

```ts
// aiServer.ts (exemplo com genkit/express hypotético)
import express from 'express';
import { startFlowServer } from 'genkit/express'; // pseudocódigo
import { gameMasterFlow } from './flows/gameMasterFlow';

const app = express();
app.use(express.json());

startFlowServer({
  app,
  flows: [gameMasterFlow], // flow exportado
  port: 3400,
});
```

*(Ajuste conforme API real de genkit/express que você escolher.)*

## Fase 3 — Orquestrador backend + chamadas AI (sem WebSocket)

* Implementar `gameService.ts` no backend que:

  * Lê `GameState` do DB (ou cria se não existir).
  * Decripta `user.google_api_key` com `decrypt`.
  * Chama o flow do AI server passando `character, gameLog, playerAction, combatState` e `userId`.
  * Recebe `GameMasterResponse` JSON completo, atualiza `GameState` e salva no DB.
* Expor endpoint REST `POST /api/game/action` que aceita `{ characterId, action }` e devolve `GameMasterResponse`.
* **Teste**: do frontend faça POST para `/api/game/action` e valide roundtrip (sem WS).

## Fase 4 — Redis: cache distribuído, locks e pub/sub

* **Por que Redis**: quando passar para WebSocket e múltiplas instâncias do backend, precisa:

  * Guardar `activeGameStates` em um cache central (Redis) para partilhar entre instâncias.
  * Usar locks (ex.: Redlock) para evitar race conditions ao processar a mesma sessão.
  * Usar Pub/Sub para enviar updates entre instâncias (se sua arquitetura usar múltiplas nodes WS).
* Implementação:

  * `redisService.ts` com `ioredis` ou `redis@4`.
  * APIs: `getCachedState(characterId)`, `setCachedState(characterId, state)`, `acquireLock(key)`, `releaseLock(key)`, `publish(channel, message)`, `subscribe(channel, handler)`.
* Inicialmente mantenha `activeGameStates` em memória local + Redis como *backup*. Depois migre para Redis como fonte primária do cache.

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

## Fase 7 — Hardening / produção

* Mudar `synchronize: true` para usar migrations quando entrar em produção (recomendado, mas você pediu manter; se mantiver, documente riscos).
* Políticas de rotação de secrets (env + vault).
* Rate limits para uso da API do Google por usuário (evitar abuso).
* Monitoramento (Prometheus + Grafana) e logging (ELK / Loki) para observar latência do AI e erros.
* Autoscaling e Redis cluster se precisar escalar.

# Tipos, schemas e garantias (coerência)

* **TypeScript**:

  * Definir tipos centrais (`GameState`, `Combatant`, `ShopState`) em `src/types.ts` e reusar nas entidades e services.
  * Nos pontos de transformação (DB -> cache -> AI flow -> DB), normalize os objetos: garantir que campos opcionais existam (`globalConditions: []`) para evitar erros de validação do Flow Schema.
* **GameMasterFlowInput**: Sempre envie estruturas completas, substituindo objetos vazios por placeholders não vazios quando o schema do genai exigir (ex: `{ sellPrices: { placeholder: 0 } }`).
* **Validação**: use seu Zod schemas para validar a resposta da IA antes de aplicar ao estado do jogo.

# Código essencial (trechos práticos)

### decrypt + buscar api key

```ts
// utils/useService.ts
import { AppDataSource } from '../config/data-source';
import { User } from '../entities/User';
import { decrypt } from './crypto';

export const getUserApiKey = async (userId: number): Promise<string | null> => {
  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOneBy({ id: userId });
  if (!user || !user.googleApiKeyEncrypted) return null;
  return decrypt(user.googleApiKeyEncrypted);
};
```

### Exemplo de chamada ao flow com apiKey (no backend)

```ts
// geminiService.ts (simplificado, use genkit/express or SDK)
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { getUserApiKey } from '../utils/useService';

export const callGameMasterFlow = async (modelName, input, userId) => {
  const apiKey = await getUserApiKey(userId);
  if (!apiKey) throw new Error('user api key missing');

  // dynamically init genkit with plugin
  const ai = genkit({ plugins: [googleAI({ apiKey, apiVersion: 'v1beta' })] });
  const model = ai.model(modelName);
  // generate - adjust to actual genkit API
  const result = await ai.generate({ model, prompt: createPrompt(input), config: { /* ... */ }, output: { format: 'json', schema: GameMasterResponseSchema } });
  return result;
}
```

> **Nota:** dependendo da versão do genkit/SDK que usar, a assinatura pode diferir. A ideia é: *instanciar plugin googleAI com apiKey do usuário e usar ai.*


# Observabilidade e alertas

* Métricas importantes: tempo de resposta do AI, taxa de erro do AI, tempo de processamento por sessão, locks contenciosos (deadlocks).
* Logs estruturados para cada chamada ao AI (userId, characterId, model, prompt size, response status), mas **não** inclua a API key nos logs.
* Alertas: erros 5xx, quedas contínuas de AI, Redis indisponível, filas de processamento crescendo.

# Rollout incremental (migração do frontend)

1. **Modo híbrido**: manter o cliente atual e adicionar um botão “Play (Backend)” que usa o novo backend (via REST) para uma sessão/character nova. Permite testar sem quebrar todos os usuários.
2. **Opção de Mover personagem**: botões para migrar progresso local (localStorage) para backend (chamar endpoint que cria Character + GameSession).
3. **Beta com WebSocket**: habilitar WS para um conjunto restrito de usuários (feature flags).
4. **Full migration**: desabilitar o modo frontend-centric e tornar backend default.

# Riscos & mitigação

* **Dependência da API do Google**: ter re-tries, timeouts curtos (ex.: 30s), fallback amigável (ex.: mensagem “IA indisponível, tente novamente”).
* **Segurança do token**: JWT expirations curtas, refresh tokens, HTTPS obrigatório, validação do characterId.
* **Consistência de estado**: usar locks Redis (ex.: Redlock) e persistir imediatamente alterações críticas.
* **Escalabilidade**: se crescimento for grande, mover `activeGameStates` para Redis e separar workers para chamadas ao AI.

# Fase de Testes

## Testes da Fase 1: Autenticação e Configuração

Esta seção descreve os testes manuais para garantir que a Fase 1 foi implementada corretamente.

### 1. [ ] Rodar o servidor

**Como fazer:**
1.  Certifique-se de que um servidor MySQL está rodando e acessível.
2.  No diretório `backend`, crie um arquivo chamado `.env` com o seguinte conteúdo (substitua com suas credenciais reais):
    ```
    DB_HOST=localhost
    DB_USER=root
    DB_PASSWORD=sua_senha_aqui
    DB_DATABASE=cronicas_de_aventuras
    SECRET_KEY=uma_chave_secreta_muito_longa_e_segura_com_pelo_menos_32_caracteres
    ```
3.  No terminal, na raiz do projeto, execute `npm run dev:backend`.

**Ver se retorna:**
A saída no terminal deve incluir as seguintes linhas:
```
Conexão com o banco de dados estabelecida com sucesso via TypeORM.
Servidor rodando na porta 8071
```

---

### 2. [ ] Tentar cadastrar um novo usuário

**Como fazer:**
Use o `curl` em um novo terminal para enviar uma requisição de registro.
```bash
curl -X POST -H "Content-Type: application/json" -d '{"username": "teste_user", "email": "teste@email.com", "password": "password123", "confirmPassword": "password123"}' https://backend-5e.edsin-server.space/register
```

**Ver se retorna:**
A resposta deve ser um JSON indicando sucesso:
```json
{"message":"Usuário registrado com sucesso. Faça o login para continuar."}
```
*Tente registrar com senhas diferentes ou com um email já existente para validar as mensagens de erro.*

---

### 3. [ ] Criar uma chave de licença no banco de dados

**Como fazer:**
1.  Conecte-se ao seu banco de dados MySQL.
2.  Execute o seguinte comando SQL para inserir uma chave de teste válida. Use uma chave única e fácil de lembrar.
    ```sql
    INSERT INTO license_keys (`key`, `isActive`, `expiresAt`) VALUES ('MINHA-CHAVE-TESTE-123', false, '2025-12-31 23:59:59');
    ```

**Ver se retorna:**
Confirme que a linha foi inserida com sucesso na tabela `license_keys`.

---

### 4. [ ] Tentar logar com o novo usuário

**Como fazer:**
Use `curl` para enviar a requisição de login.
```bash
curl -X POST -H "Content-Type: application/json" -d '{"login": "teste_user", "password": "password123"}' https://backend-5e.edsin-server.space/login
```

**Ver se retorna:**
A resposta deve ser um JSON contendo o token JWT, o ID do usuário e o status da licença como `false`. **Copie os valores de `token` e `userId` para os próximos passos.**
```json
{
    "message": "Login bem-sucedido.",
    "token": "um_token_jwt_longo_aqui...",
    "userId": 1,
    "isLicenseActive": false
}
```

---

### 5. [ ] Ativar a licença do usuário

**Como fazer:**
Use `curl` para enviar a chave de licença para o endpoint de ativação. Substitua `<SEU_TOKEN_JWT>` e `<SEU_USER_ID>` pelos valores obtidos no passo anterior.
```bash
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer <SEU_TOKEN_JWT>" -d '{"userId": <SEU_USER_ID>, "licenseKey": "MINHA-CHAVE-TESTE-123"}' https://backend-5e.edsin-server.space/api/activate-license
```

**Ver se retorna:**
A resposta deve ser um JSON indicando sucesso:
```json
{"message":"Licença ativada com sucesso!"}
```
*Para verificar, tente fazer o login novamente (Passo 4). O valor de `isLicenseActive` agora deve ser `true`.*

---

### 6. [ ] Salvar a Chave da API do Google

**Como fazer:**
Use `curl` para enviar uma chave de API do Google para o endpoint de usuário. Substitua `<SEU_TOKEN_JWT>` e `<SEU_USER_ID>` novamente.
```bash
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer <SEU_TOKEN_JWT>" -d '{"userId": <SEU_USER_ID>, "apiKey": "SUA_CHAVE_API_GOOGLE_AQUI"}' https://backend-5e.edsin-server.space/api/user/google-key
```

**Ver se retorna:**
A resposta deve ser um JSON indicando sucesso:
```json
{"message":"Chave de API do Google salva com sucesso."}
```
*Para verificar, você pode fazer uma requisição GET para `https://backend-5e.edsin-server.space/api/user/google-key?userId=<SEU_USER_ID>` (com o token no cabeçalho) e confirmar que ela retorna a chave correta.*

# Checklist final (executável)

* [X] Criar repo backend TS e configurar lint/tsconfig.
* [X] Configurar TypeORM e entidades.
* [X] Implementar util crypto e testes.
* [X] Implementar auth com registro/login/ativação de licença.
* [ ] Implementar gemini/ai server (genkit flows).
* [ ] Implementar gameService REST (sem WS) e testes.
* [ ] Adicionar Redis e implement redisService.
* [ ] Implementar WebSocket server e integração com gameService + Redis locks.
* [ ] Adicionar monitoramento e alertas.
* [ ] Planejar rollout progressivo com feature-flag.


# Observações, mudanças...




    