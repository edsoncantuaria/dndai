// backend/src/game/scenarioPlaybooks.ts
import type { GameMasterFlowInput, GameMasterResponse } from '../schemas/gameSchemas.js';

export type ScenarioPlaybookIssue = {
    reason: string;
    hint: string;
};

type ScenarioRule =
    | { type: 'requireCombatActive'; reason: string; hint: string }
    | { type: 'forbidLootDuringCombat'; reason: string; hint: string }
    | { type: 'forbidShopDuringCombat'; reason: string; hint: string }
    | { type: 'requireRollRequest'; reason: string; hint: string; skipWhenSuppressed?: boolean }
    | { type: 'requireXpEvents'; reason: string; hint: string }
    | { type: 'requireProgressionFeed'; reason: string; hint: string }
    | { type: 'requireShopStateOpen'; reason: string; hint: string };

type ScenarioPlaybook = {
    label: string;
    stateRules?: ScenarioRule[];
};

const PLAYBOOKS: Record<string, ScenarioPlaybook> = {
    'Combate prolongado': {
        label: 'Combate prolongado',
        stateRules: [
            {
                type: 'requireCombatActive',
                reason: 'combat_state_missing_during_scenario',
                hint: 'Durante "Combate prolongado", mantenha combatState.isActive=true e atualize turn/round antes de encerrar.',
            },
            {
                type: 'forbidLootDuringCombat',
                reason: 'loot_offer_during_combat',
                hint: 'Não distribua lootOffer enquanto o combate estiver ativo; espere o término do encontro.',
            },
            {
                type: 'forbidShopDuringCombat',
                reason: 'shop_open_during_combat',
                hint: 'Feche shopState durante o combate; lojas apenas em turnos seguros.',
            },
            {
                type: 'requireRollRequest',
                reason: 'scenario_roll_request_missing',
                hint: 'Este turno exige playerRollRequest descrevendo o teste (ex.: Arcana).',
            },
        ],
    },
    'Ameaça súbita': {
        label: 'Ameaça súbita',
        stateRules: [
            {
                type: 'requireRollRequest',
                reason: 'scenario_roll_request_missing',
                hint: 'Informe playerRollRequest descrevendo o teste imediato para lidar com a ameaça.',
                skipWhenSuppressed: true,
            },
        ],
    },
    'Revisão de progresso': {
        label: 'Revisão de progresso',
        stateRules: [
            {
                type: 'requireXpEvents',
                reason: 'progress_review_missing_xp',
                hint: 'Inclua xpEvents descrevendo o ganho de XP nesta revisão.',
            },
            {
                type: 'requireProgressionFeed',
                reason: 'progress_review_missing_feed',
                hint: 'Atualize progressionFeed com os marcos/XP ganhos no turno.',
            },
        ],
    },
    'Recuperação / loot': {
        label: 'Recuperação / loot',
        stateRules: [
            {
                type: 'requireXpEvents',
                reason: 'recovery_loot_missing_xp',
                hint: 'Registre xpEvents da recuperação/saque para manter o histórico consistente.',
            },
        ],
    },
    'Visita à loja': {
        label: 'Visita à loja',
        stateRules: [
            {
                type: 'requireShopStateOpen',
                reason: 'shop_state_missing',
                hint: 'Inclua shopState com isOpen=true, estoque e preços atualizados ao visitar a loja.',
            },
        ],
    },
    'Desafio multi-rolagem': {
        label: 'Desafio multi-rolagem',
        stateRules: [
            {
                type: 'requireRollRequest',
                reason: 'scenario_roll_request_missing',
                hint: 'Este desafio exige playerRollRequest com requestId, rollType e DC explícitos.',
            },
        ],
    },
    'Queda e recuperação': {
        label: 'Queda e recuperação',
        stateRules: [
            {
                type: 'requireRollRequest',
                reason: 'scenario_roll_request_missing',
                hint: 'Informe playerRollRequest para representar testes de recuperação (ex.: Death Saves).',
                skipWhenSuppressed: true,
            },
        ],
    },
};

const hasMeaningfulLoot = (lootOffer?: GameMasterResponse['lootOffer']): boolean => {
    if (!lootOffer || typeof lootOffer !== 'object') return false;
    const items = Array.isArray(lootOffer.items) ? lootOffer.items : [];
    const hasItems = items.length > 0;
    const currency = lootOffer.currency && typeof lootOffer.currency === 'object'
        ? Object.values(lootOffer.currency).some(value => Number(value) !== 0)
        : false;
    return hasItems || currency;
};

const getPlaybook = (label?: string | null): ScenarioPlaybook | undefined => {
    if (!label) return undefined;
    return PLAYBOOKS[label] ?? undefined;
};

export const evaluateScenarioStatePlaybook = (
    response: GameMasterResponse,
    input: GameMasterFlowInput,
    options?: { combatShouldContinue?: boolean }
): ScenarioPlaybookIssue | null => {
    const playbook = getPlaybook(input.scenarioLabel);
    if (!playbook || !playbook.stateRules?.length) {
        return null;
    }

    const combatActive = options?.combatShouldContinue ?? Boolean(input.combatState?.isActive);
    for (const rule of playbook.stateRules) {
        switch (rule.type) {
            case 'requireCombatActive':
                if (combatActive && !response.combatState?.isActive) {
                    return { reason: rule.reason, hint: rule.hint };
                }
                break;
            case 'forbidLootDuringCombat':
                if (combatActive && hasMeaningfulLoot(response.lootOffer ?? undefined)) {
                    return { reason: rule.reason, hint: rule.hint };
                }
                break;
            case 'forbidShopDuringCombat':
                if (combatActive && response.shopState?.isOpen) {
                    return { reason: rule.reason, hint: rule.hint };
                }
                break;
            case 'requireRollRequest':
                if (rule.skipWhenSuppressed && input.suppressRollRequest) {
                    break;
                }
                if (!response.playerRollRequest) {
                    return { reason: rule.reason, hint: rule.hint };
                }
                break;
            case 'requireXpEvents':
                if (!Array.isArray(response.xpEvents) || response.xpEvents.length === 0) {
                    return { reason: rule.reason, hint: rule.hint };
                }
                break;
            case 'requireProgressionFeed':
                if (!Array.isArray(response.progressionFeed) || response.progressionFeed.length === 0) {
                    return { reason: rule.reason, hint: rule.hint };
                }
                break;
            case 'requireShopStateOpen':
                if (!response.shopState || !response.shopState.isOpen) {
                    return { reason: rule.reason, hint: rule.hint };
                }
                break;
            default:
                break;
        }
    }

    return null;
};
