# Gaps arquiteturais e dívida técnica

Registro **operacional** de riscos e melhorias — detalhe de design continua em `docs/ECOSSISTEMA.md`, módulos `docs/architecture/` e roadmap em `TODO-ARQUITETURA.md`.

**Última revisão:** 2026-06-06 (auditoria multitask 6 domínios)

---

## Como usar

- Novo gap: bullet com **severidade** (P0–P3), **área**, **evidência** (arquivo/linha ou sintoma), **ação sugerida**.
- Item resolvido: mover para seção **Resolvido** com data ou marcar em `TODO-ARQUITETURA.md`.

---

## Abertos

| Sev | Área | Gap | Evidência / nota |
|-----|------|-----|------------------|
| **P1** | Docs | §4–5, §9, ApC descrevem BullMQ; runtime PENAI usa Temporal | `penaiServer.ts` vs ECOSSISTEMA legado — ver `architecture/ws-pipeline-temporal.md` |
| **P1** | Código | `backend/src/websocket/`, `queue/`, `action-pipeline/` ausentes em `src/` | Imports legados quebrados; relay atual = `wsPubSub.ts` |
| **P1** | Memória | Dois stacks paralelos PENAI Postgres vs MySQL legado | `turnPipeline.ts` vs `vectorMemoryService.ts`; coleções Qdrant distintas |
| **P1** | Memória | `buildNarrationContext` / `persistNarrationTurn` órfãos no hot path | Zero callers no turno PENAI |
| **P1** | Auth/WS | Fallback `?userId=` sem JWT | `wsHandlers.ts` `resolveWsUserId` — impersonação dev |
| **P1** | Motor | Dois stacks PENAI vs Express `actionService` | Persistência Postgres vs MySQL |
| **P2** | Docs | MOM `ia-gemini-adjudication.md` aponta paths inexistentes | Real: `adapters/gemini/actionSense.ts` — ADR 0001 |
| **P2** | IA | actionSense ignora BYOK do usuário | `actionSense.ts` usa `GEMINI_API_KEY` plataforma |
| **P2** | WS relay | Doc/MOM citam `wsUserRelay`; produção usa `wsPubSub` | Canal `penai:ws:user` vs `dndai:ws:user` |
| **P2** | Protocolo | Apêndice A assume envelope `{type,payload}` v1 | PENAI mensagem plana v2 |
| **P2** | Docs | Apêndice D / §14 citam OpenRouter embed | Implementação Gemini-only |
| **P2** | Frontend | `dedupeSensoryTail` não wired no feed | Só `narrationText.spec.ts` |
| **P2** | Frontend | Dupla fonte loading: slices + PENAI phase | `newUseGameState` vs `usePenaiTurnPipeline` |
| **P2** | Frontend | Duas chaves sessionStorage bootstrap | `penaiOpening` vs `penaiBootstrap` |
| **P2** | Auth | UI BYOK vs debit créditos se billing on | `AiBillingSection` vs `turnPipeline.ts` |
| **P2** | Auth | `authService.ts` MySQL duplicado sem uso v2 | Rotas v2 → `penaiAuthService` |
| **P2** | Dev UX | `.next/` root-owned Docker | `NEXT_DIST_DIR=.next-dev` |
| **P3** | Memória | Snapshot Redis não integrado PENAI | `narrativeSnapshotService` via path órfão |
| **P3** | API | `atomicFacts` REST lê MySQL; turno PENAI grava Postgres | Painel campanha desatualizado |
| **P3** | Frontend | `turnPipelineStore` pub/sub manual vs XState | Skill F.1 |
| **P3** | BYOK | Três fontes: localStorage + DB + legado settings | Consolidar |

---

## Resolvido (recente)

| Data | Gap | Resolução |
|------|-----|-----------|
| 2026-06-06 | Doc sistema fragmentado / desatualizado vs PENAI | Módulos `docs/architecture/*` + §19 ECOSSISTEMA + ADR 0001 |
| 2026-05-29 | Worker WS sem relay API | `wsPubSub.ts` (PENAI); legado `wsUserRelay` removido de `src/` |
| 2026-05-29 | `sendMessage` ausente no WS hook | Import corrigido (legado) |
| 2026-05-29 | `authToken` vs `token` no Settings | `src/lib/authToken.ts` |
| 2026-05-29 | MOM adjudicação Gemini monolítica | **Retificado:** ADR 0001 — actionSense × motor; MOM entry superseded |

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
