# PENAI — Migração e fim do legado

**Última revisão:** maio/2026

## Decisão de produto

**Sessões MySQL antigas não são migradas automaticamente.** O motor PENAI (Postgres + Fastify + WS v2) é o único caminho de gameplay.

## O que mudou (greenfield)

| Antes (legado) | Agora (PENAI) |
|----------------|---------------|
| `POST /api/sessoes` + `characterId` MySQL | `POST /api/v2/sessions` + `heroName` / `heroWorldEntityId` |
| `GET /api/sessoes/:id` + `/characters/:id` | `GET /api/v2/sessions/:id` + `/mechanical` |
| WS Express `processAction` | WS Fastify `/ws?token=<JWT>` |
| `Character.gameClock` MySQL | `game_sessions.gameClock` JSONB |
| `GET /sessoes/:id/world-map` | `GET /api/v2/sessions/:id/world-map` |
| `GET /sessoes/:id/facts` | `GET /api/v2/sessions/:id/summary` |
| Auth/homebrew/cofre Express | `/api/v2/auth`, `/v2/homebrew`, `/v2/characters` |
| Licenças Express | `/api/v2/licenses` |
| TTS Express | `/api/v2/tts/*` |
| Narração BullMQ inline | Temporal `penai-narration` |

## Calendário do jogo (relógio narrativo)

Persistido em **`game_sessions.gameClock`**: `{ day, hour, weather }`.

- **Início:** dia 1, 08:00, clima `clear`
- **Viagem:** avança `durationHours` da rota canônica
- **Descanso:** curto +1h, longo +8h
- **UI:** `worldState.timeOfDay`, `DailyRecapPanel` (“Dia N · Manhã”), mechanical pack

Motor avança o relógio — a IA **não** é fonte de verdade para tempo/clima.

## Migrar dados manualmente (opcional)

Se precisar recuperar uma campanha MySQL:

1. Exportar nome do herói, região atual e último `gameClock` do dump
2. `POST /api/v2/sessions` com `heroName`
3. Ajustar `currentRegionSlug` e `gameClock` via SQL ou script admin
4. Reconstruir memória narrativa a partir de logs exportados (fora do escopo automático)

**Não há script de migração one-click** — campanhas antigas são arquivo morto.

## Limpeza de código (estado atual — maio/2026)

| Removido | Substituto |
|----------|------------|
| `backend/src/server.ts` | `penaiServer.ts` |
| `action-pipeline/`, `queue/`, `websocket/` | GameMaster WS + Temporal |
| `/api/auth`, `/api/characters`, `/api/homebrew` Express | `/api/v2/auth`, `/v2/characters`, `/v2/homebrew` |
| `backend/src/routes/*.ts` (Express órfãos) | Removidos — só Fastify v2 |
| Branch MySQL em `loadGameSession` | Sempre `loadPenaiGameSession` |
| `webSocketService`, `useGameWebSocket`, `useGameActions` | `usePenaiTurnPipeline` + JWT WS |
| Cofre MySQL | `world_entities.isVaultTemplate` + `/v2/characters` |

### Comandos (único stack)

```bash
npm run dev:penai          # backend Fastify :8071
npm run worker:temporal    # narração
npm run dev                # frontend Next
```

## Próximos passos (P2)

1. Migração manual de homebrew MySQL → Postgres (script one-off)
2. Replay mecânico avançado (projector completo)
3. Qdrant recall default-on (opcional prod)

Ver também: [`PENAI.md`](./PENAI.md), [`ECOSSISTEMA.md`](./ECOSSISTEMA.md).
