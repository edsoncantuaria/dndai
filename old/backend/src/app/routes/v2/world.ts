import type { FastifyInstance } from 'fastify';
import { listCanonicalRegions } from '../../../GameMaster/world/mapCatalog.js';
import { describeSpawnPool } from '../../../GameMaster/world/penaiSpawnPool.js';
import { describeFactionWorldBindings } from '../../../GameMaster/world/factionCatalog.js';
import { findEntityCandidates } from '../../../GameMaster/world/entityRegistry.js';
import { resolveTravelDuration } from '../../../GameMaster/world/travelCanon.js';
import { PenaiDataSource } from '../../../GameMaster/database/data-source.js';
import { TravelModeCatalog } from '../../../GameMaster/database/entities/TravelModeCatalog.js';
import { listSessionWorldEvents } from '../../../GameMaster/events/store.js';

export async function worldRoutes(app: FastifyInstance): Promise<void> {
    app.get('/api/v2/world/regions', async () => {
        const regions = await listCanonicalRegions();
        return { regions, locale: 'pt-BR' };
    });

    app.get('/api/v2/world/spawn-pool', async () => {
        return { spawns: describeSpawnPool(), locale: 'pt-BR' };
    });

    app.get('/api/v2/world/factions', async () => {
        return { factions: describeFactionWorldBindings(), locale: 'pt-BR' };
    });

    app.get('/api/v2/world/entities/search', async (request) => {
        const q = request.query as { regionSlug?: string; poiSlug?: string; level?: string };
        const candidates = await findEntityCandidates({
            regionSlug: q.regionSlug,
            poiSlug: q.poiSlug,
            levelBand: q.level ? Number(q.level) : undefined,
            limit: 10,
        });
        return { candidates };
    });

    app.get('/api/v2/world/travel/preview', async (request, reply) => {
        const q = request.query as { from?: string; to?: string; mode?: string };
        if (!q.from || !q.to) {
            return reply.status(400).send({ error: 'Parâmetros from e to obrigatórios' });
        }
        const travel = await resolveTravelDuration(q.from, q.to, q.mode ?? 'walk');
        if (!travel) return reply.status(404).send({ error: 'Rota canônica não encontrada' });
        return { travel, locale: 'pt-BR' };
    });

    app.get('/api/v2/world/travel/modes', async () => {
        const modes = await PenaiDataSource.getRepository(TravelModeCatalog).find({
            order: { speedMultiplier: 'ASC' },
        });
        return { modes, locale: 'pt-BR' };
    });

    app.get('/api/v2/world/sessions/:sessionId/events', async (request) => {
        const sessionId = Number((request.params as { sessionId: string }).sessionId);
        const limit = Number((request.query as { limit?: string }).limit) || 40;
        const events = await listSessionWorldEvents(sessionId, limit);
        const { humanizeWorldEvents } = await import('../../../GameMaster/events/eventHumanizer.js');
        const { PenaiDataSource } = await import('../../../GameMaster/database/data-source.js');
        const { CanonicalRegion } = await import(
            '../../../GameMaster/database/entities/CanonicalRegion.js'
        );
        const regions = await PenaiDataSource.getRepository(CanonicalRegion).find();
        const regionNames = Object.fromEntries(regions.map(r => [r.slug, r.displayName]));
        const humanized = humanizeWorldEvents(
            events.map(ev => ({
                id: ev.id,
                type: ev.type,
                payload: ev.payload,
                createdAt: ev.createdAt,
            })),
            { regionNames },
        ).sort((a, b) => b.at.localeCompare(a.at));
        return { events: humanized, locale: 'pt-BR' };
    });
}
