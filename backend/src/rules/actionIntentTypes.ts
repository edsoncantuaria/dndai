import type {
    WeaponAttackIntent,
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
import type {
    OpenShopPayload,
    BuyItemPayload,
    CloseShopPayload,
    SellItemPayload,
} from './shopMotor.js';
import type { QuestCompletePayload } from './questMotor.js';
import type { StartEncounterPayload } from './combatEncounterMotor.js';

export type ActionIntent =
    | { type: 'weapon-attack'; payload: WeaponAttackIntent }
    | { type: 'skill-check'; payload: SkillCheckIntentPayload }
    | { type: 'spell-attack'; payload: SpellAttackIntentPayload }
    | { type: 'rest'; payload: RestIntentPayload }
    | { type: 'damage'; payload: DamageIntentPayload }
    | { type: 'healing'; payload: HealingIntentPayload }
    | { type: 'consume-item'; payload: ConsumeItemIntentPayload }
    | { type: 'travel'; payload: TravelIntentPayload }
    | { type: 'equip-item'; payload: EquipItemPayload }
    | { type: 'drop-item'; payload: DropItemPayload }
    | { type: 'claim-loot'; payload?: Record<string, never> }
    | { type: 'open-shop'; payload: OpenShopPayload }
    | { type: 'buy-item'; payload: BuyItemPayload }
    | { type: 'close-shop'; payload?: CloseShopPayload }
    | { type: 'sell-item'; payload: SellItemPayload }
    | { type: 'quest-complete'; payload?: QuestCompletePayload }
    | { type: 'start-encounter'; payload: StartEncounterPayload };
