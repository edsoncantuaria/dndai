'use client';

import type { Character } from '@/types';
import { GameplayInventoryPanel } from '../inventory/GameplayInventoryPanel';
import { GameplayMapPanel } from '../map/GameplayMapPanel';
import { CampanhaPanel } from '../campaign/CampanhaPanel';
import { GameplaySessionLogPanel } from '../debug/GameplaySessionLogPanel';
import { isDebugWsEnabled } from '@/lib/debugFlags';

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
    case 'campanha':
    case 'story':
      return (
        <CampanhaPanel
          sessionId={sessionId}
          onOpenMap={_slug => onOpenWorldMap()}
        />
      );
    case 'inventory':
      return <GameplayInventoryPanel />;
    case 'logs':
      if (!isDebugWsEnabled()) return null;
      return <GameplaySessionLogPanel sessionId={sessionId} />;
    default:
      return (
        <GameplayMapPanel
          character={character}
          sessionId={sessionId}
          onOpenWorldMap={onOpenWorldMap}
        />
      );
  }
}
