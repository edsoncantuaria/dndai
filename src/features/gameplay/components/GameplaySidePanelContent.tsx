'use client';

import CharacterSheet from '@/components/CharacterSheet';
import Inventory from '@/components/Inventory';
import Spellbook from '@/components/Spellbook';
import NewJournal from '@/components/NewJournal';
import NewRelationships from '@/components/NewRelationships';
import ProgressionTab from '@/components/ProgressionTab';
import LocationHud from '@/components/LocationHud';
import DailyRecapPanel from '@/components/DailyRecapPanel';
import StoryHighlightsCard from '@/components/StoryHighlightsCard';
import type { Character } from '@/types';
import { isUiV2Enabled } from '@/lib/uiV2';
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
  if (isUiV2Enabled()) {
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

  switch (tab) {
    case 'map':
      return (
        <div className="space-y-4">
          <LocationHud
            sessionId={sessionId}
            regionLabel={character.worldState?.currentRegion || character.currentRegion || 'Região desconhecida'}
            poiLabel={(character.worldState as { poiName?: string })?.poiName ?? null}
            timeLabel={character.worldState?.timeOfDay}
            weatherLabel={character.worldState?.weather}
            onOpenMap={onOpenWorldMap}
          />
          <DailyRecapPanel />
        </div>
      );
    case 'story':
      return (
        <div className="space-y-4">
          <NewJournal />
          <StoryHighlightsCard variant="compact" />
        </div>
      );
    case 'inventory':
      return <Inventory />;
    case 'sheet':
      return (
        <div className="space-y-4">
          <CharacterSheet />
          <Spellbook />
          <ProgressionTab />
          <NewRelationships />
        </div>
      );
    default:
      return <CharacterSheet />;
  }
}
