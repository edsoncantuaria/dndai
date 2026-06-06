# Arquitetura — módulos de referência

Deep-dives por domínio, **confirmados no código** (jun/2026). Complementam os documentos vivos — não os substituem.

| Módulo | Escopo | Doc vivo principal |
|--------|--------|-------------------|
| [ws-pipeline-temporal.md](./ws-pipeline-temporal.md) | WS PENAI v2, motor síncrono, Temporal, relay Redis | `ECOSSISTEMA.md` §8–9 |
| [ai-gemini-penai.md](./ai-gemini-penai.md) | Gemini structured, actionSense, narration_only, BYOK | `ECOSSISTEMA.md` §10, `PENAI.md` |
| [auth-billing-byok.md](./auth-billing-byok.md) | JWT, v2 auth, licença, créditos, onboarding | `ECOSSISTEMA.md` §19 |
| [memory-rag.md](./memory-rag.md) | Qdrant, Postgres SessionMemory, legado MySQL | `ECOSSISTEMA.md` §14 |
| [motor-combat-dm.md](./motor-combat-dm.md) | Motor SRD, FSM combate, roll chain, DM pré-LLM | `ECOSSISTEMA.md` §6–7 |
| [frontend-turn-pipeline.md](./frontend-turn-pipeline.md) | usePenaiTurnPipeline, GameplayShell, InputGate | `DESIGN_FRONTEND.md` §7–8 |

**Runtime canônico:** PENAI (`penaiServer.ts`, Fastify, Postgres, Temporal). Stack legado Express/MySQL/BullMQ permanece no repo — ver gaps.

**Manutenção:** ao mudar comportamento, atualizar **módulo + doc vivo + diagrama**. Skill: `dndai-documentation`.
