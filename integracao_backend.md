
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

## Fase 1 — API REST mínima + Autenticação e Ativação de Licença (Revisado)

*   **[X] Implementar endpoint de registro (`/register`):**
    *   Aceita `username`, `email`, `password`.
    *   Valida os dados e cria um novo `User` sem licença.
*   **[X] Implementar endpoint de login (`/login`):**
    *   Aceita `login` (pode ser username ou email) e `password`.
    *   Valida as credenciais.
    *   Retorna `userId` e um status `isLicenseActive` (boolean) para o frontend.
*   **[X] Implementar endpoint de ativação de licença (`/api/activate-license`):**
    *   O frontend chamará este endpoint se `isLicenseActive` for `false` após o login.
    *   Aceita `userId` e `licenseKey`.
    *   Valida a chave no banco de dados: verifica se existe, se não está em uso e se a data de expiração (`expiresAt`) é futura em relação à data atual do servidor.
    *   Se a chave for válida, associa-a ao `userId`, marca-a como `isActive: true` e salva.
    *   Retorna sucesso ou falha na ativação.
*   **[Próximo Passo]** Endpoint `/api/user/google-key` para o usuário salvar/atualizar sua `google_api_key` (ser criptografada e armazenada no DB).

### Preparação e Status do Frontend

*   **Situação Atual:** O frontend **NÃO** está atualmente integrado com a nova API de backend. Toda a lógica de criação de personagem, salvamento de jogo e chamadas de IA ainda reside no cliente (nos hooks e contextos de React).
*   **Validação da Fase 1:** Para testar os endpoints de `/register`, `/login` e `/api/activate-license`, é necessário usar uma ferramenta de API como Postman ou `curl`. O frontend ainda não possui as telas ou a lógica para interagir com essas rotas.
*   **Próximos Passos no Frontend:** Para uma integração completa, o frontend precisará:
    1.  Desenvolver uma interface de usuário para registro, login e ativação de licença.
    2.  Criar um contexto de autenticação para gerenciar o estado do usuário (ex: `userId`, `isLicenseActive`).
    3.  Modificar o fluxo do jogo para que, após o login, ele use um token para se comunicar com os futuros endpoints do jogo (Fase 3 em diante).

## Fase 2 — Serviço da IA isolado (Genkit flow server)

* Implementar `geminiService.ts` (ou `aiServer.ts`) que contém definição de flows Genkit (ex.: `gameMasterFlow`).

  * **Opção A (recomendado):** usar `@genkit-ai/express` / `genkit` para expor flows como endpoint HTTP (modo server). Assim o orchestrador chama `POST /flows/gameMasterFlow` com payload e recebe resposta.
  * **Opção B:** incorporar `genkit` direto no backend (mesmo processo). Permite chamadas `ai.generate()` sem HTTP extra.
* Importante: **a chave do usuário deve ser buscada no DB e passada ao plugin googleAI** por chamada dinamicamente — não coloque em env var global.
* Inicialmente faça um flow que apenas **retorna um JSON estático** para validar a conexão do orchesrator com o AI server.

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

```
