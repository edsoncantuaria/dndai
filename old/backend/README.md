# Backend PENAI — Crônicas de Aventuras

Runtime único do jogo: **Fastify** + **PostgreSQL** + **Temporal** + WebSocket v2.

Entrypoint: `src/penaiServer.ts` · Domínio: `src/GameMaster/` · Worker: `src/temporalWorkerMain.ts`

> Corte legado (MySQL/BullMQ/Express): **ADR 0002** · Ecossistema: [`docs/ECOSSISTEMA.md`](../docs/ECOSSISTEMA.md)

## Stack

| Camada | Tecnologia |
|--------|------------|
| HTTP/WS | Fastify 5, `@fastify/websocket`, JWT |
| ORM | TypeORM → PostgreSQL (`PenaiDataSource`) |
| Fila narração | Temporal workflow `penai-narration` |
| IA | Google Gemini (BYOK jogador + adapters em `GameMaster/adapters/gemini/`) |
| Cache | Redis (SRD cache, WS pub/sub) |
| Vetor | Qdrant (memória narrativa, opcional) |

## Dev local

Na **raiz** do monorepo:

```bash
npm run dev:local                    # Postgres :5433, Redis :6381, Temporal
npm run penai:db:prepare --prefix backend
cd backend && npm run dev:penai      # API :8071
cd backend && npm run worker:temporal   # se SKIP_TEMPORAL_WORKER=true no .env
```

Ou tudo junto: `npm run dev:all` (Docker hot reload).

## Configuração

Copie `backend/.env.penai.example` → `backend/.env` (ou use vars da raiz via `scripts/loadEnv`).

Essenciais:

```env
DATABASE_URL=postgresql://penai:penai@localhost:5433/penai
REDIS_URL=redis://localhost:6381
TEMPORAL_ADDRESS=localhost:7233
JWT_SECRET=...
SKIP_TEMPORAL_WORKER=false   # true = narração síncrona no processo API (testes)
AI_PLATFORM_BILLING_ENABLED=false   # BYOK — chave Gemini do jogador na UI
```

Licença dev: `npm run seed:penai-license --prefix backend -- TESTE-1`

## Scripts npm

| Script | Uso |
|--------|-----|
| `dev:penai` | API com hot reload (`tsx watch`) |
| `worker:temporal` | Worker Temporal (narração, pulso, canon) |
| `penai:db:prepare` | Migrations + seed mundo |
| `penai:migration:run` | Só migrations Postgres |
| `penai:smoke` / `penai:smoke:byok` | Smoke HTTP/WS |
| `test` | Unitários (+ integração se Postgres up) |
| `test:all` | Suite completa |

## Testes

```bash
REDIS_URL=mock npm test --prefix backend
```

Integração Postgres: sobe `npm run dev:local` ou exporte `DATABASE_URL` apontando para `:5433`. Sem Postgres, specs `*(integration)*` são **skipped** automaticamente.

## API v2 (resumo)

- Auth: `POST /api/v2/auth/register`, `login`, `GET /me`
- Sessões: `POST /api/v2/sessions`, WS `/ws?token=<jwt>`
- SRD/homebrew: `GET /api/v2/data/*`, `/api/v2/homebrew/*`
- Health: `GET /api/v2/health`

Contrato WS: mensagens planas v2 (`mechanicalStateUpdate`, `gameStateUpdate` com `mechanical`, `storyFeed`, …) — ver `docs/architecture/ws-pipeline-temporal.md`.

## Seeds

```bash
npm run penai:seed:srd-ptbr --prefix backend
npm run seed:penai-world --prefix backend
```

Detalhe SRD PT-BR: [`docs/DATA_SRD.md`](../docs/DATA_SRD.md).
