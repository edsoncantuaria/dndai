import type { FactionBeatDraft } from './agents/worldBootstrapFactionAgent.js';
import type { BootstrapNpcDraft } from './agents/worldBootstrapNpcAgent.js';
import type { QuestSeedDraft } from './agents/worldQuestSeedAgent.js';
import { getFactionCatalogEntry } from './factionCatalog.js';
import { generateServerCanonNpcDrafts } from './generateServerCanonNpcDrafts.js';
import { resolveHeroLevelForSession } from './npcSheet.js';
import {
    draftsFromAutoCanonMock,
    loadAutoCanonNpcMockFile,
} from './seed/loadAutoCanonNpcMock.js';

export type OfflineBootstrapSource = 'offline_seed';

/** Rumores genéricos a partir do catálogo — sem Gemini. */
export function offlineFactionBeats(
    factionSlugs: string[],
    regionName: string,
): { beats: FactionBeatDraft[]; source: OfflineBootstrapSource } {
    const beats = factionSlugs.map(slug => {
        const entry = getFactionCatalogEntry(slug);
        const name = entry?.displayName ?? slug.replace(/-/g, ' ');
        return {
            factionSlug: slug,
            localHeadline: `${name} na praça`,
            rumor: `Em ${regionName}, ${name} aparece em conversas de taverna — com cautela, mas sem hostilidade aberta.`,
        };
    });
    return { beats, source: 'offline_seed' };
}

export function offlineQuestSeeds(opts: {
    spawnRegionSlug: string;
    spawnRegionName: string;
}): { quests: QuestSeedDraft[]; source: OfflineBootstrapSource } {
    return {
        quests: [
            {
                title: 'Rumores locais',
                synopsis: `Moradores de ${opts.spawnRegionName} pedem ajuda com pequenas tarefas enquanto a região se acostuma com viajantes.`,
                questSlug: 'offline-rumores-locais',
                regionSlug: opts.spawnRegionSlug,
                kind: 'local',
                stageLabel: 'Ouvir e agir',
                urgency: 'medium',
            },
        ],
        source: 'offline_seed',
    };
}

export async function offlineBootstrapNpcs(opts: {
    sessionId: number;
    regionSlug: string;
    regionName: string;
}): Promise<{
    npcs: BootstrapNpcDraft[];
    regionBlurb: string;
    source: OfflineBootstrapSource;
}> {
    const mock = loadAutoCanonNpcMockFile(opts.regionSlug);
    if (mock) {
        return {
            npcs: draftsFromAutoCanonMock(mock).slice(0, 6),
            regionBlurb: mock.regionName
                ? `${mock.regionName} desperta com rostos já conhecidos das crônicas locais.`
                : `${opts.regionName} ganha vida com personagens do seed canônico.`,
            source: 'offline_seed',
        };
    }

    const heroLevel = await resolveHeroLevelForSession(opts.sessionId);
    const npcs = generateServerCanonNpcDrafts({
        count: 4,
        regionSlug: opts.regionSlug,
        regionName: opts.regionName,
        heroLevel,
        reserved: new Set<string>(),
    });

    return {
        npcs,
        regionBlurb: `${opts.regionName} acorda com mercadores, guardas e artesãos nas ruas — um começo modesto, mas jogável.`,
        source: 'offline_seed',
    };
}

export function offlineEconomy(regionName: string): {
    marketSummary: string;
    items: Array<{ itemSlug: string; priceNote: string; scarcityDelta: number }>;
    source: OfflineBootstrapSource;
} {
    return {
        marketSummary: `Mercados de ${regionName} operam com preços estáveis; suprimentos básicos estão disponíveis.`,
        items: [
            {
                itemSlug: 'healing_potion',
                priceNote: 'Poções de cura comuns nas barracas centrais.',
                scarcityDelta: 0,
            },
            {
                itemSlug: 'wolf_pelt',
                priceNote: 'Peles de caça circulam com oferta regular.',
                scarcityDelta: 0,
            },
        ],
        source: 'offline_seed',
    };
}
