// backend/src/rules/conditions.ts
import { listSrdResources } from '../services/srdCatalogService.js';
import { asSrdRecord } from './srdRecord.js';

export interface ConditionEffect {
    speedMultiplier?: number;
    speedSetToZero?: boolean;
    attackRollDisadvantage?: boolean;
    attackRollAdvantageAgainst?: boolean;
    abilityDisadvantage?: string[];
    savingThrowDisadvantage?: string[];
    preventsReaction?: boolean;
    preventsAction?: boolean;
    prone?: boolean;
    invisible?: boolean;
    notes?: string[];
}

export interface NormalizedCondition {
    index: string;
    name: string;
    description: string[];
    effects: ConditionEffect;
}

export const CONDITION_MAP: Record<string, ConditionEffect> = {
    blinded: {
        attackRollDisadvantage: true,
        attackRollAdvantageAgainst: true,
        abilityDisadvantage: ['sight'],
        notes: ['Falha automática em testes que dependem de visão.'],
    },
    charmed: {
        abilityDisadvantage: ['social against charmer opponents'],
        notes: ['Não pode atacar o enfeitiçador.', 'O enfeitiçador tem vantagem em interações sociais.'],
    },
    deafened: {
        abilityDisadvantage: ['checks depending on hearing'],
    },
    frightened: {
        abilityDisadvantage: ['ability checks near source'],
        attackRollDisadvantage: true,
    },
    grappled: {
        speedSetToZero: true,
        notes: ['Escapa com teste oposto ou efeito de teleporte.'],
    },
    incapacitated: {
        preventsAction: true,
        preventsReaction: true,
        notes: ['Não pode realizar ações ou reações.'],
    },
    invisible: {
        invisible: true,
        attackRollAdvantageAgainst: false,
        notes: ['Fora de combate, concede vantagem em Furtividade.'],
    },
    paralyzed: {
        preventsAction: true,
        preventsReaction: true,
        attackRollAdvantageAgainst: true,
        notes: ['Falha automática em testes de Força e Destreza.', 'Ataques adjacentes são críticos ao acertar.'],
    },
    petrified: {
        speedSetToZero: true,
        preventsAction: true,
        preventsReaction: true,
        notes: ['Resistência a todos os danos exceto psíquico.', 'Vulnerabilidade ao dano contundente.'],
    },
    poisoned: {
        attackRollDisadvantage: true,
        abilityDisadvantage: ['ability checks'],
    },
    prone: {
        prone: true,
        attackRollDisadvantage: true,
        notes: ['Ataques corpo a corpo contra você têm vantagem; ataques à distância têm desvantagem.'],
    },
    restrained: {
        speedSetToZero: true,
        attackRollDisadvantage: true,
        attackRollAdvantageAgainst: true,
        savingThrowDisadvantage: ['dexterity'],
    },
    stunned: {
        preventsAction: true,
        preventsReaction: true,
        attackRollAdvantageAgainst: true,
        savingThrowDisadvantage: ['strength', 'dexterity'],
    },
    unconscious: {
        preventsAction: true,
        preventsReaction: true,
        speedSetToZero: true,
        attackRollAdvantageAgainst: true,
        notes: ['Falha automática em testes de Força e Destreza.', 'Ataques adjacentes são críticos ao acertar.'],
    },
    exhaustion: {
        notes: ['Escalonada de 1 a 6, aplicar efeitos cumulativos.'],
    },
};

export async function getNormalizedConditions(): Promise<NormalizedCondition[]> {
    const rawConditions = await listSrdResources('conditions');
    return rawConditions.map(raw => {
        const condition = asSrdRecord(raw)!;
        const normalizedIndex = String(condition.index ?? '');
        const effects = CONDITION_MAP[normalizedIndex] ?? {};
        const desc = condition.desc;
        return {
            index: normalizedIndex,
            name: String(condition.name ?? normalizedIndex),
            description: Array.isArray(desc) ? desc.map(String) : [],
            effects,
        };
    });
}
