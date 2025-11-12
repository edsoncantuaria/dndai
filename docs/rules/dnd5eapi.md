# Integração com dnd5eapi.co (SRD 2014)

## 1. Endpoints Relevantes

| Domínio | Endpoint | Uso | Observações |
| --- | --- | --- | --- |
| Metadados | `/api` | Lista de coleções | Usado para health check |
| Raças/Sub-raças | `/api/races`, `/api/subraces` | Bônus, idiomas, traços | Precisa normalizar trait options |
| Classes | `/api/classes`, `/api/classes/{class}/levels`, `/api/classes/{class}/features` | Hit dice, proficiências, progressão por nível | Endpoint `/levels` cobre slots, habilidades, aptidões |
| Subclasses | `/api/subclasses`, `/api/classes/{class}/subclasses` | Traços de arquétipo | Inclui spells extras |
| Antecedentes | `/api/backgrounds` | Perícias, equipamentos | API inclui tabelas de características |
| Equipamentos | `/api/equipment`, `/api/equipment-categories` | Armas, armaduras, kits | Dados de dano, propriedades, peso |
| Magias | `/api/spells`, `/api/spells/{index}` | Componentes, alcance, duração | Campo `classes`/`subclasses` facilita validação |
| Condições | `/api/conditions` | Efeitos | Texto puro; precisamos resumir em flags |
| Traits/Feats | `/api/traits`, `/api/feats` | Pré-requisitos | Estrutura direta |
| Regras | `/api/rule-sections`, `/api/rules` | Texto SRD | Referência para tooltips/documentação |

## 2. Cobertura x Necessidades

- **Progressão por Nível**: endpoint `/classes/{class}/levels` traz dados completos de proficiência, características, slots, mas não inclui recursos custom (ex.: Foco Arcano). Podemos derivar do texto.
- **Equipamentos**: armas, armaduras e itens possuem custo/peso/dano suficientes para cálculos de carga e ataques.
- **Magias**: dados contêm `concentration`, `ritual`, `casting_time`, `dc` (quando aplicável) – adequados para o engine.
- **Condições**: somente descrição textual. Precisaremos mapear manualmente para flags (ex.: `restrained` → `speed=0`, `disadvantage attacks`).
- **Regras Gerais**: `/rules` é útil para exibir help, mas não substitui o motor – cálculos ainda serão implementados por nós.

## 3. Estratégia de Consumo

1. **Camada de Cliente**: `src/services/dndApiService.ts` já existe; extendê-la para cobrir todos os endpoints com tipagens.
2. **Caching**:
   - **Runtime**: usar Redis/local cache com TTL longo (dados mudam raramente).
   - **Fallback Offline**: job CLI (`scripts/sync-dnd5eapi.ts`) baixa todos os registros e salva em `data/dnd5eapi/*.json` para uso quando a API estiver indisponível.
3. **Normalização**:
   - Adaptadores para converter respostas em nossas estruturas (`RaceData`, `ClassLevelData`, `EquipmentData`).
   - Guardar `source` e `lastSyncedAt` para rastreabilidade.
4. **Validação**:
   - Ao iniciar o backend, validar checksums das coleções importadas.
   - Quando a API externa falhar, usar último snapshot local e emitir alerta.

## 4. Próximas Ações

1. Implementar script de sincronização completo e armazenar snapshots (Passo 1).
2. Refatorar o motor para consumir os dados normalizados em vez de JSON manual (Passo 2).
3. Adicionar health checks e métricas para monitorar dependência externa (Passo 3).
