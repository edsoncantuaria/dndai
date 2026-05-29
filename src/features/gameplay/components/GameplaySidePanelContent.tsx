'use client';

import type { Character } from '@/types';
import { GameplayInventoryPanel } from '../inventory/GameplayInventoryPanel';
import { GameplayMapPanel } from '../map/GameplayMapPanel';
import { GameplayStoryPanel } from '../story/GameplayStoryPanel';
import { GameplayCharacterSheetPanel } from '../character-sheet/GameplayCharacterSheetPanel';

export interface GameplaySidePanelContentProps {
  tab: string;
  character: Character;
  sessionId: number | null;
  onOpenWorldMap: () => void;
}

export function GameplaySidePanelContent({
  tab,
  character,
  sessionId,
  onOpenWorldMap,
}: GameplaySidePanelContentProps) {
  switch (tab) {
    case 'map':
      return (
        <GameplayMapPanel
          character={character}
          sessionId={sessionId}
          onOpenWorldMap={onOpenWorldMap}
        />
      );
    case 'story':
      return <GameplayStoryPanel sessionId={sessionId} />;
    case 'inventory':
      return <GameplayInventoryPanel />;
    case 'sheet':
      return <GameplayCharacterSheetPanel />;
    default:
      return <GameplayCharacterSheetPanel />;
  }
}
