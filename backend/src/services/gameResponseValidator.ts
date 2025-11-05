// backend/src/services/gameResponseValidator.ts
import { GameMasterResponse } from '../schemas/gameSchemas.js';

export interface ValidationContext {
    character?: {
        name?: string;
        attributes?: { hp?: number; maxHp?: number };
    };
}

export interface ValidationResult {
    valid: boolean;
    issues: string[];
}

export const validateGameMasterResponse = (
    response: GameMasterResponse,
    context: ValidationContext = {}
): ValidationResult => {
    const issues: string[] = [];

    const hasPendingRequest =
        !!response.playerRollRequest ||
        !!response.levelUpState ||
        !!response.shopState ||
        !!response.lootOffer ||
        !!response.useHitDiceRequest;

    if ((!response.actionOptions || response.actionOptions.length === 0) && !hasPendingRequest) {
        issues.push('Nenhuma actionOption foi fornecida e nenhuma solicitação está pendente.');
    }

    if (response.combatState && response.combatState.isActive) {
        const combatants = response.combatState.combatants || [];
        if (combatants.length === 0) {
            issues.push('O combate está ativo mas a lista de combatentes está vazia.');
        } else {
            const seenIds = new Set<string>();
            let playerFound = false;
            for (const combatant of combatants) {
                const id = typeof combatant.id === 'string' ? combatant.id : combatant.name;
                if (!id) {
                    issues.push('Um combatente não possui ID ou nome válido.');
                    continue;
                }
                if (seenIds.has(id)) {
                    issues.push(`Combatente duplicado detectado: ${id}.`);
                } else {
                    seenIds.add(id);
                }
                const hp = combatant.hp;
                if (!hp || typeof hp.current !== 'number' || typeof hp.max !== 'number') {
                    issues.push(`Combatente ${combatant.name || id} possui HP inválido.`);
                } else if (hp.current > hp.max || hp.current < 0) {
                    issues.push(`HP inconsistente para ${combatant.name || id}: ${hp.current}/${hp.max}.`);
                }
                if (combatant.isPlayer || (context.character?.name && combatant.name === context.character.name)) {
                    playerFound = true;
                }
            }
            if (!playerFound) {
                issues.push('Nenhum combatente marcado como jogador foi encontrado no combate ativo.');
            }
        }
    }

    if (response.updatedCharacter?.hp) {
        const { current, max } = response.updatedCharacter.hp as { current?: number; max?: number };
        if (current !== undefined && max !== undefined) {
            if (current > max) {
                issues.push(`HP do personagem maior que o máximo: ${current}/${max}.`);
            }
            if (current < 0) {
                issues.push(`HP do personagem menor que zero: ${current}.`);
            }
        }
    }

    if (response.updatedCharacter?.attributes) {
        const attrs = response.updatedCharacter.attributes as Record<string, unknown>;
        for (const [key, value] of Object.entries(attrs)) {
            if (typeof value !== 'number' || Number.isNaN(value)) {
                issues.push(`Atributo ${key} possui valor inválido (${value}).`);
            }
        }
    }

    if (response.actionOptions) {
        response.actionOptions.forEach((option, index) => {
            if (typeof option === 'object') {
                if (!option.text || !option.action) {
                    issues.push(`actionOption[${index}] está faltando texto ou action.`);
                }
            } else if (typeof option !== 'string') {
                issues.push(`actionOption[${index}] possui tipo inválido.`);
            }
        });
    }

    const validCurrencies = ['pp', 'gp', 'ep', 'sp', 'cp'];
    if (response.updatedCharacter?.currency) {
        const currency = response.updatedCharacter.currency as Record<string, unknown>;
        for (const [coin, value] of Object.entries(currency)) {
            if (!validCurrencies.includes(coin)) {
                issues.push(`Tipo de moeda desconhecido recebido: ${coin}.`);
            } else if (typeof value !== 'number' || value < 0) {
                issues.push(`Quantidade inválida para ${coin}: ${value}.`);
            }
        }
    }

    return {
        valid: issues.length === 0,
        issues,
    };
};
