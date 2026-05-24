'use client';

import { BookOpen } from 'lucide-react';
import { DndCard } from '@/components/primitives';
import NewJournal from '@/components/NewJournal';
import StoryHighlightsCard from '@/components/StoryHighlightsCard';
import { StoryTimeline } from './StoryTimeline';
import { SessionFactsPanel } from './SessionFactsPanel';
import { SessionCastPanel } from '../components/SessionCastPanel';

export function GameplayStoryPanel({ sessionId }: { sessionId: number | null }) {
  return (
    <div className="space-y-4">
      <DndCard padding="md" hover={false}>
        <p className="flex items-center gap-2 font-ui text-[10px] uppercase tracking-wider text-dnd-gold">
          <BookOpen className="h-4 w-4" />
          Crônica
        </p>
        <h3 className="mt-1 font-display text-lg text-dnd-parchment">História da aventura</h3>
        <div className="mt-4 max-h-[280px] overflow-y-auto pr-1">
          <StoryTimeline />
        </div>
      </DndCard>

      <SessionFactsPanel sessionId={sessionId} />

      {sessionId ? <SessionCastPanel sessionId={sessionId} /> : null}

      <div className="[&_.rounded-3xl]:rounded-lg [&_.border-stone-800]:border-dnd-gold/15">
        <StoryHighlightsCard variant="v2" />
      </div>

      <div className="[&_.rounded-3xl]:rounded-lg [&_.border-white\\/10]:border-dnd-gold/15">
        <NewJournal variant="v2" />
      </div>
    </div>
  );
}
