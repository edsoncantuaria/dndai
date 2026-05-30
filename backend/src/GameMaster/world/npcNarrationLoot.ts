import { appendNpcSessionInventoryItem } from './npcSessionOverlay.js';

/** Itens que a narração pode conceder sem inventar slug (lazy loot). */
const NARRATION_ITEM_PATTERNS: Array<{
    pattern: RegExp;
    itemKey: string;
    name: string;
    itemData?: Record<string, unknown>;
}> = [
    {
        pattern: /po[cç][aã]o de cura|po[cç][aã]o curativa/i,
        itemKey: 'healing-potion',
        name: 'Poção de cura',
        itemData: { type: 'consumable', heal: '2d4+2' },
    },
    {
        pattern: /chave (enferrujada|antiga|de bronze)/i,
        itemKey: 'iron-key',
        name: 'Chave',
        itemData: { type: 'key', magical: false },
    },
    {
        pattern: /pergaminho|mapa rabiscado/i,
        itemKey: 'scroll-note',
        name: 'Pergaminho',
        itemData: { type: 'quest', magical: false },
    },
];

/**
 * Loot lazy pós-narração: só itens do catálogo ou chaves narrativas (`source: narration`).
 * Não altera a ficha canônica — apenas `session_entity_state.sessionOverlay`.
 */
export async function applyLazyNpcLootFromNarration(opts: {
    sessionId: number;
    worldEntityId: string;
    narration: string;
}): Promise<number> {
    let added = 0;
    for (const row of NARRATION_ITEM_PATTERNS) {
        if (!row.pattern.test(opts.narration)) continue;
        await appendNpcSessionInventoryItem({
            sessionId: opts.sessionId,
            worldEntityId: opts.worldEntityId,
            itemKey: row.itemKey,
            name: row.name,
            quantity: 1,
            itemData: row.itemData,
            source: 'narration',
        });
        added += 1;
    }
    return added;
}
