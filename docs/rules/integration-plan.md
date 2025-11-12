# Plano de Integração – dnd5eapi.co + Motor de Regras

## Visão Geral
1. **Sincronização periódica** baixa todos os recursos relevantes da API pública.
2. **Normalizadores** convertem as respostas em estruturas prontas para o motor.
3. **Adapters** entregam dados para validação em tempo de execução (sem chamar a API externa).

## 1. Sincronização
- Criar script `scripts/sync-dnd5eapi.ts` com passos:
  1. Baixar listas (`/api/{resource}`) e iterar sobre cada item.
  2. Salvar JSON bruto em `data/dnd5eapi/raw/{resource}.json`.
  3. Salvar versão normalizada em `data/dnd5eapi/normalized/{resource}.json`.
  4. Registrar metadados (`source`, `timestamp`, `commit hash`).
- Rodar manualmente ou via CI (cron diário). Quando offline, usar último snapshot.

## 2. Normalização
- Mapear campos principais:
  - **Classes**: hit dice, proficiências, equipamentos, progressão (`levels`), spellcasting.
  - **Races**: bônus de atributo, idiomas, traits.
  - **Spells**: componentes, concentração, classes elegíveis.
  - **Equipment**: dano, peso, custo, propriedades.
  - **Conditions**: converter texto em flags (tabela manual).
- Guardar IDs consistentes (`index` da API → `srdId`) para correlacionar com o motor.

## 3. Camada de Acesso no Backend
- Criar módulo `src/rules/catalog.ts` que:
  - Carrega os JSON normalizados na inicialização.
  - Exponibiliza funções `getClassById`, `listSpells`, `getEquipment`.
  - Fornece checksums para verificação.

## 4. Uso no Motor
- Atualizar `character.ts` e demais módulos para consultar `catalog`.
- Exemplos:
  - `resolveWeaponAttack` busca arma por ID → usa dano/propriedades.
  - `canPrepareSpell` confere se a classe aparece em `spell.classes`.
  - `applyLongRest` refere-se a slots `levels` do catálogo.

## 5. Health & Fallback
- Adicionar endpoint `GET /health/rules` que retorna:
  - Timestamp da última sync bem-sucedida.
  - Se o cache local está presente.
- Quando `sync` falhar:
  - Registrar log/alerta.
  - Continuar usando snapshot local.

## Próximos Passos
1. Implementar script de sync (com retries e rate-limit). ✅ `scripts/sync-dnd5eapi.js`
2. Criar importador para o banco (`backend/src/scripts/importSrdResources.ts`) e executar após cada sync. ✅
3. Expor serviço `srdCatalogService` para consumir o banco com fallback local. ✅
4. Criar normalizadores para classes, condições, armas, armaduras, perícias, magias e descanso. ✅
5. Plugá-los no motor em desenvolvimento. ✅ `backend/src/rules/*`

## Endpoints Expostos
- `GET /api/srd/:resource` → lista (com normalização para `conditions` e `classes`).
- `GET /api/srd/:resource/:index` → item individual (normalizado quando aplicável).
