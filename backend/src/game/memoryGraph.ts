// backend/src/game/memoryGraph.ts
import type { CombatState } from '../schemas/gameSchemas.js';

type WorldSnapshot = {
    currentRegion?: string | null;
    regionSlug?: string | null;
    poiSlug?: string | null;
    poiName?: string | null;
    visitedRegions?: string[];
    visitedPois?: Array<{ regionSlug?: string; poiSlug?: string; name?: string }>;
};

type JournalEntry = {
    id?: string;
    name?: string;
    title?: string;
    status?: string;
    summary?: string;
};

export type MemoryGraphNode = {
    id: string;
    type: 'region' | 'poi' | 'npc' | 'objective';
    label: string;
    status?: string;
    parent?: string;
    notes?: string;
};

export type MemoryGraph = {
    nodes: MemoryGraphNode[];
};

const safeId = (prefix: string, value?: string | null) => {
    if (!value) return `${prefix}-unknown`;
    return `${prefix}-${value}`.replace(/[^a-z0-9-_]+/gi, '-');
};

const dedupe = <T extends { id: string }>(nodes: T[]): T[] => {
    const map = new Map<string, T>();
    nodes.forEach(node => {
        if (!map.has(node.id)) {
            map.set(node.id, node);
        }
    });
    return Array.from(map.values());
};

const buildRegionNodes = (world?: WorldSnapshot): MemoryGraphNode[] => {
    if (!world) return [];
    const nodes: MemoryGraphNode[] = [];
    const regionLabel = world.currentRegion || world.regionSlug || null;
    if (regionLabel) {
        nodes.push({
            id: safeId('region', regionLabel),
            type: 'region',
            label: regionLabel,
            status: 'current',
        });
    }
    if (Array.isArray(world.visitedRegions)) {
        world.visitedRegions.forEach(region => {
            if (!region) return;
            nodes.push({
                id: safeId('region', region),
                type: 'region',
                label: region,
                status: region === regionLabel ? 'current' : 'visited',
            });
        });
    }
    if (Array.isArray(world.visitedPois)) {
        world.visitedPois.forEach(poi => {
            const label = poi?.name || poi?.poiSlug;
            if (!label) return;
            nodes.push({
                id: safeId('poi', label),
                type: 'poi',
                label,
                parent: poi?.regionSlug ? safeId('region', poi.regionSlug) : undefined,
                status: poi?.poiSlug === world.poiSlug ? 'current' : 'visited',
            });
        });
    }
    if (world.poiName || world.poiSlug) {
        nodes.push({
            id: safeId('poi', world.poiName ?? world.poiSlug ?? 'poi'),
            type: 'poi',
            label: world.poiName ?? world.poiSlug ?? 'Ponto de interesse',
            parent: regionLabel ? safeId('region', regionLabel) : undefined,
            status: 'current',
        });
    }
    return nodes;
};

const buildNpcNodes = (combatState?: CombatState | null): MemoryGraphNode[] => {
    if (!combatState || !combatState.combatants?.length) return [];
    return combatState.combatants
        .filter(combatant => !combatant.isPlayer)
        .map(combatant => ({
            id: safeId('npc', combatant.id ?? combatant.name),
            type: 'npc',
            label: combatant.name,
            status: combatant.isDead ? 'derrotado' : combatant.attitude ?? undefined,
            notes: combatant.damageProfile?.dice ? `dano ${combatant.damageProfile.dice}` : undefined,
        }));
};

const buildObjectiveNodes = (journal?: JournalEntry[]): MemoryGraphNode[] => {
    if (!Array.isArray(journal)) return [];
    return journal.map(entry => ({
        id: safeId('objective', entry.id ?? entry.name ?? entry.title ?? 'objetivo'),
        type: 'objective',
        label: entry.name ?? entry.title ?? 'Objetivo',
        status: entry.status ?? undefined,
        notes: entry.summary,
    }));
};

export const buildMemoryGraph = (params: {
    character?: any;
    world?: WorldSnapshot;
    combatState?: CombatState | null;
}): MemoryGraph => {
    const world = params.world ?? params.character?.worldState;
    const nodes = dedupe([
        ...buildRegionNodes(world),
        ...buildNpcNodes(params.combatState),
        ...buildObjectiveNodes(params.character?.journal),
    ]);
    return { nodes };
};

export const formatMemoryGraphSnippet = (graph: MemoryGraph): string => {
    if (!graph.nodes.length) return '';
    const lines = graph.nodes.map(node => {
        const parts = [node.type.toUpperCase(), node.label];
        if (node.status) parts.push(`status=${node.status}`);
        if (node.parent) parts.push(`parent=${node.parent}`);
        if (node.notes) parts.push(`notes=${node.notes}`);
        return parts.join(' | ');
    });
    return `MEMORIA_GRAFO=${lines.length} nós\n${lines.join('\n')}`;
};

