# Checklist de validação (métricas §8 do TODO)

Use em sessão de teste manual ou QA após mudanças no pipeline / motor.

## Cobertura automatizada

Antes do QA manual, rode:

```bash
cd backend && REDIS_URL=mock npm test
```

| Métrica §8 | Testes |
|------------|--------|
| Roll guard / narration_only | `successMetrics.spec.ts`, `aiSanitizer.spec.ts`, `aiPipeline.spec.ts` |
| Prompt enxuto | `successMetrics.spec.ts` (§8.3), `promptSections.spec.ts` |
| Homebrew fork | `successMetrics.spec.ts`, `homebrewMergeService.spec.ts` |
| Mapa / POIs | `successMetrics.spec.ts`, `memoryLayer.spec.ts` |
| Facts | `successMetrics.spec.ts`, `memoryLayer.spec.ts` |
| Inventário motor | `inventoryMotor.spec.ts`, `successMetrics.spec.ts` |
| stateVersion / WS | `actionFlow.e2e.spec.ts`, `wsActionPipeline.integration.spec.ts` |

Itens só validáveis em sessão real: persistência após reabrir aba, latência &lt; 30s, UI do mapa, facts entre campanhas.

## Preparação

- [ ] `docker compose` com MySQL + Redis + SRD API
- [ ] `backend/.env` com `AI_PIPELINE_MODE=narration_only` (padrão)
- [ ] Personagem criado e sessão iniciada via UI
- [ ] API key Gemini configurada na conta

## Persistência de sessão

- [ ] Fechar aba e reabrir a mesma sessão
- [ ] HP e condições iguais ao fechar
- [ ] Inventário e moedas iguais
- [ ] Região / POI no mapa coerentes
- [ ] Entradas do journal preservadas

## Rolagens (50 turnos sugeridos)

- [ ] Nenhum `playerRollRequest` aparece sem ação do motor que exija rolagem
- [ ] Banner "Abrir dados" só quando há rolagem pendente real
- [ ] Modificador da rolagem bate com atributos da ficha

## Performance

- [ ] Tempo médio de resposta IA < 30s em turnos normais (sem geração de imagem)
- [ ] Logs do backend sem retries excessivos de validação

## Homebrew fork SRD

- [ ] Criar homebrew derivado de magia SRD (ex.: variante de Fireball)
- [ ] Instalar na sessão e usar em combate ou narrativa
- [ ] Nome aparece nas opções sem duplicar entrada oficial

## Mapa

- [ ] Viajar para região adjacente válida atualiza `currentRegion`
- [ ] Entrar em POI válido atualiza sublocal
- [ ] Tentativa inválida gera nota em `systemLog` sem corromper posição

## Memória / facts

- [ ] Facts aceitos pela validação aparecem em turno posterior (mesma campanha)
- [ ] Facts rejeitados não poluem o prompt (nota no systemLog)

## Inventário autoritativo (motor)

- [ ] Equipar item via intent atualiza ficha sem mutação otimista incorreta
- [ ] `claim-loot` consome oferta pendente e atualiza inventário
- [ ] Drop/remove reflete no próximo `gameStateUpdate`

## Registro

Data: ___________  
Versão / branch: ___________  
Observações: ___________
