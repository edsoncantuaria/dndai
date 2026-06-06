# ADR 0001: actionSense (plausibilidade LLM) × motor autoritativo

**Status:** Accepted  
**Data:** 2026-06-06  
**Contexto:** MOM e gaps anteriores referenciavam `gmAdjudicationBridge` e schema `proceed|needs_roll|blocked|clarify` — **não implementados**. Código PENAI separa camadas.

## Decisão

1. **Gemini actionSense** julga apenas **tentabilidade narrativa** (`acceptable` / `reason`) em intents `free`/`social`, após heurísticas determinísticas em `motor/actionSense.ts`. Não emite `playerRollRequest` nem altera HP/inventário.

2. **Rolagens e bloqueios mecânicos** ficam exclusivamente no **motor SRD** (`RuleCheckStatus`, `rulesBridge`). WS expõe `actionRejected`, `playerRollRequest`, `mechanicalStateUpdate` — não um enum único de adjudicação LLM.

3. **Indisponibilidade do árbitro:** permissivo em dev; `GEMINI_FAIL_CLOSED` opcional em prod. Narração exige chave resolvível (BYOK ou plataforma) e aborta turno sem texto fictício.

## Consequências

- Não reintroduzir schema monolítico `adjudication.verdict` no JSON de narração.
- Documentação: `architecture/ai-gemini-penai.md`, ECOSSISTEMA §10.
- **Gap aberto:** actionSense usa `GEMINI_API_KEY` plataforma, não BYOK do jogador.

## Referências

- `GameMaster/adapters/gemini/actionSense.ts`
- `GameMaster/motor/validateAndApply.ts`
- `GameMaster/motor/actionSense.ts`
