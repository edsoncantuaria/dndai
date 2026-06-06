# ADR 0002: Corte PENAI-only (remoção MySQL/BullMQ/Express)

Status: Accepted  
Data: 2026-06-06

## Contexto

O repositório mantinha dois runtimes paralelos:

- **PENAI** (ativo): `penaiServer.ts` → Fastify `/api/v2` → `GameMaster/*` → PostgreSQL + Temporal + WS contract v2.
- **Legado** (morto no código): Express, TypeORM/MySQL (`AppDataSource`), BullMQ, `actionService` → `narration/*`, worker `narrationWorkerMain.ts`.

Homologação (Cloudive) ainda não estava em produção final; não havia migração de dados MySQL→Postgres em curso. Manter o legado gerava imports quebrados, docs contraditórias e custo de manutenção.

## Decisão

**Corte limpo PENAI-only** (jun/2026):

1. **Infra:** `docker-compose.yml` só auxiliares (SRD, MinIO, Piper); stack de app = `docker-compose.penai.yml` (+ `cloudive` para homolog).
2. **Backend:** remover entidades MySQL, `actionService`, fila BullMQ, Genkit/OSS morto, `websocket/` legado; consolidar billing/auth/WS em Postgres + JWT.
3. **Frontend:** remover componentes órfãos v1; protocolo WS v2 sem fallback `msg.payload`; BYOK único via `geminiApiKeyStorage`.
4. **Docs:** `ECOSSISTEMA.md` e gaps apontam só PENAI; ADR 0002 referenciado no topo.

Sem migração de dados legados — sessões novas nascem em Postgres.

## Consequências

- Comandos canônicos: `npm run dev:local`, `npm run dev:all`, `npm run dev:penai`, `npm run worker:temporal`.
- Testes de integração exigem Postgres (CI); unitários rodam com `REDIS_URL=mock`.
- Referências históricas a BullMQ/MySQL em §4–5 do ECOSSISTEMA ficam marcadas como **arquivo histórico** até poda editorial futura.

## Alternativas consideradas

| Alternativa | Motivo rejeição |
|-------------|-----------------|
| Migração MySQL→Postgres antes do corte | Sem prod; homolog PENAI-only |
| Manter Express em profile Docker `full` | Worker/narração já quebrados; duplicação |
| Feature flag `ALLOW_LEGACY_MYSQL` | Violava invariante “PENAI canônico sem flags” |
