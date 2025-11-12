'use client';

import { useMemo, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import ActionModal from '@/components/ui/ActionModal';
import { Button } from '@/components/ui/button';
import type { WorldMapSnapshot } from '@/services/gameService';
import type { RegionDTO } from '@/services/regionClient';
import {
  buildRegionHierarchy,
  computeHierarchyLayout,
  slugifyLabel,
  type RegionTreeNode,
} from '@/utils/regionTree';

type MarkerFilters = {
  player: boolean;
  npc: boolean;
  quest: boolean;
};

const markerFilterOptions: Array<{ key: keyof MarkerFilters; label: string }> = [
  { key: 'player', label: 'Você' },
  { key: 'npc', label: 'NPCs' },
  { key: 'quest', label: 'Missões' },
];

type WorldMapModalProps = {
  isOpen: boolean;
  onClose: () => void;
  snapshot: WorldMapSnapshot | null;
  isLoading?: boolean;
};

const WorldMapModal = ({ isOpen, onClose, snapshot, isLoading = false }: WorldMapModalProps) => {
  const [markerFilters, setMarkerFilters] = useState<MarkerFilters>({
    player: true,
    npc: true,
    quest: true,
  });
  const hierarchy = useMemo(
    () => (snapshot ? buildRegionHierarchy(snapshot.regions as RegionDTO[]) : []),
    [snapshot]
  );
  const toggleMarkerFilter = useCallback(
    (key: keyof MarkerFilters) =>
      setMarkerFilters(prev => ({
        ...prev,
        [key]: !prev[key],
      })),
    []
  );

  return (
    <ActionModal
      isOpen={isOpen}
      onClose={onClose}
      title="Mapa Mundi"
      actions={[
        {
          text: 'Fechar',
          onClick: onClose,
          variant: 'secondary',
        },
      ]}
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Carregando mapa mundi...
        </div>
      ) : snapshot && hierarchy.length ? (
        <>
          <div className="flex flex-wrap gap-2 text-xs mb-3">
            {markerFilterOptions.map(option => (
              <Button
                key={option.key}
                variant={markerFilters[option.key] ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleMarkerFilter(option.key)}
              >
                {markerFilters[option.key] ? '●' : '○'} {option.label}
              </Button>
            ))}
          </div>
          <WorldMapCanvas snapshot={snapshot} hierarchy={hierarchy} markerFilters={markerFilters} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Selecione uma sessão para visualizar o mapa mundi.
        </p>
      )}
    </ActionModal>
  );
};

type WorldLayoutResult = {
  nodePositions: Map<string, { x: number; y: number }>;
  continentBounds: Array<{ slug: string; name: string; x: number; y: number; width: number; height: number }>;
  width: number;
  height: number;
};

const buildWorldLayoutPositions = (roots: RegionTreeNode[]): WorldLayoutResult => {
  const nodePositions = new Map<string, { x: number; y: number }>();
  const continentBounds: WorldLayoutResult['continentBounds'] = [];
  if (!roots.length) {
    return {
      nodePositions,
      continentBounds,
      width: 1280,
      height: 860,
    };
  }

  const margin = 140;
  const gapBetweenContinents = 320;
  let offsetX = margin;
  let maxHeight = 0;

  const resolveLayoutForRoot = (root: RegionTreeNode) => {
    const stored = root.region.metadata?.mapLayout?.nodes as Record<string, { x: number; y: number }> | undefined;
    if (stored && Object.keys(stored).length) {
      return stored;
    }
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
    width: Math.max(offsetX, 1400),
    height: Math.max(maxHeight, 900),
  };
};

type WorldMapCanvasProps = {
  hierarchy: RegionTreeNode[];
  snapshot: WorldMapSnapshot;
  markerFilters: MarkerFilters;
};

