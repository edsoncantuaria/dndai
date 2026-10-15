'use client';

import { useMemo, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { DndButton } from '@/components/primitives';
import { DndGameModalShell } from '@/features/gameplay/modals/DndGameModalShell';
import { cn } from '@/lib/utils';
import { WorldMapPanZoom } from './WorldMapPanZoom';
import type { WorldMapSnapshot } from '@/services/gameService';
import type { RegionDTO } from '@/services/regionClient';
import {
  buildRegionHierarchy,
  slugifyLabel,
  type RegionTreeNode,
} from '@/utils/regionTree';
import { buildMapLayout, filterVisibleMapLinks } from '@/utils/worldMapLayout';
import { resolvePlayerMapPosition } from '@/utils/worldMapPlayer';
import { PoiMapMarker, PoiIconLegendSwatch } from './PoiMapMarker';
import { PlayerMapMarker } from './PlayerMapMarker';
import { POI_ICON_LEGEND, resolvePoiIconKind, type PoiMapMarkerModel } from '@/lib/poiMapIcons';

type MarkerFilters = {
  player: boolean;
  npc: boolean;
  quest: boolean;
  poi: boolean;
};

const markerFilterOptions: Array<{ key: keyof MarkerFilters; label: string }> = [
  { key: 'player', label: 'Você' },
  { key: 'poi', label: 'Locais' },
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
    poi: true,
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

  if (!isOpen) return null;

  return (
    <DndGameModalShell
      title="Mapa mundi"
      eyebrow="Exploração"
      subtitle="Arraste e dê zoom para navegar. Toque nos filtros para destacar marcadores."
      onClose={onClose}
      maxWidth="max-w-6xl"
      edgeToEdge
      className="md:max-w-6xl"
      footer={
        <div className="flex justify-end">
          <DndButton variant="goldOutline" className="min-h-[44px] w-full sm:w-auto" onClick={onClose}>
            Fechar
          </DndButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-4 md:p-5">
        {isLoading ? (
          <div className="flex h-[min(40vh,320px)] items-center justify-center gap-2 font-ui text-dnd-parchment-muted">
            <Loader2 className="h-5 w-5 animate-spin text-dnd-gold" />
            Carregando mapa mundi…
          </div>
        ) : snapshot && hierarchy.length ? (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros de marcadores">
              {markerFilterOptions.map((option) => {
                const active = markerFilters[option.key];
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => toggleMarkerFilter(option.key)}
                    className={cn(
                      'min-h-[44px] rounded-full border px-4 font-ui text-sm transition',
                      active
                        ? 'border-dnd-gold/50 bg-dnd-gold/15 text-dnd-gold'
                        : 'border-dnd-gold/20 bg-dnd-obsidian-raised/60 text-dnd-parchment-muted hover:border-dnd-gold/35'
                    )}
                    aria-pressed={active}
                  >
                    {active ? '●' : '○'} {option.label}
                  </button>
                );
              })}
            </div>
            <WorldMapCanvas snapshot={snapshot} hierarchy={hierarchy} markerFilters={markerFilters} />
          </>
        ) : (
          <p className="py-8 text-center font-narrative text-sm text-dnd-parchment-muted">
            Selecione uma sessão para visualizar o mapa mundi.
          </p>
        )}
      </div>
    </DndGameModalShell>
  );
};

type WorldMapCanvasProps = {
  hierarchy: RegionTreeNode[];
  snapshot: WorldMapSnapshot;
  markerFilters: MarkerFilters;
};

