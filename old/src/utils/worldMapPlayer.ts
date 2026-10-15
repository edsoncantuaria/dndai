import type { WorldMapSnapshot } from '@/services/gameService';

export type MapCoord = { x: number; y: number };

export type PlayerMapPosition = MapCoord & {
  label: string;
  poiSlug: string | null;
  regionSlug: string;
};

type LayoutPoi = { x: number; y: number; regionSlug?: string };

export function resolvePlayerMapPosition(
  snapshot: WorldMapSnapshot,
  nodePositions: Map<string, MapCoord>,
  layoutPois: Record<string, LayoutPoi> | undefined,
  canonicalSlug: (value?: string | null) => string,
): PlayerMapPosition | null {
  const regionSlug = canonicalSlug(snapshot.currentRegionSlug);
  if (!regionSlug) return null;

  const region = snapshot.regions.find(r => canonicalSlug(r.slug) === regionSlug);
  const label = region?.name ?? 'Você';

  const poiFromLayout = (poiSlug?: string | null): MapCoord | null => {
    if (!poiSlug) return null;
    const norm = canonicalSlug(poiSlug);
    const entry = layoutPois?.[norm] ?? layoutPois?.[poiSlug];
    if (!entry) return null;
    return { x: entry.x, y: entry.y };
  };

  const playerMarker = snapshot.markers?.find(m => m.type === 'player');

  const candidates = [
    snapshot.currentPoiSlug,
    playerMarker?.poiSlug,
    (region?.metadata?.defaultSpawnPoi as string | undefined) ?? null,
  ];

  for (const poiSlug of candidates) {
    const pos = poiFromLayout(poiSlug);
    if (pos) {
      return {
        ...pos,
        label,
        poiSlug: canonicalSlug(poiSlug) || null,
        regionSlug,
      };
    }
  }

  const regionPos = nodePositions.get(regionSlug);
  if (regionPos) {
    return { ...regionPos, label, poiSlug: null, regionSlug };
  }

  return null;
}
