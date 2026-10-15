# Gaps arquiteturais e dívida técnica

Registro **operacional** de riscos e melhorias — detalhe de design continua em `docs/ECOSSISTEMA.md`, módulos `docs/architecture/` e roadmap em `TODO-ARQUITETURA.md`.

**Última revisão:** 2026-10-11

---

## Como usar

- Novo gap: bullet com **severidade** (P0–P3), **área**, **evidência** (arquivo/linha ou sintoma), **ação sugerida**.
- Item resolvido: mover para seção **Resolvido** com data ou marcar em `TODO-ARQUITETURA.md`.

---

## Abertos

| Sev | Área | Gap | Evidência / nota |
|-----|------|-----|------------------|
| **P2** | Docs | §4–5, §9, ApC ECOSSISTEMA — histórico BullMQ/MySQL | Podar quando estável; runtime descrito no topo + `architecture/` |
| **P2** | Dev UX | `.next/` root-owned Docker | `NEXT_DIST_DIR=.next-dev` |
| **P3** | Frontend | `turnPipelineStore` pub/sub manual vs XState | Skill F.1 — parcialmente endereçado |
| **P3** | Frontend | `gameService.ts` facade vs `penaiApi` direto | Tipos movidos para `src/types/worldMap.ts`; migrar imports gradualmente |
| **P3** | Frontend | `tsc --noEmit` — ~261 erros fora paths PENAI | Gate `typecheck:penai` verde; dívida legado utils/SRD |
| **P3** | Engine | Busca semântica é trigrama local + léxico de ofícios, não um modelo | `engine/src/embed.ts`; `DNDAI_EMBED=off` cai no FTS |
| **P3** | App | Raridade e ganchos | `ItemView.rarity` fica null se `props.rarity` não for um nome conhecido; a ficha não inventa cor. Ganchos, boatos e persona continuam fora da visão do jogador (`engine/src/view.ts`) — o diário avisa isso em vez de pedir um campo novo. |

---

## Resolvido (recente)

| Data | Gap | Resolução |
|------|-----|-----------|
| 2026-10-11 | Mestre podia ler outra campanha, escolher o dado, inflar economia e apagar o log no undo | Conector com escopo e allowlist, tetos em `guard.ts`, `rolls.db` append-only. Runtime: `engine/README.md` |
| 2026-06-06 | UI BYOK vs billing créditos | UI BYOK-only; `clientAiAccess` sem ramo platform credits |
| 2026-06-06 | Snapshot Redis não integrado PENAI | Won't fix — Postgres `session_snapshots` + Qdrant; Redis só pub/sub WS |
| 2026-06-06 | Dupla fonte loading F.1 | `isLoading` derivado de `turnPipelinePhase`; removido `setIsLoading` PENAI |
| 2026-06-06 | Backend `tsc --noEmit` | 0 erros via `npm run build --prefix backend` |
| 2026-06-06 | `backend/README.md` desatualizado (Express/MySQL) | Reescrito PENAI-only |
| 2026-06-06 | Testes falhavam sem Postgres local | `penaiIntegrationDescribe` + fix path `penaiTestDb` |
| 2026-06-06 | actionSense usava GEMINI_API_KEY com billing off | `resolveGeminiApiKey` fail-closed BYOK |
| 2026-06-06 | `queue/`, `action-pipeline/`, `websocket/` ausentes | Removidos imports legados; relay = `wsPubSub.ts` |
| 2026-06-06 | Dois stacks memória MySQL vs Postgres | MySQL stack removido; memória = Postgres + Qdrant PENAI |
| 2026-06-06 | Fallback WS `?userId=` | `wsHandlers.ts` — só JWT `?token=` |
| 2026-06-06 | `authService.ts` MySQL duplicado | Rotas v2 → `penaiAuthService` / Postgres |
| 2026-06-06 | Frontend `dedupeSensoryTail` não wired | `PenaiStoryFeed.tsx` |
| 2026-06-06 | Duas chaves sessionStorage bootstrap | Removido `penaiBootstrap`; canônico `penaiOpening` |
| 2026-06-06 | Protocolo WS v1 `msg.payload` no frontend | Removido de `usePenaiTurnPipeline` / `penaiMechanicalHydrate` |
| 2026-06-06 | BYOK três fontes (OpenRouter legado) | `geminiApiKeyStorage` único; removido `aiApiKeyStorage` |
| 2026-06-06 | Docker profile `full` MySQL | Compose PENAI-only + Cloudive homolog |
| 2026-06-06 | actionSense ignorava BYOK do jogador | `resolveInferenceApiKey` no motor + adapter |
| 2026-06-06 | Death saves / game over | `rules/deathSaves.ts`, `HeroDeathScreen` |
| 2026-06-06 | Retry LLM empilhava Gemini | single-attempt + stale turn skip |
| 2026-06-06 | Doc fragmentado vs PENAI | Módulos `docs/architecture/*` + ADR 0001/0002 |

---

## Documentação gerada (jun/2026)

| Módulo | Arquivo |
|--------|---------|
| WS + Temporal | `architecture/ws-pipeline-temporal.md` |
| IA Gemini | `architecture/ai-gemini-penai.md` |
| Auth/BYOK | `architecture/auth-billing-byok.md` |
| Memória RAG | `architecture/memory-rag.md` |
| Motor/Combate | `architecture/motor-combat-dm.md` |
| Frontend turno | `architecture/frontend-turn-pipeline.md` |
| Corte legado | `adr/0002-penai-only-cut.md` |