const WorldMapCanvas = ({ hierarchy, snapshot, markerFilters }: WorldMapCanvasProps) => {
  const regionDtos = snapshot.regions as RegionDTO[];
  const { nodePositions, continentBounds, width, height, mapArt } = useMemo(
    () => buildMapLayout(regionDtos, hierarchy),
    [regionDtos, hierarchy],
  );

  const canonicalSlug = useCallback((value?: string | null) => {
    if (!value) return '';
    return slugifyLabel(value);
  }, []);

  const getPosition = useCallback(
    (slug: string) => nodePositions.get(slug),
    [nodePositions],
  );

  const currentRegionSlug = canonicalSlug(snapshot.currentRegionSlug);
  const currentPos = currentRegionSlug ? getPosition(currentRegionSlug) : null;

  const layoutPois = useMemo(() => {
    const world = regionDtos.find(r => r.slug === 'aurathis' || r.type === 'world');
    return world?.metadata?.mapLayout?.pois as
      | Record<string, { x: number; y: number; regionSlug?: string }>
      | undefined;
  }, [regionDtos]);

  const playerPos = useMemo(
    () => resolvePlayerMapPosition(snapshot, nodePositions, layoutPois, canonicalSlug),
    [snapshot, nodePositions, layoutPois, canonicalSlug],
  );

  const focusPoint = playerPos ?? currentPos;

  const hasIllustratedMap = Boolean(
    mapArt?.url && (mapArt.url.endsWith('.png') || mapArt.url.includes('continente-v4')),
  );

  const visitedRegionSet = useMemo(() => {
    const set = new Set<string>();
    (snapshot.visitedRegions ?? []).forEach(slug => {
      const normalized = canonicalSlug(slug);
      if (normalized) set.add(normalized);
    });
    if (currentRegionSlug) set.add(currentRegionSlug);
    return set;
  }, [snapshot.visitedRegions, currentRegionSlug, canonicalSlug]);

  const visitedPoiSet = useMemo(() => {
    const set = new Set<string>();
    (snapshot.visitedPois ?? []).forEach(poi => {
      const regionSlug = canonicalSlug(poi.regionSlug);
      const poiSlug = canonicalSlug(poi.poiSlug);
      if (regionSlug && poiSlug) set.add(`${regionSlug}::${poiSlug}`);
    });
    return set;
  }, [snapshot.visitedPois, canonicalSlug]);

  const backgroundBySlug = useMemo(() => {
    const map = new Map<string, string>();
    if (mapArt?.url) map.set('aurathis', mapArt.url);
    hierarchy.forEach(node => {
      if (node.region.type !== 'world') return;
      const url =
        (node.region.metadata?.mapBackground?.url as string | undefined) ??
        (node.region.slug === 'aurathis' ? mapArt?.url : undefined);
      if (url) map.set(node.region.slug, url);
    });
    return map;
  }, [hierarchy, mapArt]);

  const renderableRegions = useMemo(
    () =>
      snapshot.regions.filter(region => {
        if (region.type === 'world') return false;
        if ((region.metadata?.role as string | undefined) === 'kingdom') return false;
        if (!nodePositions.has(region.slug)) return false;
        return true;
      }),
    [snapshot.regions, nodePositions],
  );

  const visibleLinks = useMemo(() => {
    const base = filterVisibleMapLinks(snapshot.links);
    if (!currentRegionSlug) return base;
    return base.filter(
      link =>
        link.fromCurrent ||
        link.fromSlug === currentRegionSlug ||
        link.toSlug === currentRegionSlug,
    );
  }, [snapshot.links, currentRegionSlug]);

  const visibleMarkers = useMemo(
    () =>
      (snapshot.markers ?? []).filter(
        marker => marker.type !== 'player' && markerFilters[marker.type] !== false,
      ),
    [snapshot.markers, markerFilters],
  );

  const poiMetaBySlug = useMemo(() => {
    const map = new Map<string, { name: string; type: string; regionSlug: string }>();
    for (const region of snapshot.regions) {
      const regionSlug = canonicalSlug(region.slug);
      for (const poi of region.pointsOfInterest ?? []) {
        const slug = canonicalSlug(poi.slug);
        if (!slug) continue;
        map.set(slug, { name: poi.name, type: poi.type ?? 'landmark', regionSlug });
      }
    }
    return map;
  }, [snapshot.regions, canonicalSlug]);

  const poiMapMarkers = useMemo((): PoiMapMarkerModel[] => {
    const world = regionDtos.find(r => r.slug === 'aurathis' || r.type === 'world');
    const layoutPois = world?.metadata?.mapLayout?.pois as
      | Record<string, { x: number; y: number; regionSlug?: string }>
      | undefined;
    if (!layoutPois) return [];

    const currentPoi = canonicalSlug(snapshot.currentPoiSlug);

    return Object.entries(layoutPois)
      .map(([slug, pos]) => {
        const normSlug = canonicalSlug(slug);
        const regionSlug = canonicalSlug(pos.regionSlug ?? '');
        const meta = poiMetaBySlug.get(normSlug);
        const discovered = regionSlug ? visitedRegionSet.has(regionSlug) : false;
        const visited = visitedPoiSet.has(`${regionSlug}::${normSlug}`);
        return {
          slug: normSlug,
          name: meta?.name ?? slug.replace(/-/g, ' '),
          x: pos.x,
          y: pos.y,
          regionSlug,
          iconKind: resolvePoiIconKind(normSlug, meta?.type),
          discovered,
          visited,
          isCurrent: Boolean(currentPoi && currentPoi === normSlug),
        };
      })
      .filter(
        p =>
          p.discovered &&
          (p.regionSlug === currentRegionSlug || p.visited || p.isCurrent) &&
          !(playerPos?.poiSlug && p.slug === playerPos.poiSlug),
      )
      .sort((a, b) => (a.isCurrent ? -1 : 0) - (b.isCurrent ? -1 : 0));
  }, [
    regionDtos,
    visitedRegionSet,
    visitedPoiSet,
    poiMetaBySlug,
    canonicalSlug,
    snapshot.currentPoiSlug,
    currentRegionSlug,
    playerPos?.poiSlug,
  ]);

  const fogGradientId = useMemo(() => `fog-gradient-${Math.random().toString(36).slice(2)}`, []);
  const fogMaskId = useMemo(() => `fog-mask-${Math.random().toString(36).slice(2)}`, []);

  return (
    <div className="space-y-3">
      <WorldMapPanZoom width={width} height={height} focusPoint={focusPoint}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="select-none">
          {!hasIllustratedMap && (
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
                <stop offset="70%" stopColor="black" stopOpacity="0.25" />
                <stop offset="100%" stopColor="black" stopOpacity="0.65" />
              </radialGradient>
              <mask id={fogMaskId}>
                <rect width={width} height={height} fill="white" />
                {currentPos && (
                  <circle cx={currentPos.x} cy={currentPos.y} r={200} fill={`url(#${fogGradientId})`} />
                )}
              </mask>
            </defs>
          )}

          <rect width={width} height={height} fill={hasIllustratedMap ? '#0a1219' : '#020617'} />

          {continentBounds.map(bound => {
            const backgroundUrl = backgroundBySlug.get(bound.slug);
            if (!backgroundUrl) return null;
            const isCanonicalArt = mapArt?.url === backgroundUrl;
            return (
              <image
                key={`bg-${bound.slug}`}
                href={backgroundUrl}
                x={isCanonicalArt ? 0 : bound.x}
                y={isCanonicalArt ? 0 : bound.y}
                width={isCanonicalArt ? width : bound.width}
                height={isCanonicalArt ? height : bound.height}
                preserveAspectRatio={isCanonicalArt ? 'xMidYMid meet' : 'xMidYMid slice'}
                opacity={isCanonicalArt ? 1 : 0.35}
              />
            );
          })}

          {!hasIllustratedMap && (
            <>
              <rect width={width} height={height} fill="url(#worldGrid)" />
              <rect width={width} height={height} fill="url(#worldGridPattern)" />
              <rect width={width} height={height} fill="rgba(2,6,23,0.55)" mask={`url(#${fogMaskId})`} />
              {continentBounds.map(bound => (
                <g key={`frame-${bound.slug}`}>
                  <rect
                    x={bound.x}
                    y={bound.y}
                    width={bound.width}
                    height={bound.height}
                    fill="rgba(8,47,73,0.15)"
                    stroke="rgba(56,189,248,0.2)"
                    strokeDasharray="12 8"
                  />
                </g>
              ))}
            </>
          )}

          {visibleLinks.map(link => {
            const fromPos = getPosition(link.fromSlug);
            const toPos = getPosition(link.toSlug);
            if (!fromPos || !toPos) return null;
            const isFull = link.discovered;
            const isActive = link.fromCurrent;
            const color = link.isLocked
              ? '#f87171'
              : isActive
                ? '#fde047'
                : isFull
                  ? '#7dd3fc'
                  : '#64748b';
            const strokeWidth = isActive ? (hasIllustratedMap ? 2 : 3) : 1.75;
            const lineOpacity = hasIllustratedMap
              ? isActive
                ? 0.55
                : isFull
                  ? 0.4
                  : 0.28
              : isActive
                ? 0.95
                : 0.7;
            return (
              <g key={`${link.fromSlug}-${link.toSlug}`} opacity={lineOpacity}>
                <line
                  x1={fromPos.x}
                  y1={fromPos.y}
                  x2={toPos.x}
                  y2={toPos.y}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={link.isLocked ? '8 6' : undefined}
                />
                <title>
                  {link.fromSlug} → {link.toSlug}
                  {link.travelMode ? ` (${link.travelMode}` : ''}
                  {link.travelTimeMinutes != null ? `, ${link.travelTimeMinutes} min)` : ')'}
                  {link.isLocked ? ' [bloqueada]' : ''}
                </title>
              </g>
            );
          })}

          {renderableRegions.map(region => {
            const pos = getPosition(region.slug);
            if (!pos) return null;
            const canonicalRegionSlug = canonicalSlug(region.slug);
            const isDiscovered =
              region.isDiscovered ?? visitedRegionSet.has(canonicalRegionSlug);
            if (!isDiscovered && !region.isCurrent) return null;
            if (hasIllustratedMap && region.isCurrent) return null;

            const radius =
              region.type === 'city' ? 10 : region.type === 'dungeon' ? 8 : 6;
            const fill =
              region.type === 'city'
                ? '#22d3ee'
                : region.type === 'dungeon'
                  ? '#f97316'
                  : '#a855f7';
            const stroke = '#e2e8f0';
            const showLabel = region.type === 'city' && !region.isCurrent;

            return (
              <g key={region.slug} transform={`translate(${pos.x}, ${pos.y})`}>
                <circle r={radius + 3} fill="rgba(0,0,0,0.35)" />
                <circle r={radius} fill={fill} stroke={stroke} strokeWidth={1.5} opacity={0.95} />
                {showLabel && (
                  <text
                    x={0}
                    y={radius + 14}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#f8fafc"
                    stroke="#0f172a"
                    strokeWidth={2.5}
                    paintOrder="stroke"
                  >
                    {region.name.length > 20 ? `${region.name.slice(0, 17)}…` : region.name}
                  </text>
                )}
                <title>
                  {region.name}
                  {region.isCurrent ? ' (posição atual)' : ''}
                </title>
              </g>
            );
          })}

          {markerFilters.poi &&
            poiMapMarkers.map(poi => (
              <PoiMapMarker
                key={`poi-${poi.slug}`}
                x={poi.x}
                y={poi.y}
                kind={poi.iconKind}
                name={poi.name}
                size={13}
                discovered={poi.discovered}
                visited={poi.visited}
                isCurrent={poi.isCurrent}
              />
            ))}

          {visibleMarkers.map(marker => {
            const pos = getPosition(marker.regionSlug);
            if (!pos) return null;
            const label = marker.label;
            return (
              <g key={marker.id} transform={`translate(${pos.x}, ${pos.y})`}>
                {marker.type === 'player' ? (
                  <>
                    <circle r={12} fill="none" stroke="#fef08a" strokeWidth={2} />
                    <circle r={7} fill="#facc15" stroke="#b45309" strokeWidth={1.5} />
                  </>
                ) : marker.type === 'npc' ? (
                  <rect
                    x={-6}
                    y={-6}
                    width={12}
                    height={12}
                    fill="#34d399"
                    stroke="#065f46"
                    strokeWidth={1.5}
                    transform="rotate(45)"
                  />
                ) : (
                  <rect x={-6} y={-6} width={12} height={12} fill="#fb7185" stroke="#7f1d1d" strokeWidth={1.5} rx={1} />
                )}
                <title>{label}</title>
              </g>
            );
          })}

          {markerFilters.player && playerPos && (
            <PlayerMapMarker x={playerPos.x} y={playerPos.y} label={playerPos.label} />
          )}
        </svg>
      </WorldMapPanZoom>

      <p className="font-ui text-[11px] leading-relaxed text-dnd-parchment-muted">
        Zoom inicial na sua região. Rotas e locais mostram só o entorno imediato; use ↺ para recentralizar.
      </p>

      <details className="rounded-lg border border-dnd-gold/12 bg-dnd-obsidian-raised/40 p-3">
        <summary className="cursor-pointer font-ui text-[10px] uppercase tracking-wider text-dnd-gold/80">
          Legenda do mapa
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 md:grid-cols-4">
          {POI_ICON_LEGEND.map(spec => (
            <div key={spec.kind} className="flex items-center gap-2 font-ui text-[10px] text-dnd-parchment-muted">
              <PoiIconLegendSwatch kind={spec.kind} size={8} />
              <span>{spec.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 font-ui text-[10px] text-dnd-parchment-muted sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#22d3ee]" />
            Cidade
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
            Masmorra
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#facc15]" />
            Você
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-0.5 bg-[#7dd3fc]" />
            Rota próxima
          </div>
        </div>
      </details>
    </div>
  );
};

export default WorldMapModal;
