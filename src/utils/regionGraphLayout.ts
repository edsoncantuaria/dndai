import type { WorldMapSnapshot } from '@/services/gameService';
import type { RegionDTO } from '@/services/regionClient';
import { buildRegionHierarchy, computeHierarchyLayout } from '@/utils/regionTree';

export const REGION_GRAPH_NODE_W = 100;
export const REGION_GRAPH_NODE_H = 44;

export type RegionGraphLayout = {
  positions: Record<string, { x: number; y: number }>;
  regions: RegionDTO[];
  width: number;
  height: number;
  links: WorldMapSnapshot['links'];
};

const isGraphRegion = (region: RegionDTO): boolean => {
  if (region.type === 'world') return false;
  if ((region.metadata?.role as string | undefined) === 'kingdom') return false;
  return true;
};

/** Grafo local: região atual no centro + vizinhos conectados. */
function buildLocalRegionGraph(snapshot: WorldMapSnapshot): RegionGraphLayout | null {
  const current = snapshot.currentRegionSlug;
  if (!current) return null;

  const regionBySlug = new Map(snapshot.regions.map(r => [r.slug, r as RegionDTO]));
  const nodeSlugs = new Set<string>([current]);

  for (const link of snapshot.links ?? []) {
    if (link.fromCurrent || link.fromSlug === current || link.toSlug === current) {
      nodeSlugs.add(link.fromSlug);
      nodeSlugs.add(link.toSlug);
    }
  }

  const regions = [...nodeSlugs]
    .map(slug => regionBySlug.get(slug))
    .filter((r): r is RegionDTO => Boolean(r && isGraphRegion(r)));

  if (!regions.length) return null;

  const width = 360;
  const height = 200;
  const cx = width / 2;
  const cy = height / 2;
  const positions: Record<string, { x: number; y: number }> = {};

  const neighbors = regions.filter(r => r.slug !== current);
  const orbit =
    neighbors.length <= 1 ? 72 : neighbors.length <= 4 ? 88 : neighbors.length <= 8 ? 96 : 108;

  positions[current] = {
    x: cx - REGION_GRAPH_NODE_W / 2,
    y: cy - REGION_GRAPH_NODE_H / 2,
  };

  neighbors.forEach((region, index) => {
    const angle = (2 * Math.PI * index) / Math.max(neighbors.length, 1) - Math.PI / 2;
    positions[region.slug] = {
      x: cx + Math.cos(angle) * orbit - REGION_GRAPH_NODE_W / 2,
      y: cy + Math.sin(angle) * orbit - REGION_GRAPH_NODE_H / 2,
    };
  });

  const slugSet = new Set(regions.map(r => r.slug));
  const links = (snapshot.links ?? []).filter(
    l => slugSet.has(l.fromSlug) && slugSet.has(l.toSlug),
  );

  return { positions, regions, width, height, links };
}

/** Fallback: árvore hierárquica completa (com auto-fit no componente). */
function buildHierarchyRegionGraph(snapshot: WorldMapSnapshot): RegionGraphLayout | null {
  const graphRegions = (snapshot.regions as RegionDTO[]).filter(isGraphRegion);
  if (!graphRegions.length) return null;

  const roots = buildRegionHierarchy(snapshot.regions as RegionDTO[]);
  const positions = computeHierarchyLayout(roots);
  const coords = Object.values(positions);
  if (!coords.length) return null;

  let maxX = 0;
  let maxY = 0;
  for (const pos of coords) {
    maxX = Math.max(maxX, pos.x);
    maxY = Math.max(maxY, pos.y);
  }

  return {
    positions,
    regions: graphRegions.filter(r => positions[r.slug]),
    width: Math.max(maxX + REGION_GRAPH_NODE_W + 32, 280),
    height: Math.max(maxY + REGION_GRAPH_NODE_H + 32, 180),
    links: snapshot.links ?? [],
  };
}

export function buildRegionGraphLayout(snapshot: WorldMapSnapshot | null): RegionGraphLayout | null {
  if (!snapshot?.regions?.length) return null;
  return buildLocalRegionGraph(snapshot) ?? buildHierarchyRegionGraph(snapshot);
}

export function fitRegionGraphView(
  containerWidth: number,
  containerHeight: number,
  layout: RegionGraphLayout,
): { scale: number; pan: { x: number; y: number } } {
  const pad = 12;
  const scale = Math.min(
    (containerWidth - pad * 2) / layout.width,
    (containerHeight - pad * 2) / layout.height,
    1.25,
  );
  const safeScale = Math.max(0.35, scale);
  return {
    scale: safeScale,
    pan: {
      x: (containerWidth - layout.width * safeScale) / 2,
      y: (containerHeight - layout.height * safeScale) / 2,
    },
  };
}
