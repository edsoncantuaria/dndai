import { createIssue, type Validator } from './types.js';

/**
 * Garante que o hash de schema esteja presente para rastrear drift.
 */
export const validateSchemaHash: Validator = (response) => {
    const issues = [];
    if (!response._meta || typeof response._meta.hash !== 'string' || !response._meta.hash.trim()) {
        issues.push(createIssue('structural', '_meta.hash', 'Schema hash ausente no payload.', 'warning'));
    }
    return issues;
};

/**
 * Verifica se updatedCharacter contém apenas deltas e não objetos vazios.
 */
export const validateUpdatedCharacterDelta: Validator = (response) => {
    const issues = [];
    if (!response.updatedCharacter) return issues;
    const keys = Object.keys(response.updatedCharacter).filter((key) => response.updatedCharacter && Object.prototype.hasOwnProperty.call(response.updatedCharacter, key));
    if (keys.length === 0) {
        issues.push(createIssue('structural', 'updatedCharacter', 'Objeto de delta vazio recebido.', 'info'));
    }
    if ('worldState' in response.updatedCharacter && response.worldState) {
        issues.push(createIssue('structural', 'updatedCharacter.worldState', 'worldState duplicado em updatedCharacter e resposta raiz.', 'warning'));
    }
    return issues;
};

/**
 * Exige diversidade e unicidade nas opções de ação.
 */
export const validateActionOptionsQuality: Validator = (response) => {
    const issues = [];
    if (!Array.isArray(response.actionOptions)) return issues;
    const unique = new Set<string>();
    response.actionOptions.forEach((option, index) => {
        const label = typeof option === 'string' ? option : option?.text;
        if (!label) {
            issues.push(createIssue('structural', `actionOptions[${index}]`, 'Opção sem texto definido.', 'warning'));
            return;
        }
        const normalized = label.trim().toLowerCase();
        if (unique.has(normalized)) {
            issues.push(createIssue('structural', `actionOptions[${index}]`, 'Opção duplicada detectada.', 'info'));
        } else {
            unique.add(normalized);
        }
    });
    if (unique.size < 3 && response.actionOptions.length > 0) {
        issues.push(createIssue('structural', 'actionOptions', 'Menos de três opções distintas disponíveis.', 'warning'));
    }
    return issues;
};

/**
 * Valida limites numéricos gerais para evitar estados impossíveis.
 */
export const validateRangesAndCaps: Validator = (response) => {
    const issues = [];
    if (response.gameClock) {
        const { hour, day } = response.gameClock;
        if (typeof hour === 'number' && (hour < 0 || hour > 23)) {
            issues.push(createIssue('structural', 'gameClock.hour', `Hora fora do intervalo (valor=${hour}).`, 'warning'));
        }
        if (typeof day === 'number' && day < 0) {
            issues.push(createIssue('structural', 'gameClock.day', `Dia negativo informado (valor=${day}).`, 'warning'));
        }
    }
    if (response.combatState?.combatants) {
        response.combatState.combatants.forEach((combatant, index) => {
            if (!combatant) return;
            const hpCurrent = combatant.hp?.current;
            const hpMax = combatant.hp?.max;
            if (typeof hpMax === 'number' && hpMax > 500) {
                issues.push(createIssue('structural', `combatState.combatants[${index}].hp.max`, `HP máximo exagerado (valor=${hpMax}).`, 'info'));
            }
            if (typeof hpCurrent === 'number' && hpCurrent > (hpMax ?? hpCurrent)) {
                issues.push(createIssue('structural', `combatState.combatants[${index}].hp.current`, 'HP atual maior que o máximo.', 'warning'));
            }
        });
    }
    return issues;
};

/**
 * Verifica se conteúdo homebrew aparece mesmo quando o fluxo deveria estar desabilitado.
 */
export const enforceHomebrewPolicy: Validator = (response) => {
    if (!response.newHomebrewContent || response.newHomebrewContent.length === 0) {
        return [];
    }
    return [createIssue('structural', 'newHomebrewContent', 'Conteúdo homebrew presente; verifique política da sessão.', 'info')];
};

/**
 * Confere se o foco da resposta (narrativa/estado) está sendo respeitado com base nas notas de integridade.
 */
export const enforceResponseFocus: Validator = (response) => {
    const notes = response._meta?.integrityNotes;
    if (!notes) return [];
    const list = Array.isArray(notes) ? notes : [notes];
    const annotations = list.join(' | ');
    const issues = [];
    if (/FASE_ATUAL=ESTADO/i.test(annotations)) {
        const hasNarrativeData = (response.logEntries && response.logEntries.length > 0) || (response.actionOptions && response.actionOptions.length > 0);
        if (hasNarrativeData) {
            issues.push(createIssue('structural', 'logEntries', 'Fase de estado retornou narrativa/opções.', 'warning'));
        }
    }
    if (/FASE_ATUAL=NARRATIVA/i.test(annotations)) {
        const hasStateDelta = Boolean(response.updatedCharacter || response.worldState || response.shopState || response.combatState);
        if (hasStateDelta) {
            issues.push(createIssue('structural', 'updatedCharacter', 'Fase narrativa incluiu deltas de estado.', 'warning'));
        }
    }
    return issues;
};
