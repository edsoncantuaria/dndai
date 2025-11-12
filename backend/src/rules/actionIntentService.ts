// backend/src/rules/actionIntentService.ts
import createError from 'http-errors';
import { loadCharacterSnapshot } from './characterSnapshot.js';
import { validateWeaponAttack } from './attack.js';
import { validateSkillCheck } from './skills.js';
import { validateSpellAttack } from './spellAttack.js';
import { validateRestIntent } from './rest.js';
import type {
    WeaponAttackIntent,
    RuleCheckResult,
    SkillCheckIntentPayload,
    SpellAttackIntentPayload,
    RestIntentPayload,
} from './types.js';
import type { CombatState } from '../types.js';

export type ActionIntent =
    | {
          type: 'weapon-attack';
          payload: WeaponAttackIntent;
      }
    | {
          type: 'skill-check';
          payload: SkillCheckIntentPayload;
      }
    | {
          type: 'spell-attack';
          payload: SpellAttackIntentPayload;
      }
    | {
          type: 'rest';
          payload: RestIntentPayload;
      };

export const SUPPORTED_INTENTS = new Set<ActionIntent['type']>(['weapon-attack', 'skill-check', 'spell-attack', 'rest']);

export async function validateActionIntent(
    sessionId: number,
    userId: number,
    intent: ActionIntent,
    context?: { combatState?: CombatState | null }
): Promise<{ result: RuleCheckResult; intent: ActionIntent }> {
    if (!SUPPORTED_INTENTS.has(intent.type)) {
        throw createError(400, `Tipo de intenção ${intent.type} não é suportado.`);
    }

    const snapshot = await loadCharacterSnapshot(sessionId, userId);

    let result: RuleCheckResult;
    switch (intent.type) {
        case 'weapon-attack':
            result = await validateWeaponAttack(snapshot, intent.payload);
            break;
        case 'skill-check':
            result = await validateSkillCheck(snapshot, intent.payload);
            break;
        case 'spell-attack':
            result = await validateSpellAttack(snapshot, intent.payload);
            break;
        case 'rest':
            result = validateRestIntent(snapshot, intent.payload, context?.combatState);
            break;
        default:
            throw createError(400, `Tipo de intenção ${intent.type} não é suportado.`);
    }

    return { result, intent };
}
