import { Character } from '../entities/Character.js';

const ensureArray = <T>(value: T[] | undefined | null): T[] => (Array.isArray(value) ? value : []);

const mergeNpcLocations = (
    current?: unknown,
    updates?: Array<{ npcId?: string; name?: string; regionSlug?: string; poiSlug?: string }>,
) => {
    const map = new Map<string, Record<string, unknown>>();
    const collect = (source?: unknown) => {
        if (!Array.isArray(source)) return;
        for (const entry of source) {
            if (!entry || typeof entry !== 'object' || !(entry as { npcId?: string }).npcId) continue;
            const npcId = (entry as { npcId: string }).npcId;
            map.set(npcId, { ...(entry as Record<string, unknown>) });
        }
    };
    collect(current);
    collect(updates);
    return Array.from(map.values());
};

/** Snapshot de worldState do personagem para resposta da IA (motor narration_only). */
export const buildWorldStateSnapshot = (character: Character) => {
    const base = { ...(character.worldState || {}) };
    const relationships = ensureArray(character.relationships);
    const npcLocations = relationships
        .filter(rel => rel?.npcId && (rel.regionSlug || rel.poiSlug))
        .map(rel => ({
            npcId: rel.npcId,
            name: rel.name,
            regionSlug: rel.regionSlug ?? undefined,
            poiSlug: rel.poiSlug ?? undefined,
        }));
    if (npcLocations.length) {
        (base as Record<string, unknown>).npcLocations = mergeNpcLocations(
            (base as Record<string, unknown>).npcLocations,
            npcLocations,
        );
    }
    return base;
};
