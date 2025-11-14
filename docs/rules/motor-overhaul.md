# Motor Overhaul – Ciclo Autoritativo

## Pipeline Atual
1. **Frontend** (`processPlayerAction` em `useNewGameState.ts`)
   - Coleta `prompt/intent`, trava a UI (`actionPhaseLabel`) e envia todos os metadados (`clientInstanceId`, `actionCursor`).
   - Ignora intents se não houver sessão/`apiKey`.
2. **Backend – Ingresso** (`webSocketServer.ts` / `actionService.ts`)
   - Valida contrato (`ProcessActionSchema`), garante lease/`actionPhase` estritos e bloqueia se houver `playerRollRequest` pendente.
   - Fases obrigatórias: `RECEIVED → NORMALIZED → RULES → AI_SYNTHESIS → DELTA_APPLIED`.
3. **Motor SRD / IA** (`aiService.ts`)
   - Gera deltas e, quando necessário, `playerRollRequest` (nunca resolve a cena antes do jogador rolar).
4. **Sanitização e aplicação** (`aiSanitizer.ts`, `stateDeltaService.ts`)
   - Normaliza payload, duplica guard-rails (logs coerentes, action options vazios enquanto existe rolagem) e aplica delta/metrics.
5. **Retorno ao Frontend**
   - `actionResolution`/`gameStateUpdate` atualizam `stateVersion`, desbloqueiam UI ou exigem `submitRollResult`.

## Invariantes Reforçados
- Toda ação arriscada **deve** gerar `playerRollRequest` antes de liberar narrativa. (`aiSanitizer` agora substitui `logEntries`/`actionOptions` por um aviso quando a IA retorna um pedido.)
- Enquanto existir `playerRollRequest`, o frontend mantém `isActionLocked` e exibe apenas instruções do motor.
- Contrato REST/WS continua idêntico: `playerRollRequest` é autoritativo; clientes nunca inventam dados.
- Em caso de falha/timeout, `useNewGameState` ressincroniza a sessão (`loadGameSession`) automaticamente — não ficam mais “logs fantasmas”.

## Arquivos Sensíveis
- `backend/src/services/aiSanitizer.ts`: normalização e guard-rail de logs/rolagens.
- `backend/src/services/aiService.ts`: prompt e pós-processamento (`recoveredSections`, `playerRollRequest`, failover de modelo).
- `backend/src/schemas/processActionSchema.ts` + `docs/rules/contracts.md`: definem contrato único (REST/WS).
- `src/hooks/newUseGameState.ts` / `src/components/ActionOptions.tsx`: bloqueios de UI, reconciliação e mensagens para o jogador.

## Ações Concluídas (14/11)
- `aiSanitizer`: logEntries/actionOptions são zerados e substituídos por aviso sempre que `playerRollRequest` existir (garante ciclo Motor → Jogador → Motor).
- Teste `aiSanitizer.spec.ts` cobre o guard-rail.
- Frontend auto-recarrega sessão em timeouts/erros, mantendo estado coerente com o backend.

## Próximos Passos Sugeridos
1. **Prompts da IA** (`aiService.ts`)
   - Reforçar instruções para não retornar narrativa antes da rolagem.
   - Validar `systemLog` descrevendo explicitamente qual perícia/atributo o jogador deve usar.
2. **Schemas / Contracts**
   - Documentar no `contracts.md` que `logEntries` fica limitado a mensagens `system` enquanto existe `playerRollRequest`.
   - Incluir exemplos de resposta “needs_roll”.
3. **Front**
   - Adicionar CTA explícito quando houver `playerRollRequest` (ex.: botão “Resolver rolagem”) no log.
4. **Observabilidade**
   - Métricas para `playerRollRequest` descartado / “roll fantasma” (`rollMetricsService`).
