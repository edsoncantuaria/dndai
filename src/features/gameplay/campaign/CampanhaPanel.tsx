'use client';

import { usePenaiGameplay } from '@/contexts/PenaiGameplayContext';
import { useSessionCampaign } from '@/hooks/useSessionCampaign';
import { PenaiStoryFeed } from '../story/PenaiStoryFeed';
import { PenaiJournalPanel } from '../story/PenaiJournalPanel';
import { MundoVivoPanel } from '../world/MundoVivoPanel';
import { PenaiExplainerAccordion } from './PenaiExplainerAccordion';
import { RegionMoodCard } from './RegionMoodCard';
import { QuestTrackerCard } from './QuestTrackerCard';
import { ReputationStrip } from './ReputationStrip';

export function CampanhaPanel({ sessionId }: { sessionId: number | null }) {
    const penai = usePenaiGameplay();
    const refreshKey = penai.worldPulse.length + (penai.phase === 'idle' ? 1 : 0);
    const { campaign, loading } = useSessionCampaign(sessionId, refreshKey);

    if (!penai.active || !sessionId) {
        return (
            <p className="text-sm text-dnd-parchment/60">
                Conecte-se à mesa PENAI para ver o estado da campanha.
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <PenaiExplainerAccordion />
            {loading && !campaign ? (
                <p className="text-xs text-dnd-parchment/50">Carregando campanha…</p>
            ) : null}
            <RegionMoodCard
                regionSlug={campaign?.regionSlug ?? null}
                regionState={campaign?.regionState ?? null}
            />
            <QuestTrackerCard quests={campaign?.activeQuests ?? []} />
            <ReputationStrip reputation={campaign?.heroReputation ?? []} />
            <MundoVivoPanel
                sessionId={sessionId}
                worldPulse={penai.worldPulse}
                currentRegionSlug={
                    campaign?.regionSlug ??
                    (penai.lastMechanical?.currentRegionSlug as string | undefined) ??
                    null
                }
            />
            <PenaiStoryFeed entries={penai.storyFeed} />
            <PenaiJournalPanel sessionId={sessionId} />
        </div>
    );
}
