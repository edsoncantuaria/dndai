# Dados SRD — caminho único PENAI

> **Regra:** toda leitura de conteúdo D&D 5e SRD no app passa por **`GET /api/v2/data/:resource`** (backend `unifiedDataService`). O frontend usa `dndApiService` → `/v2/data` — **não** chame a 5e-srd-api diretamente na UI.

## Camadas

| Camada | Fonte | Papel |
|--------|-------|-------|
| Oficial EN | `srdApiAdapter` → 5e-srd-api ou snapshot `data/srd/2014/` | Schema e índices canônicos |
| Homebrew PT | Postgres `penai_homebrew_content` bundle `srd-ptbr-core` | Tradução / fork: magias, equipamentos, **monstros**, **features**, raças/classes |
| UI maps | `GET /api/v2/translations` | Rótulos (perícias, raças, classes…) |

## Operação (stack mínima)

| Passo | Comando | Notas |
|-------|---------|-------|
| Postgres | `DATABASE_URL=postgres://…` + `npm run penai:migration:run --prefix backend` | Ou `PENAI_DB_SYNC=true` em dev |
| Seed PT-BR | `npm run penai:import:foundry-bundle --prefix backend` then `npm run penai:seed:srd-ptbr --prefix backend` | Import Foundry cache + seed idempotente; ou `PENAI_SEED_ON_BOOT=true` |
| SRD EN | `SRD_API_BASE=http://localhost:3000/api/2014` + `docker compose -f docker-compose.srd.yml up` | Ou `SRD_OFFLINE_ONLY=true` + `data/srd/2014/` |
| Smoke offline | `npm run penai:smoke:srd-ptbr --prefix backend` | Valida `human.json`, forks elf/high-elf, traits PT |
| Smoke + DB | `DATABASE_URL=… npm run penai:smoke:srd-ptbr --prefix backend` | Inclui seed e contagem do bundle |

### Snapshot SRD offline (Docker e local)

O adapter (`srdApiAdapter`) e os **seeds PT-BR** (`buildFoundrySrdPtBrTranslations`, forks raça/trait) resolvem o diretório via `requireSnapshotDir()` em `backend/src/utils/srdSnapshotPaths.ts`:

| Ordem | Caminho (cwd = `/app` no Docker dev) |
|-------|--------------------------------------|
| 1 | `$SRD_SNAPSHOT_DIR` (override explícito) |
| 2 | `./srd-data/srd/2014/normalized` ← **volume `./data` no compose dev** |
| 3 | `./data/srd/2014/normalized` (legado backend/data — vazio no Docker) |
| 4 | `../data/srd/2014/normalized` (repo local ao rodar `npm run dev:penai` na pasta backend) |

Se o snapshot não existir, `PENAI_SEED_ON_BOOT` loga aviso e **pula** `seedSrdPtBrHomebrew` — rode `penai:import:foundry-bundle` + confirme que `./data/srd/2014/normalized/spells.json` está montado.

**Checklist manual (~5 min):** registrar → `installedHomebrewIds` contém `srd-ptbr-core`; login de conta legada também instala o bundle; `GET /api/v2/data/races` retorna nomes PT; criar Alto Elfo Mago → cofre → nova sessão → magias no load.

## Seed e tradução PT-BR

```bash
# Importar compendiums Foundry + overrides de raça (obrigatório antes do seed offline / CI sem rede)
npm run penai:import:foundry-bundle --prefix backend
# ou só overrides de raça:
npm run penai:import:foundry-overrides --prefix backend
npm run penai:validate:phb-overrides --prefix backend

# Seed idempotente no Postgres (usa cache em backend/.tmp/foundry-decito/)
npm run penai:seed:srd-ptbr --prefix backend
```

Overrides versionados: `backend/data/srdPtBr/overrides/{resource}/{index}.json`

**Fonte recomendada:** [decito/dnd5e-pt-br](https://github.com/decito/dnd5e-pt-br) — tradução SRD CC BY 4.0 para Foundry VTT (campos mecânicos: idade, tendência, tamanho, idiomas). Lore longa do Livro do Jogador não faz parte do SRD; alternativa futura: [Artifício RPG SRD 5.2 PT](https://artificiorpg.com/dd/dnd-srd-52-portugues-download/).

## Legado MySQL (deprecated)

| Comando antigo | Substituto |
|----------------|------------|
| `npm run seed:data` | `npm run penai:seed:srd-ptbr` |
| homebrew em MySQL | `npm run penai:migrate:homebrew-mysql` (one-shot) |

## Cofre de heróis vs campanha

- **`PUT /api/v2/characters/:id`** atualiza o **template** no cofre (`isVaultTemplate=true`).
- Ao **criar sessão**, `cloneVaultHeroToSession` copia snapshot — campanhas **em andamento não mudam**.
- `templateRevision` incrementa a cada edição do cofre.

## Oficina / homebrew

Schema compatível com 5e-srd-api (`sourceIndex`, `official_index`, `sourceKind`). Referência de tipos: `backend/src/types/homebrewSource.ts`. Importação SRD: `POST /api/v2/homebrew/from-srd`.
