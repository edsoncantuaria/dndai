import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { CanonicalRegion } from '../database/entities/CanonicalRegion.js';
import { SessionQuest } from '../database/entities/SessionQuest.js';
import type { SessionQuestPayload } from '../world/sessionQuests.js';

export type CampaignQuestView = {
    questSlug: string;
    title: string;
    stage: number;
    status: string;
    regionSlug: string | null;
    regionName: string | null;
    synopsis: string;
    stageLabel: string;
    kind: 'local' | 'travel';
    isHere: boolean;
};

export async function buildCampaignQuestViews(sessionId: number): Promise<CampaignQuestView[]> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    const currentSlug = session?.currentRegionSlug ?? null;

    const quests = await PenaiDataSource.getRepository(SessionQuest).find({
        where: { sessionId, status: 'active' },
        order: { startedAt: 'ASC' },
        take: 10,
    });

    const regionRepo = PenaiDataSource.getRepository(CanonicalRegion);
    const views: CampaignQuestView[] = [];

    for (const q of quests) {
        const payload = (q.payload ?? {}) as SessionQuestPayload;
        const regionSlug = payload.regionSlug ?? null;
        let regionName = payload.regionName ?? null;
        if (regionSlug && !regionName) {
            const region = await regionRepo.findOne({ where: { slug: regionSlug } });
            regionName = region?.displayName ?? regionSlug;
        }
        const kind = payload.kind === 'travel' ? 'travel' : 'local';
        views.push({
            questSlug: q.questSlug,
            title: q.title,
            stage: q.stage,
            status: q.status,
            regionSlug,
            regionName,
            synopsis: payload.synopsis ?? '',
            stageLabel: payload.stageLabel ?? `Estágio ${q.stage}`,
            kind,
            isHere: Boolean(regionSlug && currentSlug && regionSlug === currentSlug),
        });
    }

    return views;
}
