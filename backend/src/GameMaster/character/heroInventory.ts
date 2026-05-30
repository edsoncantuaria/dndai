import { PenaiDataSource } from '../database/data-source.js';
import { HeroInventoryItem } from '../database/entities/HeroInventoryItem.js';

export async function listHeroInventory(
    sessionId: number,
    heroEntityId: string,
): Promise<HeroInventoryItem[]> {
    return PenaiDataSource.getRepository(HeroInventoryItem).find({
        where: { sessionId, heroEntityId },
        order: { name: 'ASC' },
    });
}

export async function addHeroInventoryItem(opts: {
    sessionId: number;
    heroEntityId: string;
    itemKey: string;
    name: string;
    quantity: number;
    itemData?: Record<string, unknown>;
    equipped?: boolean;
}): Promise<HeroInventoryItem> {
    const repo = PenaiDataSource.getRepository(HeroInventoryItem);
    const existing = await repo.findOne({
        where: {
            sessionId: opts.sessionId,
            heroEntityId: opts.heroEntityId,
            itemKey: opts.itemKey,
        },
    });
    if (existing) {
        existing.quantity += opts.quantity;
        if (opts.itemData) existing.itemData = { ...existing.itemData, ...opts.itemData };
        return repo.save(existing);
    }
    return repo.save(
        repo.create({
            sessionId: opts.sessionId,
            heroEntityId: opts.heroEntityId,
            itemKey: opts.itemKey,
            name: opts.name,
            quantity: opts.quantity,
            equipped: opts.equipped ?? false,
            itemData: opts.itemData ?? {},
        }),
    );
}

export async function consumeHeroInventoryItem(opts: {
    sessionId: number;
    heroEntityId: string;
    itemKey?: string;
    itemId?: string;
    quantity: number;
}): Promise<boolean> {
    const repo = PenaiDataSource.getRepository(HeroInventoryItem);
    const row = opts.itemId
        ? await repo.findOne({ where: { id: opts.itemId, sessionId: opts.sessionId } })
        : await repo.findOne({
              where: {
                  sessionId: opts.sessionId,
                  heroEntityId: opts.heroEntityId,
                  itemKey: opts.itemKey ?? '',
              },
          });
    if (!row || row.quantity < opts.quantity) return false;
    row.quantity -= opts.quantity;
    if (row.quantity <= 0) await repo.remove(row);
    else await repo.save(row);
    return true;
}

export async function setHeroItemEquipped(opts: {
    sessionId: number;
    heroEntityId: string;
    itemKey: string;
    equipped: boolean;
}): Promise<HeroInventoryItem | null> {
    const repo = PenaiDataSource.getRepository(HeroInventoryItem);
    const row = await repo.findOne({
        where: {
            sessionId: opts.sessionId,
            heroEntityId: opts.heroEntityId,
            itemKey: opts.itemKey,
        },
    });
    if (!row) return null;
    row.equipped = opts.equipped;
    return repo.save(row);
}

export async function seedStarterInventory(sessionId: number, heroEntityId: string): Promise<void> {
    await addHeroInventoryItem({
        sessionId,
        heroEntityId,
        itemKey: 'shortsword',
        name: 'Espada curta',
        quantity: 1,
        equipped: true,
        itemData: { type: 'weapon', damage: '1d6', damageType: 'slashing' },
    });
    await addHeroInventoryItem({
        sessionId,
        heroEntityId,
        itemKey: 'healing-potion',
        name: 'Poção de cura',
        quantity: 2,
        itemData: { type: 'consumable', heal: '2d4+2' },
    });
}
