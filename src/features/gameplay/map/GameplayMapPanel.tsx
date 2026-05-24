'use client';

import { useCallback, useEffect, useState } from 'react';
import { Compass, ExternalLink, Loader2, Map as MapIcon } from 'lucide-react';
import { DndButton, DndCard } from '@/components/primitives';
import { getWorldMapSnapshot, type WorldMapSnapshot } from '@/services/gameService';
import type { Character } from '@/types';
import { RegionGraphView } from './RegionGraphView';
import DailyRecapPanel from '@/components/DailyRecapPanel';

export interface GameplayMapPanelProps {
  character: Character;
  sessionId: number | null;
  onOpenWorldMap: () => void;
}

export function GameplayMapPanel({ character, sessionId, onOpenWorldMap }: GameplayMapPanelProps) {
  const [snapshot, setSnapshot] = useState<WorldMapSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const regionLabel =
    character.worldState?.currentRegion || character.currentRegion || 'Região desconhecida';
  const poiLabel =
    character.worldState?.poiName ||
    (typeof character.worldState?.poi === 'object' ? character.worldState.poi?.name : undefined);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      setSnapshot(await getWorldMapSnapshot(sessionId));
    } catch {
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentRegion = snapshot?.regions?.find((r) => r.isCurrent);

  return (
    <div className="space-y-4">
      <DndCard padding="md" hover={false}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1 font-ui text-[10px] uppercase tracking-wider text-dnd-gold">
              <Compass className="h-3.5 w-3.5" />
              Onde estou
            </p>
            <h3 className="truncate font-display text-lg text-dnd-parchment">{regionLabel}</h3>
            {poiLabel ? (
              <p className="truncate font-ui text-sm text-dnd-parchment-muted">{poiLabel}</p>
            ) : null}
            {currentRegion?.summary ? (
              <p className="mt-1 line-clamp-2 font-narrative text-xs text-dnd-parchment-muted">
                {currentRegion.summary}
              </p>
            ) : null}
          </div>
          <DndButton variant="goldOutline" size="sm" onClick={onOpenWorldMap}>
            <ExternalLink className="h-4 w-4" />
            Mapa
          </DndButton>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 font-ui text-xs text-dnd-parchment-muted">
          {character.worldState?.timeOfDay ? <span>{character.worldState.timeOfDay}</span> : null}
          {character.worldState?.weather ? (
            <span>· {character.worldState.weather}</span>
          ) : null}
        </div>
      </DndCard>

      <DndCard padding="sm" hover={false} className="border-dnd-gold/12">
        <p className="mb-2 flex items-center gap-2 font-ui text-xs uppercase tracking-wider text-dnd-gold">
          <MapIcon className="h-4 w-4" />
          Grafo de regiões
        </p>
        {loading ? (
          <div className="flex h-[220px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-dnd-gold" />
          </div>
        ) : (
          <RegionGraphView snapshot={snapshot} />
        )}
      </DndCard>

      <div className="[&_.rounded-3xl]:rounded-lg [&_.border-white\\/10]:border-dnd-gold/15">
        <DailyRecapPanel variant="v2" />
      </div>
    </div>
  );
}
