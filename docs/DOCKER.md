# Docker — guia de uso

## Você precisa dar `build` o tempo todo?

**Não**, se estiver desenvolvendo UI ou backend.

| Modo | Quando usar | Rebuild? |
|------|-------------|----------|
| **Dev local** (recomendado) | Mexendo no código todo dia | Só na 1ª vez (`npm install`) |
| **Stack full em Docker** | Testar deploy / demo | Sim, quando mudar código (`--build`) |
| **Dev no Docker** | Quer tudo em container com hot reload | 1ª vez; depois só volumes |

---

## Desenvolvimento diário (recomendado)

Infraestrutura no Docker, app no seu Node com **hot reload**:

```bash
# 1) Uma vez
cp .env.example .env
cp .env.local.example .env.local
cp backend/.env.example backend/.env
# Edite GEMINI_API_KEY, JWT_SECRET em backend/.env

npm install
npm run install:backend

# 2) Subir MySQL + Redis + SRD (sem build do app)
npm run dev:infra

# 3) Dois terminais — salvou o arquivo, recarrega sozinho
npm run dev:backend    # :8071
npm run dev              # :9002
```

`backend/.env` para dev local:

```env
DB_HOST=localhost
DB_PORT=3306
REDIS_URL=redis://localhost:6379
SRD_API_BASE=http://localhost:3000/api/2014
```

Parar infra: `docker compose down` (dados do MySQL ficam no volume).

---

## Stack completa em container (produção / teste)

Só quando quiser simular deploy. **Aí sim** precisa `--build` após mudar código:

```bash
docker compose --profile full up -d --build
# ou: npm run docker:up
```

---

## Hot reload dentro do Docker (opcional)

```bash
npm run dev:infra    # infra primeiro
npm run dev:docker   # backend + frontend com volumes (1º start instala node_modules no volume)
```

Mais lento no primeiro boot; útil se não quiser Node no host.

---

## URLs

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:9002 |
| Backend | http://localhost:8071/api/health |
| WebSocket | ws://localhost:8071/ |
| SRD API | http://localhost:3000/api/2014 |

---

## Comandos

```bash
npm run dev:infra      # só infra
npm run docker:logs
npm run docker:down
docker compose down -v # apaga banco (reset)
```

---

## Mapa / spawn pool (novas sessões)

Ao criar uma aventura, o backend precisa de **cidades marcadas como spawn pool** (mapa do mundo).

| Modo | O que acontece |
|------|----------------|
| **Stack full** (`--profile full`) | No **entrypoint** do container: migrações → `ensureSpawnRegions` → servidor. Mapa padrão (`regionsSeed.json`) é importado se o MySQL estiver vazio. |
| **backend-dev** (`dev:docker`) | Mesmo entrypoint na 1ª subida; código em `backend/src` via volume. |
| **dev local** (`dev:backend`) | `server.ts` chama o mesmo bootstrap na subida. |

Depois de mudar o backend, **rebuild** na stack full:

```bash
docker compose --profile full up -d --build backend
```

Seed manual (reimportar mapa inteiro — apaga e recria regiões):

```bash
docker compose --profile full exec backend npx tsx src/scripts/seedRegions.ts
```

Só garantir spawn (sem apagar POIs/links):

```bash
docker compose --profile full exec backend npx tsx src/scripts/ensureSpawnRegions.ts
```

Com `backend-dev`:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev exec backend-dev npx tsx src/scripts/ensureSpawnRegions.ts
```

Se aparecer *"Nenhuma cidade está marcada como spawn pool"*, confira os logs do backend:

```bash
docker compose logs backend --tail 80
# ou: docker compose logs backend-dev --tail 80
```

Deve constar `[entrypoint] Spawn pool OK.` ou `[Startup] Spawn pool de cidades pronto.`
