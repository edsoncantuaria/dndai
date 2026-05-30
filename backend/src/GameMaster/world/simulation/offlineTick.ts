import { PenaiDataSource } from '../database/data-source.js';
import { Rumor } from '../database/entities/Rumor.js';
import { Faction } from '../database/entities/Faction.js';
import { appendWorldEvent } from '../events/store.js';
import { randomUUID } from 'crypto';

const FACTION_SLUGS = ['guilda-mercadores', 'ordem-crepuscular', 'circulo-druidas', 'coroa-ferro'];

const RUMOR_TEMPLATES = [
    'Comerciantes sussurram sobre rotas mais perigosas ao norte.',
    'Patrulhas aumentaram perto das fronteiras da região.',
    'Um mensageiro desapareceu na estrada principal.',
    'Preços de suprimentos sobem após tensões entre facções.',
];

/** Simulação leve de mundo offline: rumores e pulso de facções entre turnos do jogador. */
export async function tickOfflineWorld(sessionId: number): Promise<string[]> {
    await ensureFactionCatalog();
    const pulses: string[] = [];
    const rumorRepo = PenaiDataSource.getRepository(Rumor);

    const stale = await rumorRepo.find({
        where: { sessionId, status: 'active' },
        order: { createdAt: 'ASC' },
        take: 20,
    });
    if (stale.length > 8) {
        const toExpire = stale.slice(0, stale.length - 8);
        for (const r of toExpire) {
            r.status = 'faded';
            await rumorRepo.save(r);
        }
        pulses.push('Rumores antigos perdem força nas tavernas.');
    }

    const faction = FACTION_SLUGS[Math.floor(Math.random() * FACTION_SLUGS.length)];
    const body = RUMOR_TEMPLATES[Math.floor(Math.random() * RUMOR_TEMPLATES.length)];

    await appendWorldEvent({
        type: 'RUMOR_SPREAD',
        sessionId,
        payload: {
            title: `Movimentação: ${faction}`,
            body,
            factionSlug: faction,
        },
        canonCandidate: false,
    });

    await appendWorldEvent({
        type: 'FACTION_TICK',
        sessionId,
        payload: {
            factionSlug: faction,
            delta: Math.random() > 0.5 ? 1 : -1,
            note: 'Mundo offline — tick de facção',
        },
    });

    pulses.push(`Facção ${faction}: ${body}`);
    return pulses;
}

async function ensureFactionCatalog(): Promise<void> {
    const repo = PenaiDataSource.getRepository(Faction);
    for (const slug of FACTION_SLUGS) {
        const exists = await repo.findOne({ where: { slug } });
        if (!exists) {
            await repo.save(
                repo.create({
                    id: randomUUID(),
                    slug,
                    displayName: slug.replace(/-/g, ' '),
                    alignment: 'neutral',
                    locale: 'pt-BR',
                }),
            );
        }
    }
}
