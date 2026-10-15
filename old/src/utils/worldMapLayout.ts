import type { RegionDTO } from '@/services/regionClient';
import type { WorldMapLink } from '@/services/gameService';
import {
  AURATHIS_MAP_CANVAS,
  resolveAurathisMapArt,
  resolveAurathisMapLayout,
} from '@/lib/aurathisMapArt';
import { computeHierarchyLayout, type RegionTreeNode } from '@/utils/regionTree';

export type MapLayoutResult = {
  nodePositions: Map<string, { x: number; y: number }>;
  continentBounds: Array<{ slug: string; name: string; x: number; y: number; width: number; height: number }>;
  width: number;
  height: number;
  /** Arte de fundo alinhada 1:1 ao canvas (mesmas dimensões). */
  mapArt: { url: string; width: number; height: number } | null;
};

/**
 * Posições em pixels no canvas canônico — sem reescalar, para coincidir com mapArt.
 */
export function buildGeographicMapLayout(
  regions: RegionDTO[],
  hierarchy: RegionTreeNode[],
): MapLayoutResult | null {
  const world =
    regions.find(r => r.slug === 'aurathis' || r.type === 'world') ??
    hierarchy.find(n => n.region.type === 'world')?.region;
  const { canvas, nodes } = resolveAurathisMapLayout(world?.metadata);
  const entries = Object.entries(nodes);
  if (entries.length < 8) return null;

  const nodePositions = new Map<string, { x: number; y: number }>();
  entries.forEach(([slug, pos]) => {
    nodePositions.set(slug, { x: pos.x, y: pos.y });
  });

  const art = resolveAurathisMapArt(world?.metadata);

  return {
    nodePositions,
    width: canvas.width,
    height: canvas.height,
    mapArt: art,
    continentBounds: world
      ? [
          {
            slug: world.slug,
            name: world.name,
            x: 0,
            y: 0,
            width: canvas.width,
            height: canvas.height,
          },
        ]
      : [],
  };
}

export function filterVisibleMapLinks(links: WorldMapLink[]): WorldMapLink[] {
  return links.filter(
    link =>
      link.reachable ||
      link.discovered ||
      (link as WorldMapLink & { fromCurrent?: boolean }).fromCurrent,
  );
}

export function mergeLayoutWithHierarchy(
  geographic: MapLayoutResult | null,
  hierarchyLayout: MapLayoutResult,
): MapLayoutResult {
  if (!geographic) return hierarchyLayout;
  const merged = new Map(geographic.nodePositions);
  hierarchyLayout.nodePositions.forEach((pos, slug) => {
    if (!merged.has(slug)) merged.set(slug, pos);
  });
  return {
    ...geographic,
    nodePositions: merged,
    mapArt: geographic.mapArt ?? hierarchyLayout.mapArt,
  };
}

export function buildMapLayout(regions: RegionDTO[], hierarchy: RegionTreeNode[]): MapLayoutResult {
  const geo = buildGeographicMapLayout(regions, hierarchy);
  const fallback = buildHierarchyOnlyLayout(hierarchy);
  return geo ? mergeLayoutWithHierarchy(geo, fallback) : fallback;
}

function buildHierarchyOnlyLayout(roots: RegionTreeNode[]): MapLayoutResult {
  const nodePositions = new Map<string, { x: number; y: number }>();
  const continentBounds: MapLayoutResult['continentBounds'] = [];
  if (!roots.length) {
    return {
      nodePositions,
      continentBounds,
      width: AURATHIS_MAP_CANVAS.width,
      height: AURATHIS_MAP_CANVAS.height,
      mapArt: null,
    };
  }

  const margin = 140;
  const gapBetweenContinents = 320;
  let offsetX = margin;
  let maxHeight = 0;

  const resolveLayoutForRoot = (root: RegionTreeNode) => {
    const stored = root.region.metadata?.mapLayout?.nodes as Record<string, { x: number; y: number }> | undefined;
    if (stored && Object.keys(stored).length) return stored;
    return computeHierarchyLayout([root]);
  };

  roots.forEach(root => {
    const layout = resolveLayoutForRoot(root);
    const entries = Object.entries(layout);
    if (!entries.length) return;

    const xs = entries.map(([, pos]) => pos.x);
    const ys = entries.map(([, pos]) => pos.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = maxX - minX + margin * 2;
    const height = maxY - minY + margin * 2;

    entries.forEach(([slug, pos]) => {
      nodePositions.set(slug, {
        x: offsetX + (pos.x - minX) + margin,
        y: (pos.y - minY) + margin,
      });
    });

    continentBounds.push({
      slug: root.region.slug,
      name: root.region.name,
      x: offsetX - margin * 0.6,
      y: margin * 0.25,
      width,
      height: Math.max(height, 420),
    });

    offsetX += width + gapBetweenContinents;
    maxHeight = Math.max(maxHeight, height + margin);
  });

  return {
    nodePositions,
    continentBounds,
    width: Math.max(offsetX, AURATHIS_MAP_CANVAS.width),
    height: Math.max(maxHeight, AURATHIS_MAP_CANVAS.height),
    mapArt: null,
  };
}
