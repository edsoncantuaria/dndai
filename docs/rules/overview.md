# Regras SRD 5.1 – Inventário e Escopo de Implementação

Este documento cataloga os blocos de regras da SRD 5.1 que devem ser suportados pelo motor de regras interno. Cada seção inclui o conteúdo original de referência e os artefatos que precisamos gerar (tabelas, funções de validação, eventos).

## 1. Criação e Progressão de Personagem

| Subárea | Referência SRD | Artefatos Necessários |
| --- | --- | --- |
| Valores de habilidade, point-buy, rolagens padrão | Basic Rules cap. 1 | Funções `generateStats`, `validatePointBuy`, tabela de custo de atributos |
| Modificadores e bônus de proficiência | cap. 1–2 | Função `abilityModifier(score)`, tabela `proficiency_bonus_by_level` |
| Raças, sub-raças, traços | cap. 2 | Catálogo `data/races.json` com bônus, idiomas e proficiências automáticas |
| Classes, hit dice, proficiências, equipamentos iniciais | cap. 3 | Catálogo `data/classes.json` com níveis, progressão de slots, habilidades |
| Antecedentes, perícias e idiomas extras | cap. 4 | `data/backgrounds.json` |
| Equipamentos e peso | cap. 5 | `data/equipment.json` com danos, propriedades, peso, custo |
| Feats (d20 SRD) | apêndice | `data/feats.json` com pré-requisitos |

## 2. Combate

| Subárea | Referência | Artefatos |
| --- | --- | --- |
| Ordem de iniciativa, turnos, rounds | cap. 9 | Função `startEncounter(combatants)` |
| Tipos de ação (ação, bônus, reação, movimento, ação livre) | cap. 9–10 | Enum `ActionType`, validações de consumo de recursos |
| Ataques (armas e desarmados) | cap. 9 | Funções `resolveWeaponAttack`, `handleCritical` |
| Magias em combate | cap. 10 | Reuso das validações de conjuração |
| Condições | apêndice | `data/conditions.json` e aplicação incremental |
| Vantagem/Desvantagem | cap. 7 | Funções auxiliares `rollWithAdvantage` |
| Concentração e efeitos contínuos | cap. 10 | Estado `concentrationSpellId` por conjurador |

## 3. Conjuração

| Subárea | Referência | Artefatos |
| --- | --- | --- |
| Preparação vs. magias conhecidas | cap. 11 | Regras por classe; funções `canPrepareSpell`, `consumeSpellSlot` |
| CD e bônus de ataque mágico | cap. 11 | Função `spellSaveDC(class, ability, level)` |
| Componentes (V/S/M) e foco | cap. 11 | Validações de inventário/ocupação de mãos (escopo futuro) |
| Duração, concentração, alcance/alvo | fichas de magia | Inclusos em `data/spells.json` |

## 4. Descansos e Recuperação

| Subárea | Referência | Artefatos |
| --- | --- | --- |
| Descanso curto (gasto de Hit Dice) | cap. 8 | Função `spendHitDice(character, diceCount)` já integrada |
| Descanso longo | cap. 8 | Função `applyLongRest` (HP cheio, slots recuperados, limitações) |
| Ritmo de viagem, exaustão | cap. 8 | Futuro: `environmentalChecks`, rastreio de `exhaustionLevel` |

## 5. Exploração e Interação

| Subárea | Referência | Artefatos |
| --- | --- | --- |
| Testes de perícia, uso de ferramentas | cap. 7 | Função `resolveSkillCheck(skill, dc)` |
| Furtividade, percepção passiva | cap. 7 | Fórmulas já existentes para passives; registrar no engine |
| Encontros aleatórios, perigos ambientais | DMG/SRD | Tabelas customizáveis; geração via IA assistida |
| Interação social | cap. 8 | Diretrizes de DC; ainda suportado por IA, mas com funções de verificação |

### Próximos Documentos

- `docs/rules/engine.md`: arquitetura do motor.
- `docs/rules/contracts.md`: payloads REST/WebSocket.

### Checklist

- [x] Inventário inicial SRD
- [ ] JSON seeds para classes, armas, magias
- [ ] Especificação do motor
- [ ] Contratos de mensagem atualizados