const WorldMapCanvas = ({ hierarchy, snapshot, markerFilters }: WorldMapCanvasProps) => {
  const { nodePositions, continentBounds, width, height } = useMemo(
    () => buildWorldLayoutPositions(hierarchy),
    [hierarchy]
  );
  const fallbackPositions = useMemo(() => {
    const fallback = computeHierarchyLayout(hierarchy);
    return new Map<string, { x: number; y: number }>(Object.entries(fallback));
  }, [hierarchy]);
  const getPosition = useCallback(
    (slug: string) => nodePositions.get(slug) ?? fallbackPositions.get(slug),
    [nodePositions, fallbackPositions]
  );
  const canonicalSlug = useCallback((value?: string | null) => {
    if (!value) return '';
    return slugifyLabel(value);
  }, []);
  const visitedRegionSet = useMemo(() => {
    const set = new Set<string>();
    (snapshot.visitedRegions ?? []).forEach(slug => {
      const normalized = canonicalSlug(slug);
      if (normalized) set.add(normalized);
    });
    const current = canonicalSlug(snapshot.currentRegionSlug);
    if (current) set.add(current);
    return set;
  }, [snapshot.visitedRegions, snapshot.currentRegionSlug, canonicalSlug]);
  const visitedPoiSet = useMemo(() => {
    const set = new Set<string>();
    (snapshot.visitedPois ?? []).forEach(poi => {
      const regionSlug = canonicalSlug(poi.regionSlug);
      const poiSlug = canonicalSlug(poi.poiSlug);
      if (regionSlug && poiSlug) {
        set.add(`${regionSlug}::${poiSlug}`);
      }
    });
    return set;
  }, [snapshot.visitedPois, canonicalSlug]);
  const backgroundBySlug = useMemo(() => {
    const map = new Map<string, string>();
    hierarchy.forEach(node => {
      if (node.region.type !== 'world') return;
      const url = node.region.metadata?.mapBackground?.url;
      if (url) map.set(node.region.slug, url);
    });
    return map;
  }, [hierarchy]);
  const currentPos = snapshot.currentRegionSlug ? getPosition(snapshot.currentRegionSlug) : null;
  const fogGradientId = useMemo(() => `fog-gradient-${Math.random().toString(36).slice(2)}`, []);
  const fogMaskId = useMemo(() => `fog-mask-${Math.random().toString(36).slice(2)}`, []);
  const renderableRegions = useMemo(
    () => snapshot.regions.filter(region => region.type !== 'world'),
    [snapshot.regions]
  );
  const visibleMarkers = useMemo(
    () => (snapshot.markers ?? []).filter(marker => markerFilters[marker.type] !== false),
    [snapshot.markers, markerFilters]
  );

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/80">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <linearGradient id="worldGrid" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(148,163,184,0.08)" />
              <stop offset="100%" stopColor="rgba(15,23,42,0.25)" />
            </linearGradient>
            <pattern id="worldGridPattern" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(71,85,105,0.15)" strokeWidth="1" />
            </pattern>
            <radialGradient id={fogGradientId}>
              <stop offset="0%" stopColor="black" stopOpacity="0" />
              <stop offset="60%" stopColor="black" stopOpacity="0.4" />
              <stop offset="100%" stopColor="black" stopOpacity="1" />
            </radialGradient>
            <mask id={fogMaskId}>
              <rect width={width} height={height} fill="white" />
              {currentPos && (
                <circle cx={currentPos.x} cy={currentPos.y} r={520} fill={`url(#${fogGradientId})`} />
              )}
            </mask>
          </defs>
          <rect width={width} height={height} fill="#020617" />
          {continentBounds.map(bound => {
            const backgroundUrl = backgroundBySlug.get(bound.slug);
            if (!backgroundUrl) return null;
            return (
              <image
                key={`bg-${bound.slug}`}
                href={backgroundUrl}
                x={bound.x}
                y={bound.y}
                width={bound.width}
                height={bound.height}
                preserveAspectRatio="xMidYMid slice"
                opacity={0.35}
              />
            );
          })}
          <rect width={width} height={height} fill="url(#worldGrid)" />
          <rect width={width} height={height} fill="url(#worldGridPattern)" />
          <rect width={width} height={height} fill="rgba(2,6,23,0.82)" mask={`url(#${fogMaskId})`} />

          {continentBounds.map(bound => (
            <g key={bound.slug}>
              <rect
                x={bound.x}
                y={bound.y}
                width={bound.width}
                height={bound.height}
                fill="rgba(8,47,73,0.15)"
                stroke="rgba(56,189,248,0.2)"
                strokeDasharray="12 8"
              />
              <text
                x={bound.x + 16}
                y={bound.y + 28}
                fontSize={14}
                fill="#38bdf8"
                className="uppercase tracking-[0.3em]"
              >
                {bound.name}
              </text>
            </g>
          ))}

          {snapshot.links
            .filter(link => link.discovered)
            .map(link => {
              const fromPos = getPosition(link.fromSlug);
              const toPos = getPosition(link.toSlug);
              if (!fromPos || !toPos) return null;
              const color = link.isLocked ? '#f87171' : '#38bdf8';
              return (
                <line
                  key={`${link.fromSlug}-${link.toSlug}`}
                  x1={fromPos.x}
                  y1={fromPos.y}
                  x2={toPos.x}
                  y2={toPos.y}
                  stroke={color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  opacity={0.9}
                  strokeDasharray={link.isLocked ? '8 6' : undefined}
                />
              );
            })}

          {renderableRegions.map(region => {
            const pos = getPosition(region.slug);
            if (!pos) return null;
            const canonicalRegionSlug =
              canonicalSlug(region.slug) || canonicalSlug(region.name ?? '');
            const isDiscovered =
              region.isDiscovered ??
              (canonicalRegionSlug ? visitedRegionSet.has(canonicalRegionSlug) : false);
            const radius = region.type === 'city' ? 14 : 10;
            const fill = !isDiscovered
              ? '#1f2937'
              : region.type === 'city'
                ? '#22d3ee'
                : region.type === 'dungeon'
                  ? '#f97316'
                  : '#a855f7';
            const stroke = region.isCurrent ? '#facc15' : isDiscovered ? '#e2e8f0' : '#0f172a';
            const opacity = isDiscovered ? 1 : 0.35;
            const label = region.name;

            return (
              <g key={region.slug} transform={`translate(${pos.x}, ${pos.y})`}>
                {region.isCurrent && (
                  <circle
                    r={radius + 10}
                    fill="none"
                    stroke="#facc15"
                    strokeWidth={3}
                    className="animate-ping"
                  />
                )}
                <circle r={radius} fill={fill} stroke={stroke} strokeWidth={2} opacity={opacity} />
                {isDiscovered && (
                  <text
                    x={0}
                    y={radius + 16}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#e2e8f0"
                  >
                    {label.length > 18 ? `${label.slice(0, 15)}…` : label}
                  </text>
                )}
                <title>
                  {label}
                  {region.isCurrent ? ' (posição atual)' : ''}
                </title>
              </g>
            );
          })}
          {visibleMarkers.map(marker => {
            const pos = getPosition(marker.regionSlug);
            if (!pos) return null;
            const canonicalMarkerRegion = canonicalSlug(marker.regionSlug);
            const canonicalMarkerPoi = canonicalSlug(marker.poiSlug);
            const markerKey =
              canonicalMarkerRegion && canonicalMarkerPoi
                ? `${canonicalMarkerRegion}::${canonicalMarkerPoi}`
                : null;
            const markerIsDiscovered =
              marker.isDiscovered ??
              (markerKey ? visitedPoiSet.has(markerKey) : visitedRegionSet.has(canonicalMarkerRegion));
            const opacity = markerIsDiscovered ? 1 : 0.3;
            const label = marker.label;
            const description = marker.description
              ? ` • ${marker.description}`
              : marker.status
                ? ` (${marker.status})`
                : '';
            return (
              <g key={marker.id} transform={`translate(${pos.x}, ${pos.y - 6})`} opacity={opacity}>
                {marker.type === 'player' ? (
                  <>
                    <circle r={16} fill="none" stroke="#fef08a" strokeWidth={2} />
                    <circle r={10} fill="#facc15" stroke="#b45309" strokeWidth={2} />
                  </>
                ) : marker.type === 'npc' ? (
                  <rect
                    x={-8}
                    y={-8}
                    width={16}
                    height={16}
                    fill="#34d399"
                    stroke="#065f46"
                    strokeWidth={2}
                    transform="rotate(45)"
                  />
                ) : (
                  <rect
                    x={-7}
                    y={-7}
                    width={14}
                    height={14}
                    fill="#fb7185"
                    stroke="#7f1d1d"
                    strokeWidth={2}
                    rx={2}
                  />
                )}
                <text
                  x={0}
                  y={marker.type === 'player' ? 26 : 22}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#e2e8f0"
                >
                  {label.length > 18 ? `${label.slice(0, 15)}…` : label}
                </text>
                <title>
                  {label}
                  {description}
                </title>
              </g>
            );
          })}
          <text x={24} y={height - 28} fontSize={12} fill="#94a3b8">
            Rotas só aparecem após exploradas; use os filtros acima para destacar NPCs e missões.
          </text>
        </svg>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[#22d3ee]" />
          Cidade explorada
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[#f97316]" />
          Dungeon / ameaça
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[#a855f7]" />
          Região selvagem / sublocal
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[#1f2937]" />
          Não explorado
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-6 h-[2px] bg-[#38bdf8]" />
          Rotas conhecidas
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[#facc15]" />
          Você / grupo
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block"
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#34d399',
              transform: 'rotate(45deg)',
            }}
          />
          NPCs rastreados
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-[#fb7185]" />
          Missões em aberto
        </div>
      </div>
    </div>
  );
};

export default WorldMapModal;
