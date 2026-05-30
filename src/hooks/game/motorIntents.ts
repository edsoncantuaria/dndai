/**
 * Payloads de intents estruturados alinhados ao backend (actionIntentService).
 */
import type { ShopItem, InventoryItem } from '@/types';

export type StructuredIntent =
    | { type: 'claim-loot'; payload?: Record<string, never> }
    | { type: 'equip-item'; payload: { itemId: number; equipped: boolean } }
    | { type: 'open-shop'; payload: { name?: string; merchantName?: string; inventory: ShopItem[] } }
    | { type: 'buy-item'; payload: { itemId: string | number; priceGp: number; quantity?: number } }
    | { type: 'sell-item'; payload: { itemId: number; priceGp: number; quantity?: number } }
    | { type: 'close-shop'; payload?: Record<string, never> }
    | { type: 'weapon-attack'; payload: { weaponIndex: string; targetArmorClass?: number } }
    | { type: 'skill-check'; payload: { skillIndex: string; dc?: number } }
    | { type: 'spell-attack'; payload: { spellIndex: string; ability: string; targetArmorClass?: number } }
    | { type: 'rest'; payload: { restType: 'short' | 'long' } }
    | {
          type: 'apply-level-up';
          payload: {
              newLevel: number;
              attributes?: Record<string, number>;
              spells?: string[];
              hpIncrease?: number;
              subclass?: string;
              featureChoices?: Array<{ featureIndex: string; selections: string[] }>;
          };
      }
    | {
          type: 'quest-complete';
          payload?: { questLevel?: number; description?: string; difficulty?: string };
      }
    | {
          type: 'start-encounter';
          payload: {
              combatants: Array<{
                  id: string;
                  name: string;
                  hp: number;
                  maxHp: number;
                  ac?: number;
                  isPlayer?: boolean;
                  attitude?: 'hostile' | 'ally' | 'neutral';
                  initiative?: number;
              }>;
              round?: number;
              turn?: number;
          };
      };

export function buildOpenShopIntent(
    name: string,
    inventory: ShopItem[],
    merchantName?: string,
): StructuredIntent {
    return {
        type: 'open-shop',
        payload: { name, merchantName, inventory },
    };
}

export function buildBuyItemIntent(item: ShopItem): StructuredIntent {
    return {
        type: 'buy-item',
        payload: {
            itemId: item.id,
            priceGp: item.cost.quantity,
            quantity: 1,
        },
    };
}

export function buildSellItemIntent(item: InventoryItem, priceGp: number): StructuredIntent {
    const numericId = Number(item.id);
    return {
        type: 'sell-item',
        payload: {
            itemId: Number.isFinite(numericId) ? numericId : 0,
            priceGp,
            quantity: 1,
        },
    };
}

export function buildStartEncounterFromCharacter(
    character: { id: number; name: string; attributes?: { hp?: number; maxHp?: number; ac?: number } },
    hostiles: Array<{ id: string; name: string; hp: number; maxHp: number; ac?: number; initiative?: number }>,
): StructuredIntent {
    const playerHp = character.attributes?.hp ?? character.attributes?.maxHp ?? 10;
    const playerMax = character.attributes?.maxHp ?? playerHp;
    return {
        type: 'start-encounter',
        payload: {
            combatants: [
                {
                    id: 'player',
                    name: character.name,
                    hp: playerHp,
                    maxHp: playerMax,
                    ac: character.attributes?.ac,
                    isPlayer: true,
                    initiative: 15,
                },
                ...hostiles.map(h => ({
                    ...h,
                    attitude: 'hostile' as const,
                    isPlayer: false,
                })),
            ],
            round: 1,
            turn: 0,
        },
    };
}
