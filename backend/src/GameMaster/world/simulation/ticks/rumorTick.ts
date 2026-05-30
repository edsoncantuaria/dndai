import { createHash } from 'crypto';
import { PenaiDataSource } from '../../../database/data-source.js';
import { Rumor } from '../../../database/entities/Rumor.js';
import { CanonicalRegionLink } from '../../../database/entities/CanonicalRegionLink.js';
import { CanonicalRegion } from '../../../database/entities/CanonicalRegion.js';
import { appendWorldEvent } from '../../../events/store.js';
import {
    spreadKnowledgeFromRumor,
    listPresentEntityIds,
} from '../../knowledgeGraph.js';

const RUMOR_TEMPLATES = [
    'Comerciantes sussurram sobre rotas mais perigosas ao norte.',
    'Patrulhas aumentaram perto das fronteiras da região.',
    'Um mensageiro desapareceu na estrada principal.',
    'Preços de suprimentos sobem após tensões entre facções.',
];

export async function runRumorTick(sessionId: number, regionSlug?: string | null): Promise<string[]> {
    const pulses: string[] = [];
    const rumorRepo = PenaiDataSource.getRepository(Rumor);

    const stale = await rumorRepo.find({
        where: { sessionId, status: 'active' },
        order: { createdAt: 'ASC' },
        take: 20,
    });
    if (stale.length > 8) {
        for (const r of stale.slice(0, stale.length - 8)) {
            await appendWorldEvent({
                type: 'RUMOR_FADED',
                sessionId,
                payload: { rumorId: r.id, title: r.title },
            });
        }
        pulses.push('Rumores antigos perdem força nas tavernas.');
    }

    const body = RUMOR_TEMPLATES[Math.floor(Math.random() * RUMOR_TEMPLATES.length)];
    const title = regionSlug ? `Movimentação em ${regionSlug}` : 'Movimentação regional';

    await appendWorldEvent({
        type: 'RUMOR_SPREAD',
        sessionId,
        payload: { title, body, regionSlug, factionSlug: 'guilda-mercadores' },
        canonCandidate: false,
    });

    const factKey = `rumor_${sessionId}_${createHash('sha256').update(body).digest('hex').slice(0, 12)}`;
    const holders = await listPresentEntityIds(sessionId, 3);
    for (const holderEntityId of holders.slice(0, 2)) {
        await spreadKnowledgeFromRumor(sessionId, holderEntityId, factKey, body);
    }

    if (regionSlug) {
        await propagateRumorAlongGraph(sessionId, regionSlug, body);
    }

    pulses.push(body);
    return pulses;
}

async function propagateRumorAlongGraph(
    sessionId: number,
    fromRegionSlug: string,
    body: string,
): Promise<void> {
    const region = await PenaiDataSource.getRepository(CanonicalRegion).findOne({
        where: { slug: fromRegionSlug },
    });
    if (!region) return;

    const linkRepo = PenaiDataSource.getRepository(CanonicalRegionLink);
    const links = await linkRepo
        .createQueryBuilder('l')
        .where('l.fromRegionId = :regionId OR l.toRegionId = :regionId', { regionId: region.id })
        .take(3)
        .getMany();

    for (const link of links) {
        if (Math.random() > 0.6) continue;
        await appendWorldEvent({
            type: 'RUMOR_SPREAD',
            sessionId,
            payload: {
                title: 'Eco distante',
                body: `${body} (propagado)`,
                regionSlug: fromRegionSlug,
                viaLinkId: link.id,
            },
            canonCandidate: false,
        });
    }
}
