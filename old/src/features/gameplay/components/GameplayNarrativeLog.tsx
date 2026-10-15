'use client';

import { usePenaiGameplay } from '@/contexts/PenaiGameplayContext';
import { PenaiStoryFeed, isVisibleStoryEntry } from '../story/PenaiStoryFeed';
import { LoadingOracle } from '../components/LoadingOracle';
import { HeroDeathSavesBanner } from './HeroDeathSavesBanner';

/** Log narrativo V3 — exclusivamente storyFeed PENAI (Contract WS v2). */
export function GameplayNarrativeLog() {
  const penai = usePenaiGameplay();
  const visibleCount = penai.storyFeed.filter(isVisibleStoryEntry).length;
  const awaitingFirstLine = penai.narrationPending && visibleCount === 0;

  if (awaitingFirstLine) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-dnd-obsidian">
        <LoadingOracle label="O Mestre consulta o destino via Temporal…" />
      </div>
    );
  }

  const showOpeningRetry =
    Boolean(penai.lastError) &&
    visibleCount === 0 &&
    !penai.narrationPending &&
    penai.connected;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 bg-dnd-obsidian">
      <HeroDeathSavesBanner />
      <PenaiStoryFeed
        entries={penai.storyFeed}
        variant="main"
        narrationPending={penai.narrationPending}
        hydrated={penai.storyHydrated}
        workflowId={penai.narrationWorkflowId}
      />
      {penai.lastError ? (
        <div
          className="mx-2 flex flex-col gap-2 rounded-md border border-dnd-ember/40 bg-dnd-ember/10 px-3 py-2"
          role="alert"
        >
          <p className="font-ui text-sm text-dnd-parchment">{penai.lastError}</p>
          {showOpeningRetry ? (
            <button
              type="button"
              onClick={() => penai.retryOpening()}
              className="self-start rounded border border-dnd-gold/40 bg-dnd-obsidian-raised/80 px-3 py-1.5 font-ui text-xs text-dnd-gold transition-colors hover:border-dnd-gold hover:bg-dnd-obsidian-raised"
            >
              Tentar abertura novamente
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
