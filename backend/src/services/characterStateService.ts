import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { CharacterAttributes } from '../entities/CharacterAttributes.js';
import type { CharacterStateDelta } from '../rules/types.js';
import { recordActionLog } from './actionLogService.js';
import { applyResourceChanges } from './characterResourceService.js';
import { consumeCharacterItem, addOrIncrementCharacterItem, applyCurrencyDelta } from './inventoryService.js';

export interface AppliedCharacterDelta {
    characterId: number;
    attributes?: {
        hp?: number;
        maxHp?: number;
    };
    resources?: {
        type: string;
        key: string;
        current: number;
        max: number;
    }[];
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const DELTA_DEBUG = process.env.DELTA_DEBUG === 'true';
const debugLog = (...args: unknown[]) => {
    if (DELTA_DEBUG) {
        console.log('[CharacterDelta]', ...args);
    }
};
const warnLog = (...args: unknown[]) => {
    console.warn('[CharacterDelta]', ...args);
};

export interface StateDeltaContext {
    actionId?: string;
    actionType?: string;
    stateVersion?: number;
    metadata?: Record<string, any>;
    encounterId?: number;
    entityId?: string;
    authoritativeSignature?: string | null;
    expectedStateVersion?: number;
}

export const applyCharacterStateDelta = async (
    sessionId: number,
    delta: CharacterStateDelta,
    context?: StateDeltaContext
): Promise<AppliedCharacterDelta | null> => {
    const sessionRepo = AppDataSource.getRepository(SessaoIA);
    const session = await sessionRepo.findOne({
        where: { id: sessionId },
        relations: ['character', 'character.attributes'],
    });

    if (!session?.character) {
        throw new Error('Sessão sem personagem ativo para aplicar delta.');
    }

    const attrRepo = AppDataSource.getRepository(CharacterAttributes);
    let attributes = session.character.attributes;
    if (!attributes) {
        attributes = attrRepo.create({
            characterId: session.character.id,
            strength: 10,
            dexterity: 10,
            constitution: 10,
            intelligence: 10,
            wisdom: 10,
            charisma: 10,
            hp: 10,
            maxHp: 10,
            ac: 10,
            conditions: [],
        });
    }

    let hpChanged = false;
    let resourceSnapshots:
        | {
              type: string;
              key: string;
              current: number;
              max: number;
          }[]
        | undefined;
    let resourceLogEntries:
        | {
              type: string;
              key: string;
              delta: number;
          }[]
        | undefined;
    let inventoryChanges:
        | {
              itemIndex?: string;
              itemId?: number;
              quantityDelta: number;
          }[]
        | undefined;
    let currencyChanges: Partial<Record<'pp' | 'gp' | 'ep' | 'sp' | 'cp', number>> | undefined;

    if (delta.hp) {
        const maxHp = attributes.maxHp ?? attributes.hp ?? 0;
        if (delta.hp.setToMax) {
            attributes.hp = maxHp;
            hpChanged = true;
        }
        if (typeof delta.hp.delta === 'number') {
            const current = attributes.hp ?? 0;
            attributes.hp = clamp(current + delta.hp.delta, 0, maxHp || current + delta.hp.delta);
            hpChanged = true;
        }
    }

    if (hpChanged) {
        await attrRepo.save(attributes);
        debugLog('HP updated', { sessionId, hp: attributes.hp, maxHp: attributes.maxHp });
    }

    if (delta.resources?.length) {
        const applied = await applyResourceChanges(session.character.id, delta.resources);
        if (applied.length) {
            resourceSnapshots = applied.map(({ resource }) => ({
                type: resource.type,
                key: resource.resourceKey,
                current: resource.current,
                max: resource.max,
            }));
            resourceLogEntries = applied
                .filter(({ deltaApplied }) => deltaApplied !== 0)
                .map(({ resource, deltaApplied }) => ({
                    type: resource.type,
                    key: resource.resourceKey,
                    delta: deltaApplied,
                }));
            debugLog('Resources updated', { sessionId, resources: resourceLogEntries });
        } else {
            warnLog('Resource delta requested but no matching resources found', { sessionId, delta: delta.resources });
        }
    }

    if (delta.inventory?.length) {
        inventoryChanges = [];
        for (const entry of delta.inventory) {
            if (!entry.quantityDelta || entry.quantityDelta === 0) continue;
            if (entry.quantityDelta < 0) {
                await consumeCharacterItem({
                    characterId: session.character.id,
                    itemId: entry.itemId,
                    itemIndex: entry.itemIndex,
                    quantity: Math.abs(entry.quantityDelta),
                });
                inventoryChanges.push(entry);
                debugLog('Inventory consumed', { sessionId, entry });
            } else {
                await addOrIncrementCharacterItem({
                    characterId: session.character.id,
                    itemId: entry.itemId,
                    itemIndex: entry.itemIndex,
                    quantity: entry.quantityDelta,
                    name: entry.name,
                    itemData: entry.itemData as Record<string, unknown> | undefined,
                });
                inventoryChanges.push(entry);
                debugLog('Inventory gained', { sessionId, entry });
            }
        }
        if (!inventoryChanges.length) {
            inventoryChanges = undefined;
        }
    }

    if (delta.currency && typeof delta.currency === 'object') {
        currencyChanges = {};
        for (const [coin, value] of Object.entries(delta.currency)) {
            const numeric = Number(value);
            if (Number.isFinite(numeric) && numeric !== 0) {
                (currencyChanges as Record<string, number>)[coin] = numeric;
            }
        }
        if (Object.keys(currencyChanges).length) {
            await applyCurrencyDelta(session.character.id, currencyChanges);
            debugLog('Currency updated', { sessionId, currencyChanges });
        } else {
            currencyChanges = undefined;
        }
    }

    if (hpChanged || resourceSnapshots || resourceLogEntries || inventoryChanges || currencyChanges) {
        await recordActionLog({
            sessionId,
            characterId: session.character.id,
            encounterId: context?.encounterId,
            entityId: context?.entityId,
            actionId: context?.actionId,
            actionType: context?.actionType ?? 'character.delta',
            stateVersion: context?.stateVersion,
            delta: {
                character: {
                    ...(hpChanged ? { hp: delta.hp } : {}),
                    resources: resourceLogEntries,
                    inventory: inventoryChanges,
                    currency: currencyChanges,
                },
            },
            metadata: context?.metadata,
        });

        return {
            characterId: session.character.id,
            attributes: hpChanged
                ? {
                      hp: attributes.hp,
                      maxHp: attributes.maxHp,
                  }
                : undefined,
            resources: resourceSnapshots,
        };
    }

    debugLog('Delta ignored (no effective change)', { sessionId, delta });
    return null;
};
