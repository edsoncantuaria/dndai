// backend/src/rules/actionIntentService.ts
import createError from 'http-errors';
import { loadCharacterSnapshot } from './characterSnapshot.js';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { validateWeaponAttack } from './attack.js';
import { validateSkillCheck } from './skills.js';
import { validateSpellAttack } from './spellAttack.js';
import { validateRestIntent } from './rest.js';
import {
    validateDamageIntent,
    validateHealingIntent,
    validateConsumeItemIntent,
} from './damage.js';
import { validateTravelIntent } from './travel.js';
import {
    validateClaimLootIntent,
    validateDropItemIntent,
    validateEquipItemIntent,
    type DropItemPayload,
    type EquipItemPayload,
} from './inventoryMotor.js';
import {
    validateOpenShopIntent,
    validateBuyItemIntent,
    validateCloseShopIntent,
    type OpenShopPayload,
    type BuyItemPayload,
    type CloseShopPayload,
    type SellItemPayload,
} from './shopMotor.js';
import { validateQuestCompleteIntent, type QuestCompletePayload } from './questMotor.js';
import { validateStartEncounterIntent, type StartEncounterPayload } from './combatEncounterMotor.js';
import type {
    WeaponAttackIntent,
    RuleCheckResult,
    SkillCheckIntentPayload,
    SpellAttackIntentPayload,
    RestIntentPayload,
    DamageIntentPayload,
    HealingIntentPayload,
    ConsumeItemIntentPayload,
    TravelIntentPayload,
    EquipItemPayload,
    DropItemPayload,
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
      }
    | {
          type: 'damage';
          payload: DamageIntentPayload;
      }
    | {
          type: 'healing';
          payload: HealingIntentPayload;
      }
    | {
          type: 'consume-item';
          payload: ConsumeItemIntentPayload;
      }
    | {
          type: 'travel';
          payload: TravelIntentPayload;
      }
    | {
          type: 'equip-item';
          payload: EquipItemPayload;
      }
    | {
          type: 'drop-item';
          payload: DropItemPayload;
      }
    | {
          type: 'claim-loot';
          payload?: Record<string, never>;
      }
    | {
          type: 'open-shop';
          payload: OpenShopPayload;
      }
    | {
          type: 'buy-item';
          payload: BuyItemPayload;
      }
    | {
          type: 'close-shop';
          payload?: CloseShopPayload;
      }
    | {
          type: 'sell-item';
          payload: SellItemPayload;
      }
    | {
          type: 'quest-complete';
          payload?: QuestCompletePayload;
      }
    | {
          type: 'start-encounter';
          payload: StartEncounterPayload;
      };

export const SUPPORTED_INTENTS = new Set<ActionIntent['type']>([
    'weapon-attack',
    'skill-check',
    'spell-attack',
    'rest',
    'damage',
    'healing',
    'consume-item',
    'travel',
    'equip-item',
    'drop-item',
    'claim-loot',
    'open-shop',
    'buy-item',
    'close-shop',
    'sell-item',
    'quest-complete',
    'start-encounter',
]);

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
        case 'damage':
            result = validateDamageIntent(intent.payload, context?.combatState);
            break;
        case 'healing':
            result = validateHealingIntent(intent.payload, context?.combatState);
            break;
        case 'consume-item':
            result = validateConsumeItemIntent(intent.payload);
            break;
        case 'travel': {
            const sessaoRepo = AppDataSource.getRepository(SessaoIA);
            const sessao = await sessaoRepo.findOne({
                where: { id: sessionId, userId },
                relations: ['character'],
            });
            const worldState = (sessao?.character?.worldState as Record<string, unknown>) ?? null;
            result = await validateTravelIntent(worldState, intent.payload);
            break;
        }
        case 'equip-item':
            result = validateEquipItemIntent(intent.payload);
            break;
        case 'drop-item':
            result = validateDropItemIntent(intent.payload);
            break;
        case 'claim-loot':
            result = validateClaimLootIntent();
            break;
        case 'open-shop':
            result = validateOpenShopIntent(context?.combatState, intent.payload);
            break;
        case 'buy-item':
            result = validateBuyItemIntent(intent.payload);
            break;
        case 'close-shop':
            result = validateCloseShopIntent();
            break;
        case 'sell-item':
            result = validateSellItemIntent(intent.payload);
            break;
        case 'quest-complete':
            result = validateQuestCompleteIntent(context?.combatState, intent.payload ?? {});
            break;
        case 'start-encounter':
            result = validateStartEncounterIntent(context?.combatState, intent.payload);
            break;
        default:
            throw createError(400, `Tipo de intenção ${intent.type} não é suportado.`);
    }

    if (!result.authoritativeSignature) {
        result = {
            ...result,
            authoritativeSignature: `rules:${intent.type}`,
        };
    }

    return { result, intent };
}
