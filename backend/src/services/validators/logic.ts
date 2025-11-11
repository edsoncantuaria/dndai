import { createIssue, type Validator } from './types.js';

/**
 * Valida pontos de ação e movimento dos combatentes durante combates.
 */
export const validateActionEconomy: Validator = (response) => {
    const combat = response.combatState;
    if (!combat?.isActive || !Array.isArray(combat.combatants)) return [];
    const issues = [];
    combat.combatants.forEach((combatant, index) => {
        if (!combatant) return;
        const actionPoints = typeof combatant.actionPoints === 'number' ? combatant.actionPoints : 1;
        if (actionPoints > 2) {
            issues.push(createIssue('logic', `combatState.combatants[${index}].actionPoints`, `Valor (${actionPoints}) excede limite sugerido (0-2).`, 'warning'));
        }
        if (combatant.hasActed && actionPoints > 0) {
            issues.push(createIssue('logic', `combatState.combatants[${index}]`, 'Combatente marcado como já agiu, mas ainda possui ações disponíveis.', 'info'));
        }
        if (combatant.hasMoved && combatant.distance === 0) {
            issues.push(createIssue('logic', `combatState.combatants[${index}].distance`, 'Combatente sinalizou movimento porém distância permaneceu zero.', 'info'));
        }
    });
    return issues;
};

/**
 * Garante que o combate ativo possua turnos válidos e combatentes vivos.
 */
export const validateAttackFeasibility: Validator = (response) => {
    const combat = response.combatState;
    if (!combat?.isActive) return [];
    if (!Array.isArray(combat.combatants) || combat.combatants.length < 2) {
        return [createIssue('logic', 'combatState.combatants', 'Combate ativo sem múltiplos combatentes.', 'warning')];
    }
    const invalid = combat.combatants.some((combatant) => combatant && combatant.distance !== undefined && combatant.distance < 0);
    if (invalid) {
        return [createIssue('logic', 'combatState.combatants[].distance', 'Distâncias negativas tornam ataques inviáveis.', 'error')];
    }
    return [];
};

/**
 * Confere se solicitações de rolagem estão bem definidas.
 */
export const validateRollRequestBinding: Validator = (response) => {
    const roll = response.playerRollRequest;
    if (!roll) return [];
    const issues = [];
    if (!roll.reason || !roll.reason.trim()) {
        issues.push(createIssue('logic', 'playerRollRequest.reason', 'Motivo da rolagem não especificado.', 'warning'));
    }
    if (!roll.dice || !/\dd\d+/i.test(roll.dice)) {
        issues.push(createIssue('logic', 'playerRollRequest.dice', `Formato de dado inesperado (${roll.dice ?? 'vazio'}).`, 'warning'));
    }
    if (!roll.rollType) {
        issues.push(createIssue('logic', 'playerRollRequest.rollType', 'Tipo de rolagem ausente.', 'error'));
    }
    return issues;
};

/**
 * Verifica se combates foram encerrados quando não restam oponentes hostis.
 */
export const validateCombatClosure: Validator = (response) => {
    const combat = response.combatState;
    if (!combat?.isActive || !Array.isArray(combat.combatants)) return [];
    const hostilesAlive = combat.combatants.some((combatant) => combatant && combatant.attitude === 'hostile' && !combatant.isDead);
    if (!hostilesAlive) {
        return [createIssue('logic', 'combatState.isActive', 'Combate marcado como ativo sem inimigos restantes.', 'warning')];
    }
    return [];
};

/**
 * Observa se o log textual cobre narrativa e instruções de sistema.
 */
export const validateLogEntriesClarity: Validator = (response) => {
    const logEntries = Array.isArray(response.logEntries) ? response.logEntries : [];
    const hasNarration = logEntries.some((entry) => entry?.type === 'narration');
    const hasSystem = logEntries.some((entry) => entry?.type === 'system');
    const issues = [];
    if (!hasNarration) {
        issues.push(createIssue('logic', 'logEntries', 'Turno sem narrativa registrada.', 'info'));
    }
    if (!hasSystem) {
        issues.push(createIssue('logic', 'logEntries', 'Turno sem notas de sistema/estado.', 'info'));
    }
    return issues;
};

/**
 * Assegura que interações de loja/loot não ocorram durante combate ativo.
 */
export const validateNoShopDuringCombat: Validator = (response) => {
    const issues = [];
    if (!response.combatState?.isActive) return issues;
    if (response.shopState?.isOpen) {
        issues.push(createIssue('logic', 'shopState.isOpen', 'Loja aberta durante combate.', 'error'));
    }
    if (response.lootOffer) {
        issues.push(createIssue('logic', 'lootOffer', 'Oferta de loot emitida em combate.', 'warning'));
    }
    return issues;
};

/**
 * Exige identificador único para correlacionar pedidos de rolagem.
 */
export const validateRollCorrelation: Validator = (response) => {
    if (!response.playerRollRequest) return [];
    if (response.playerRollRequest.requestId) return [];
    return [createIssue('logic', 'playerRollRequest.requestId', 'Solicitação de rolagem sem requestId.', 'warning')];
};
