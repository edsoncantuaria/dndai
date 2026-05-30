'use client';

import { usePenaiGameplay } from '@/contexts/PenaiGameplayContext';
import { PenaiStoryFeed } from '../story/PenaiStoryFeed';
import { LoadingOracle } from '../components/LoadingOracle';

/** Log narrativo V3 — exclusivamente storyFeed PENAI (Contract WS v2). */
export function GameplayNarrativeLog() {
  const penai = usePenaiGameplay();

  if (penai.narrationPending && penai.storyFeed.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-dnd-obsidian">
        <LoadingOracle label="O Mestre consulta o destino via Temporal…" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 bg-dnd-obsidian">
      <PenaiStoryFeed
        entries={penai.storyFeed}
        variant="main"
        narrationPending={penai.narrationPending}
        hydrated={penai.storyHydrated}
        workflowId={penai.narrationWorkflowId}
      />
      {penai.lastError ? (
        <p
          className="mx-2 rounded-md border border-dnd-ember/40 bg-dnd-ember/10 px-3 py-2 font-ui text-sm text-dnd-parchment"
          role="alert"
        >
          {penai.lastError}
        </p>
      ) : null}
    </div>
  );
}
