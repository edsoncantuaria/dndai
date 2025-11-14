# Motor de Regras – Arquitetura Proposta

## Objetivos

1. Garantir conformidade com SRD 5.1 independente da IA.
2. Fornecer funções determinísticas para o backend.
3. Disponibilizar contratos claros para o frontend (validações, efeitos).

## Camadas

1. **Catálogos (dados estáticos)**: JSON carregados em memória (`data/srd/*.json`), com versões e checksums.
2. **Normalizadores**: convertem o estado vindo do banco em `RulesCharacterState`.
3. **Módulos de domínio**:
   - `character.ts`: cálculos de atributos, proficiências, carga.
   - `combat.ts`: iniciativa, ataques, condições.
   - `spells.ts`: preparo, consumo de slots, concentração.
   - `rest.ts`: curto/longo, hit dice.
   - `skills.ts`: testes de perícia/ferramenta.
4. **Orquestrador**: expõe `processAction(ActionIntent, GameContext)` e retorna `ValidationResult`.

## Tipagens Principais (TypeScript)

```ts
type Ability = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

interface RulesCharacterState {
  id: string;
  name: string;
  level: number;
  classId: string;
  abilities: Record<Ability, number>;
  proficiencyBonus: number;
  hp: { current: number; max: number; temp?: number };
  hitDice: { die: string; current: number; total: number };
  conditions: string[];
  resources: Record<string, { current: number; max: number; refresh: 'short' | 'long' }>;
  spellcasting?: {
    ability: Ability;
    slots: Record<number, { current: number; max: number }>;
    prepared: string[];
  };
  inventory: InventoryItemState[];
}

interface ActionIntent {
  actionId: string;
  type: 'attack' | 'skill' | 'spell' | 'rest' | 'custom';
  payload: Record<string, unknown>;
  narration?: string;
}

interface ValidationResult {
  actionId: string;
  status: 'accepted' | 'rejected' | 'needs_roll';
  reason?: string;
  rollRequest?: RollRequest;
  stateDelta?: Partial<RulesCharacterState>;
  logEntries?: LogEntry[];
}
```

## Fluxo do Backend

1. Recebe `ActionIntent` via WebSocket/REST.
2. Busca `RulesCharacterState` + `GameContext` (combate, exploração).
3. Seleciona módulo conforme `intent.type`.
4. Executa validação e aplica efeitos.
5. Persiste `stateDelta` (DB), gera logs e envia resposta ao frontend + IA.

## Testes

- Cada módulo terá suíte Jest (`tests/rules/*.test.ts`) com casos do SRD.
- Fixtures carregam personagens padrão (Fighter 3, Wizard 5).

## Próximos Passos

| Item | Status |
| --- | --- |
| Implementar skeleton TS (`src/rules/`) | ✅ (`backend/src/rules`) |
| Carregar catálogos em um serviço singleton | ✅ (`srdCatalogService`) |
| Criar primeiros testes (`abilityModifier`, `resolveWeaponAttack` etc.) | ⏳ (não implementado) |
| Aplicar efeitos automaticamente (HP, recursos) | 🚧 iniciamos pelo descanso; demais intents pendentes |
| Expor intents em REST | ⏳ (planejado em `docs/rules/integration-plan.md`) |
