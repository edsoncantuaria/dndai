# ADR 0001: actionSense (plausibilidade LLM) × motor autoritativo

**Status:** Accepted  
**Data:** 2026-06-06  
**Contexto:** MOM e gaps anteriores referenciavam `gmAdjudicationBridge` e schema `proceed|needs_roll|blocked|clarify` — **não implementados**. Código PENAI separa camadas.

## Decisão

1. **Gemini actionSense** julga apenas **tentabilidade narrativa** (`acceptable` / `reason`) em intents `free`/`social`, após heurísticas determinísticas em `motor/actionSense.ts`. Não emite `playerRollRequest` nem altera HP/inventário.

2. **Rolagens e bloqueios mecânicos** ficam exclusivamente no **motor SRD** (`RuleCheckStatus`, `rulesBridge`). WS expõe `actionRejected`, `playerRollRequest`, `mechanicalStateUpdate` — não um enum único de adjudicação LLM.

3. **Chave de inferência:** actionSense, narração, actionOptions e bootstrap usam `resolveInferenceApiKey(userId)` → `resolveGeminiApiKey(userApiKey)` (BYOK primeiro, depois plataforma).

4. **Indisponibilidade do árbitro:** intents `free`/`social` **fail-closed** sem `canInfer`; falha de API em prod ou `GEMINI_FAIL_CLOSED=1` rejeita a ação. Narração aborta turno sem texto fictício se sem chave.

5. **Créditos:** 1 crédito por turno narrado (`consumePenaiNarrationCredit`); actionSense no mesmo `processAction` **não** debita de novo (bundled).

## Consequências

- Não reintroduzir schema monolítico `adjudication.verdict` no JSON de narração.
- Documentação: `architecture/ai-gemini-penai.md`, `architecture/auth-billing-byok.md`, ECOSSISTEMA §10/§19.

## Referências

- `GameMaster/adapters/gemini/actionSense.ts`
- `GameMaster/motor/validateAndApply.ts`
- `GameMaster/motor/actionSense.ts`
