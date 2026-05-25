import type { GameMasterFlowInput } from '../../schemas/gameSchemas.js';
import { normalizeActionOptionsFromRegistry } from '../actions/registry.js';
import { OSS_COMBAT_FORMAT_SYSTEM } from '../prompts/system/combat.js';
import {
    OssCombatNarrationSchema,
    mapCombatToGameMasterShape,
    type OssCombatNarration,
} from '../schemas/combat.schema.js';
import type { OssNarrationResponse } from '../schemas/narration.schema.js';

export function buildCombatSystemInstruction(): string {
    return OSS_COMBAT_FORMAT_SYSTEM;
}

export function buildCombatSceneHint(input: GameMasterFlowInput): string {
    const cs = input.combatState;
    if (!cs?.isActive) return '';
    const names = (cs.combatants ?? [])
        .slice(0, 8)
        .map(c => c.name ?? c.id)
        .filter(Boolean)
        .join(', ');
    const round = cs.round ?? 1;
    const turn = cs.turn ?? 1;
    return `COMBATE r${round} t${turn}${names ? ` | participantes: ${names}` : ''}`;
}

export function validateCombatOssNarration(data: unknown): {
    valid: boolean;
    data?: OssCombatNarration;
    issues: string[];
} {
    const check = OssCombatNarrationSchema.safeParse(data);
    if (!check.success) {
        return {
            valid: false,
            issues: check.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
        };
    }
    return { valid: true, data: check.data, issues: [] };
}

export function applyCombatDeterminism(
    data: OssNarrationResponse,
): ReturnType<typeof mapCombatToGameMasterShape> {
    const normalized: OssNarrationResponse = {
        ...data,
        actionOptions: normalizeActionOptionsFromRegistry(data.actionOptions, 'combat'),
    };
    if (Array.isArray(normalized.state_changes)) {
        normalized.state_changes = normalized.state_changes
            .filter(s => !/\d+\s*(de\s+)?dano|hp|pv|rolagem|1d\d+/i.test(s))
            .slice(0, 6);
    }
    return mapCombatToGameMasterShape(normalized);
}
