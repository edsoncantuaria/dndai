'use client';

import { usePenaiGameplay } from '@/contexts/PenaiGameplayContext';
import { useSessionCampaign } from '@/hooks/useSessionCampaign';
import { PenaiStoryFeed } from '../story/PenaiStoryFeed';
import { PenaiJournalPanel } from '../story/PenaiJournalPanel';
import { SessionFactsPanel } from '../story/SessionFactsPanel';
import { SessionCastPanel } from '../components/SessionCastPanel';
import { MundoVivoPanel } from '../world/MundoVivoPanel';
import { PenaiExplainerAccordion } from './PenaiExplainerAccordion';
import { RegionMoodCard } from './RegionMoodCard';
import { ReputationPanel } from './ReputationPanel';
import { SharedWorldShardCard } from './SharedWorldShardCard';

export function CampanhaPanel({
    sessionId,
    onOpenMap,
}: {
    sessionId: number | null;
    onOpenMap?: (regionSlug: string) => void;
}) {
    const penai = usePenaiGameplay();
    const refreshKey = penai.worldPulse.length + (penai.phase === 'idle' ? 1 : 0);
    const { campaign, loading } = useSessionCampaign(sessionId, refreshKey);

    if (!sessionId) {
        return (
            <p className="font-ui text-sm text-dnd-parchment-muted">
                Abra uma sessão PENAI para ver o estado da campanha.
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
            <ReputationPanel
                reputation={
                    campaign?.reputation ?? { region: null, factions: [] }
                }
            />
            <SharedWorldShardCard
                shard={campaign?.shard ?? null}
                timelineRecent={campaign?.timelineRecent ?? []}
            />
            <MundoVivoPanel
                sessionId={sessionId}
                worldPulse={penai.worldPulse}
                worldPulseHeadline={penai.worldPulseHeadline}
                refreshKey={refreshKey}
                currentRegionSlug={
                    campaign?.regionSlug ??
                    (penai.lastMechanical?.currentRegionSlug as string | undefined) ??
                    null
                }
            />
            <PenaiStoryFeed
                entries={penai.storyFeed}
                narrationPending={penai.narrationPending}
                hydrated={penai.storyHydrated}
            />
            <PenaiJournalPanel sessionId={sessionId} />
            <SessionFactsPanel sessionId={sessionId} />
            <SessionCastPanel sessionId={sessionId} />
        </div>
    );
}
