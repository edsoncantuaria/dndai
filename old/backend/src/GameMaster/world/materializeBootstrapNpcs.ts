import { appendWorldEvent } from '../events/store.js';
import type { BootstrapNpcDraft } from './agents/worldBootstrapNpcAgent.js';
import { penaiPipelineLog } from '../infra/pipelineLog.js';
import type { PipelineCtx } from '../infra/pipelineLog.js';
import { resolveHeroLevelForSession } from './npcSheet.js';
import { materializeCanonicalNpcs } from './canonicalNpcSeed.js';
import { markEntityAppeared } from './entityRegistry.js';
import { buildNpcCombatSheetForDraft } from './npcSheet.js';
import { PenaiDataSource } from '../database/data-source.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';

export type MaterializedNpc = {
    entityId: string;
    displayName: string;
    reused: boolean;
};

/** Cria ou reutiliza NPCs globais (Qdrant) e vincula à sessão (overlay + eventos). */
export async function materializeBootstrapNpcs(opts: {
    sessionId: number;
    userId: number;
    regionSlug: string;
    npcs: BootstrapNpcDraft[];
    ctx?: PipelineCtx;
}): Promise<MaterializedNpc[]> {
    const ctx = opts.ctx ?? { sessionId: opts.sessionId, userId: opts.userId };
    const heroLevel = await resolveHeroLevelForSession(opts.sessionId);

    const canonical = await materializeCanonicalNpcs({
        regionSlug: opts.regionSlug,
        npcs: opts.npcs,
        heroLevel,
        userId: opts.userId,
        alwaysCreate: false,
    });

    const out: MaterializedNpc[] = [];

    for (let i = 0; i < canonical.length; i++) {
        const row = canonical[i];
        const draft = opts.npcs[i];
        const sheet = buildNpcCombatSheetForDraft(draft, heroLevel, opts.regionSlug);

        await markEntityAppeared(
            opts.sessionId,
            row.entityId,
            { ...sheet.sessionSnapshot, homeRegion: opts.regionSlug },
            sheet.initialOverlay,
        );

        await appendWorldEvent({
            type: row.reused ? 'ENTITY_REUSED' : 'NPC_SPAWNED',
            sessionId: opts.sessionId,
            payload: {
                entityId: row.entityId,
                displayName: row.displayName,
                regionSlug: opts.regionSlug,
                role: draft.role,
                reused: row.reused,
            },
        });

        out.push({
            entityId: row.entityId,
            displayName: row.displayName,
            reused: row.reused,
        });

        const entity = await PenaiDataSource.getRepository(WorldEntity).findOne({
            where: { id: row.entityId },
        });
        penaiPipelineLog(
            'WORLD_BOOTSTRAP',
            row.reused ? 'NPC reutilizado (Qdrant)' : 'NPC criado',
            {
                name: row.displayName,
                givenName: draft.givenName,
                vida: row.vida,
                vidaMax: row.vidaMax,
                level: row.level,
                role: draft.role,
                weapon: entity
                    ? ((entity.stats as { mainWeapon?: { name?: string } }).mainWeapon?.name ?? '—')
                    : '—',
            },
            ctx,
        );
    }

    return out;
}
